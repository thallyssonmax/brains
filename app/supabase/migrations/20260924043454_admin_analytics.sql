-- Incremental analytics: no rewrite of libraries, auth or existing policies.
create schema if not exists brains_admin;
revoke all on schema brains_admin from public;
grant usage on schema brains_admin to anon, authenticated;

create table brains_admin.analytics_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete cascade,
 anonymous_id uuid,
 event_name text not null check(event_name in ('page_view','login_completed','area_created','deck_created')),
 path text check(path in ('/','/login','/home','/areas','/settings')),
 created_at timestamptz not null default now(),
 entity_id text,
 check (user_id is not null or anonymous_id is not null)
);
alter table brains_admin.analytics_events enable row level security;
revoke all on brains_admin.analytics_events from public,anon,authenticated;
create index analytics_events_time on brains_admin.analytics_events(created_at);
create index analytics_events_journey on brains_admin.analytics_events(anonymous_id,created_at) where anonymous_id is not null;
create index analytics_events_user on brains_admin.analytics_events(user_id,created_at) where user_id is not null;
create unique index analytics_events_entity on brains_admin.analytics_events(user_id,event_name,entity_id) where entity_id is not null;
create table brains_admin.config (singleton boolean primary key default true check(singleton),started_at timestamptz not null default now());
alter table brains_admin.config enable row level security;
revoke all on brains_admin.config from public,anon,authenticated;
insert into brains_admin.config default values;

create function brains_admin.allowed() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until<now()));
$$;
revoke all on function brains_admin.allowed() from public,anon;
grant execute on function brains_admin.allowed() to authenticated;
create function public.brains_admin_access() returns boolean language sql stable security invoker set search_path='' as $$ select brains_admin.allowed(); $$;
revoke all on function public.brains_admin_access() from public,anon;
grant execute on function public.brains_admin_access() to authenticated;

-- The visitor UUID is an unguessable browser secret. No API reads or enumerates it.
-- Authenticated ownership is derived from auth.uid(), never from a request parameter.
create function brains_admin.track(p_id uuid,p_anonymous_id uuid,p_event text,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if p_id is null or p_anonymous_id is null or p_event not in ('page_view','login_completed') or p_event is null then raise exception 'invalidEvent'; end if;
 if p_path is null or p_path not in ('/','/login','/home','/areas','/settings') then raise exception 'invalidPath'; end if;
 if p_event='login_completed' and (who is null or p_path<>'/login') then raise exception 'authenticationRequired'; end if;
 if who is null and p_path not in ('/','/login') then raise exception 'authenticationRequired'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_anonymous_id::text,1));
 if exists(select 1 from brains_admin.analytics_events where anonymous_id=p_anonymous_id and user_id is not null and user_id is distinct from who) then raise exception 'visitorChanged'; end if;
 -- Bound accidental/client abuse per visitor; no PII, referrer, query or token stored.
 if (select count(*) from brains_admin.analytics_events where anonymous_id=p_anonymous_id and created_at>now()-interval '1 minute')>=60 then return; end if;
 if p_event='login_completed' and exists(select 1 from brains_admin.analytics_events where anonymous_id=p_anonymous_id and event_name='login_completed' and user_id=who) then return; end if;
 insert into brains_admin.analytics_events(id,user_id,anonymous_id,event_name,path) values(p_id,who,p_anonymous_id,p_event,p_path) on conflict(id) do nothing;
end $$;
revoke all on function brains_admin.track(uuid,uuid,text,text) from public;
grant execute on function brains_admin.track(uuid,uuid,text,text) to anon,authenticated;
create function public.brains_track_event(p_id uuid,p_anonymous_id uuid,p_event text,p_path text) returns void language sql security invoker set search_path='' as $$ select brains_admin.track(p_id,p_anonymous_id,p_event,p_path); $$;
revoke all on function public.brains_track_event(uuid,uuid,text,text) from public;
grant execute on function public.brains_track_event(uuid,uuid,text,text) to anon,authenticated;

-- Only missing creation dates are recorded. Cards/reviews are read from their source.
create function brains_admin.capture_creation() returns trigger language plpgsql security definer set search_path='' as $$
declare before_doc jsonb:='{}'; group_name text;
begin
 if TG_OP='UPDATE' then before_doc:=old.document; end if;
 foreach group_name in array array['areas','decks'] loop
  insert into brains_admin.analytics_events(user_id,event_name,entity_id)
  select new.user_id,case group_name when 'areas' then 'area_created' else 'deck_created' end,item->>'id'
  from jsonb_array_elements(new.document->group_name) item
  where item->>'id' is not null and item->>'deleted'='false'
   and not exists(select 1 from jsonb_array_elements(coalesce(before_doc->group_name,'[]')) previous where previous->>'id'=item->>'id')
  on conflict(user_id,event_name,entity_id) where entity_id is not null do nothing;
 end loop;
 return new;
end $$;
revoke all on function brains_admin.capture_creation() from public,anon,authenticated;
create trigger brains_analytics_creation after insert or update of document on public.brains_cloud for each row execute function brains_admin.capture_creation();

-- Tolerate malformed historical timestamps without changing a user's library.
create function brains_admin.safe_time(value text) returns timestamptz language plpgsql stable set search_path='' as $$
begin return value::timestamptz; exception when others then return null; end $$;
revoke all on function brains_admin.safe_time(text) from public,anon,authenticated;

create view brains_admin.activity as
 select user_id,event_name,created_at from brains_admin.analytics_events where event_name in ('area_created','deck_created')
 union all
 select c.user_id,'card_created',brains_admin.safe_time(item->>'createdAt') from public.brains_cloud c cross join lateral jsonb_array_elements(c.document->'cards') item
 union all
 select c.user_id,'card_reviewed',brains_admin.safe_time(item->>'at') from public.brains_cloud c cross join lateral jsonb_array_elements(coalesce(c.document->'reviews','[]')) item;
revoke all on brains_admin.activity from public,anon,authenticated;

create function brains_admin.overview(p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today timestamptz:=date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'; since timestamptz; result jsonb;
begin
 if not brains_admin.allowed() then raise exception 'adminRequired' using errcode='42501'; end if;
 if p_days is null or p_days not in (0,7,30,90) then raise exception 'invalidPeriod'; end if;
 since:=case when p_days=0 then least((select min(created_at) from auth.users),today) else today-make_interval(days=>p_days-1) end;
 with activity as materialized(select * from brains_admin.activity where created_at<=now()),
 totals as (select coalesce(sum((select count(*) from jsonb_array_elements(document->'areas') x where x->>'deleted'='false')),0) areas,
 coalesce(sum((select count(*) from jsonb_array_elements(document->'decks') x where x->>'deleted'='false')),0) decks from public.brains_cloud),
 growth as (select 'accounts' metric,created_at at_time from auth.users union all select case event_name when 'area_created' then 'areas' else 'decks' end,created_at from brains_admin.analytics_events where event_name in ('area_created','deck_created')),
 daily as (select (at_time at time zone 'America/Sao_Paulo')::date as day_key, count(*) filter(where metric='accounts') accounts,count(*) filter(where metric='areas') areas,count(*) filter(where metric='decks') decks from growth where at_time>=since and at_time<=now() group by 1)
 select jsonb_build_object('accounts',(select count(*) from auth.users),'areas',totals.areas,'decks',totals.decks,
 'accounts_today',(select count(*) from auth.users where created_at>=today),
 'areas_today',(select count(*) from growth where metric='areas' and at_time>=today),
 'decks_today',(select count(*) from growth where metric='decks' and at_time>=today),
 'dau',(select count(distinct user_id) from activity where created_at>=today),
 'wau',(select count(distinct user_id) from activity where created_at>=today-interval '6 days'),
 'mau',(select count(distinct user_id) from activity where created_at>=today-interval '29 days'),
 'period_active',(select count(distinct user_id) from activity where created_at>=since),
 'tracking_since',(select started_at from brains_admin.config),
 'series',(select coalesce(jsonb_agg(jsonb_build_object('day',d::date,'accounts',coalesce(g.accounts,0),'areas',coalesce(g.areas,0),'decks',coalesce(g.decks,0)) order by d),'[]') from generate_series((since at time zone 'America/Sao_Paulo')::date,(today at time zone 'America/Sao_Paulo')::date,interval '1 day') d left join daily g on g.day_key=d::date)) into result from totals;
 return result;
end $$;
revoke all on function brains_admin.overview(integer) from public,anon;
grant execute on function brains_admin.overview(integer) to authenticated;
create function public.brains_admin_overview(p_days integer default 30) returns jsonb language sql stable security invoker set search_path='' as $$ select brains_admin.overview(p_days); $$;
revoke all on function public.brains_admin_overview(integer) from public,anon;
grant execute on function public.brains_admin_overview(integer) to authenticated;

create function brains_admin.funnel(p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 if not brains_admin.allowed() then raise exception 'adminRequired' using errcode='42501'; end if;
 if p_days is null or p_days not in(0,7,30,90) then raise exception 'invalidPeriod'; end if;
 since:=case when p_days=0 then '-infinity'::timestamptz else (date_trunc('day',now() at time zone 'America/Sao_Paulo')-make_interval(days=>p_days-1)) at time zone 'America/Sao_Paulo' end;
 with events as materialized(select * from brains_admin.analytics_events where created_at>=since and created_at<=now()),
 landing as (select anonymous_id,min(created_at) at_time from events where event_name='page_view' and path='/' group by anonymous_id),
 login as (select l.anonymous_id,min(e.created_at) at_time from landing l join events e on e.anonymous_id=l.anonymous_id and e.created_at>=l.at_time and e.path='/login' and e.event_name='page_view' group by l.anonymous_id),
 authed as (select l.anonymous_id,min(e.created_at) at_time from login l join events e on e.anonymous_id=l.anonymous_id and e.created_at>=l.at_time and e.event_name='login_completed' group by l.anonymous_id),
 home as (select l.anonymous_id from authed l join events e on e.anonymous_id=l.anonymous_id and e.created_at>=l.at_time and e.path='/home' and e.event_name='page_view' group by l.anonymous_id),
 active as materialized(select distinct user_id from brains_admin.activity where created_at>=since and created_at<=now()),
 pages as (select paths.path,count(e.id) views,count(distinct e.user_id) users,count(distinct e.user_id) filter(where a.user_id is not null) active_visitors from (values('/home'),('/areas'),('/settings')) paths(path) left join events e on e.path=paths.path and e.event_name='page_view' left join active a on a.user_id=e.user_id group by paths.path)
 select jsonb_build_object('steps',jsonb_build_array((select count(*) from landing),(select count(*) from login),(select count(*) from authed),(select count(*) from home)),
 'active_users',(select count(*) from active),'tracking_since',(select started_at from brains_admin.config),
 'pages',(select jsonb_agg(jsonb_build_object('path',path,'views',views,'users',users,'active_percent',case when (select count(*) from active)=0 then null else round(100.0*active_visitors/(select count(*) from active),1) end) order by path) from pages)) into result;
 return result;
end $$;
revoke all on function brains_admin.funnel(integer) from public,anon;
grant execute on function brains_admin.funnel(integer) to authenticated;
create function public.brains_admin_funnel(p_days integer default 30) returns jsonb language sql stable security invoker set search_path='' as $$ select brains_admin.funnel(p_days); $$;
revoke all on function public.brains_admin_funnel(integer) from public,anon;
grant execute on function public.brains_admin_funnel(integer) to authenticated;

create function brains_admin.users(p_search text default '',p_page integer default 0,p_user_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not brains_admin.allowed() then raise exception 'adminRequired' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>100000 or length(coalesce(p_search,''))>200 then raise exception 'invalidRequest'; end if;
 with matches as materialized(select id,email,created_at,last_sign_in_at from auth.users where (p_user_id is null or id=p_user_id) and (coalesce(p_search,'')='' or strpos(lower(email),lower(p_search))>0)),
 page as materialized(select * from matches order by created_at desc,id limit 25 offset p_page*25),
 rows as (select p.*, (select count(*) from jsonb_array_elements(coalesce(c.document->'areas','[]')) x where x->>'deleted'='false') areas,
 (select count(*) from jsonb_array_elements(coalesce(c.document->'decks','[]')) x where x->>'deleted'='false') decks,
 (select count(*) from jsonb_array_elements(coalesce(c.document->'cards','[]')) x where x->>'deleted'='false') cards,
 (select max(at_time) from (select brains_admin.safe_time(x->>'at') at_time from jsonb_array_elements(coalesce(c.document->'reviews','[]')) x union all select brains_admin.safe_time(x->>'createdAt') from jsonb_array_elements(coalesce(c.document->'cards','[]')) x union all select e.created_at from brains_admin.analytics_events e where e.user_id=p.id and e.event_name in ('area_created','deck_created')) a where at_time<=now()) last_activity
 from page p left join public.brains_cloud c on c.user_id=p.id)
 select jsonb_build_object('total',(select count(*) from matches),'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id) from rows r),'[]'),
 'recent',case when p_user_id is null then '[]'::jsonb else (select coalesce(jsonb_agg(to_jsonb(a) order by created_at desc),'[]') from (select event_name,created_at from brains_admin.activity where user_id=p_user_id and created_at<=now() order by created_at desc limit 20) a) end) into result;
 return result;
end $$;
revoke all on function brains_admin.users(text,integer,uuid) from public,anon;
grant execute on function brains_admin.users(text,integer,uuid) to authenticated;
create function public.brains_admin_users(p_search text default '',p_page integer default 0,p_user_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$ select brains_admin.users(p_search,p_page,p_user_id); $$;
revoke all on function public.brains_admin_users(text,integer,uuid) from public,anon;
grant execute on function public.brains_admin_users(text,integer,uuid) to authenticated;
