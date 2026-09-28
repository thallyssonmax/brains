-- Deduplicate authenticated visitors across browsers and allow later authentication journeys.
create or replace function brains_admin.track(p_id uuid,p_anonymous_id uuid,p_event text,p_path text) returns void language plpgsql security definer set search_path='' as $$
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
 insert into brains_admin.analytics_events(id,user_id,anonymous_id,event_name,path) values(p_id,who,p_anonymous_id,p_event,p_path) on conflict(id) do nothing;
end $$;

create or replace function brains_admin.funnel(p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 if not brains_admin.allowed() then raise exception 'adminRequired' using errcode='42501'; end if;
 if p_days is null or p_days not in(0,7,30,90) then raise exception 'invalidPeriod'; end if;
 since:=case when p_days=0 then '-infinity'::timestamptz else (date_trunc('day',now() at time zone 'America/Sao_Paulo')-make_interval(days=>p_days-1)) at time zone 'America/Sao_Paulo' end;
 with identities as (select anonymous_id,max(user_id::text) user_key from brains_admin.analytics_events where anonymous_id is not null and user_id is not null group by anonymous_id),
 events as materialized(select e.*,coalesce(i.user_key,e.anonymous_id::text) subject from brains_admin.analytics_events e left join identities i on i.anonymous_id=e.anonymous_id where e.created_at>=since and e.created_at<=now()),
 landing as (select subject,min(created_at) at_time from events where event_name='page_view' and path='/' group by subject),
 login as (select l.subject,min(e.created_at) at_time from landing l join events e on e.subject=l.subject and e.created_at>=l.at_time and e.path='/login' and e.event_name='page_view' group by l.subject),
 authed as (select l.subject,min(e.created_at) at_time from login l join events e on e.subject=l.subject and e.created_at>=l.at_time and e.event_name='login_completed' group by l.subject),
 home as (select l.subject from authed l join events e on e.subject=l.subject and e.created_at>=l.at_time and e.path='/home' and e.event_name='page_view' group by l.subject),
 active as materialized(select distinct user_id from brains_admin.activity where created_at>=since and created_at<=now()),
 pages as (select paths.path,count(e.id) views,count(distinct e.user_id) users,count(distinct e.user_id) filter(where a.user_id is not null) active_visitors from (values('/home'),('/areas'),('/settings')) paths(path) left join events e on e.path=paths.path and e.event_name='page_view' left join active a on a.user_id=e.user_id group by paths.path)
 select jsonb_build_object('steps',jsonb_build_array((select count(*) from landing),(select count(*) from login),(select count(*) from authed),(select count(*) from home)),
 'active_users',(select count(*) from active),'tracking_since',(select started_at from brains_admin.config),
 'pages',(select jsonb_agg(jsonb_build_object('path',path,'views',views,'users',users,'active_percent',case when (select count(*) from active)=0 then null else round(100.0*active_visitors/(select count(*) from active),1) end) order by path) from pages)) into result;
 return result;
end $$;
