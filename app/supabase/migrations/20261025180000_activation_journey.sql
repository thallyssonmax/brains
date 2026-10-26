-- Additive activation analytics. The library, review scheduler and existing Admin RPCs are untouched.
create table if not exists brains_admin.email_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 engagement_enabled boolean not null default false,
 changed_at timestamptz not null default now()
);
alter table brains_admin.email_preferences enable row level security;
revoke all on brains_admin.email_preferences from public, anon, authenticated;

-- The email sign-up checkbox is unchecked by default. A failed preference write
-- must never prevent the underlying Supabase Auth account from being created.
create or replace function brains_admin.capture_signup_email_consent() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.raw_user_meta_data->>'brains_engagement_opt_in'='true' then
  insert into brains_admin.email_preferences(user_id,engagement_enabled)
  values(new.id,true) on conflict(user_id) do nothing;
 end if;
 return new;
exception when others then
 raise log 'Brains signup consent capture failed (SQLSTATE %)',sqlstate;
 return new;
end $$;
revoke all on function brains_admin.capture_signup_email_consent() from public,anon,authenticated;
create trigger brains_signup_email_consent after insert on auth.users
for each row execute function brains_admin.capture_signup_email_consent();

create table if not exists brains_admin.email_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 campaign text not null check (campaign in ('welcome','first_card_72h','first_card_7d','review_pending','review_complete','reactivation')),
 occurrence_key text not null,
 status text not null check (status in ('scheduled','sending','sent','cancelled','failed','retryable','delivered','bounced','complained')),
 scheduled_at timestamptz not null,
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 cancelled_at timestamptz,
 failed_at timestamptz,
 provider_id text unique,
 cancel_reason text,
 context jsonb not null default '{}'::jsonb,
 unique(user_id,campaign,occurrence_key)
);
create index if not exists email_messages_user_time on brains_admin.email_messages(user_id,created_at desc);
create index if not exists email_messages_status_due on brains_admin.email_messages(status,scheduled_at);
alter table brains_admin.email_messages enable row level security;
revoke all on brains_admin.email_messages from public, anon, authenticated;

create table if not exists brains_admin.email_events (
 provider_event_id text primary key,
 message_id uuid not null references brains_admin.email_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_type text not null check(event_type in ('sent','delivered','opened','clicked','bounced','complained','delivery_delayed','failed')),
 happened_at timestamptz not null,
 received_at timestamptz not null default now(),
 target_url text
);
create index if not exists email_events_message_time on brains_admin.email_events(message_id,happened_at);
create index if not exists email_events_user_time on brains_admin.email_events(user_id,happened_at);
alter table brains_admin.email_events enable row level security;
revoke all on brains_admin.email_events from public, anon, authenticated;

-- Consent is opt-in. Authentication emails remain managed by Supabase Auth and are unaffected.
create or replace function public.brains_email_consent(p_enabled boolean default null)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare who uuid:=auth.uid(); current_value boolean;
begin
 if who is null then raise exception 'authenticationRequired' using errcode='42501'; end if;
 if p_enabled is not null then
  insert into brains_admin.email_preferences(user_id,engagement_enabled) values(who,p_enabled)
  on conflict(user_id) do update set engagement_enabled=excluded.engagement_enabled,changed_at=now();
  if not p_enabled then
   update brains_admin.email_messages set status='cancelled',cancel_reason='unsubscribed',cancelled_at=now()
   where user_id=who and status='scheduled';
  end if;
 end if;
 select engagement_enabled into current_value from brains_admin.email_preferences where user_id=who;
 return coalesce(current_value,false);
end $$;
revoke all on function public.brains_email_consent(boolean) from public, anon;
grant execute on function public.brains_email_consent(boolean) to authenticated;

-- Capture only milestones that cannot be reconstructed after a future permanent deletion.
-- Existing cards and reviews remain in brains_cloud and brains_admin.activity, without copies.
alter table brains_admin.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table brains_admin.analytics_events add constraint analytics_events_event_name_check
 check(event_name in ('page_view','login_completed','area_created','deck_created','first_card_created','first_review_completed','first_card_celebrated','review_session_completed'));
create unique index if not exists analytics_first_milestone_unique on brains_admin.analytics_events(user_id,event_name)
 where event_name in ('first_card_created','first_review_completed');

create or replace function brains_admin.capture_first_milestones() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_cards jsonb:='[]'::jsonb; old_reviews jsonb:='[]'::jsonb; card_item jsonb; review_item jsonb; event_time timestamptz;
begin
 if tg_op='UPDATE' then
  old_cards:=coalesce(old.document->'cards','[]'::jsonb);
  old_reviews:=coalesce(old.document->'reviews','[]'::jsonb);
 end if;
 if jsonb_array_length(coalesce(new.document->'cards','[]'::jsonb))>0 then
  update brains_admin.email_messages set status='cancelled',cancel_reason='first_card_created',cancelled_at=now()
  where user_id=new.user_id and status='scheduled' and campaign in ('welcome','first_card_72h','first_card_7d');
 end if;
 if jsonb_array_length(coalesce(new.document->'reviews','[]'::jsonb))>jsonb_array_length(old_reviews) then
  update brains_admin.email_messages set status='cancelled',cancel_reason='review_recorded',cancelled_at=now()
  where user_id=new.user_id and status='scheduled' and campaign='review_pending';
 end if;
 if jsonb_array_length(old_cards)=0 and jsonb_array_length(coalesce(new.document->'cards','[]'::jsonb))>0
    and not exists(select 1 from brains_admin.analytics_events where user_id=new.user_id and event_name='first_card_created') then
  select item into card_item from jsonb_array_elements(new.document->'cards') item
  where item->>'id' is not null order by brains_admin.safe_time(item->>'createdAt') nulls last limit 1;
  if card_item is not null then
   event_time:=brains_admin.safe_time(card_item->>'createdAt');
   insert into brains_admin.analytics_events(user_id,event_name,entity_id,created_at)
   values(new.user_id,'first_card_created',card_item->>'id',coalesce(event_time,now()))
   on conflict(user_id,event_name,entity_id) where entity_id is not null do nothing;
  end if;
 end if;
 if jsonb_array_length(old_reviews)=0 and jsonb_array_length(coalesce(new.document->'reviews','[]'::jsonb))>0
    and not exists(select 1 from brains_admin.analytics_events where user_id=new.user_id and event_name='first_review_completed') then
  select item into review_item from jsonb_array_elements(new.document->'reviews') item
  where item->>'id' is not null order by brains_admin.safe_time(item->>'at') nulls last limit 1;
  if review_item is not null then
   event_time:=brains_admin.safe_time(review_item->>'at');
   insert into brains_admin.analytics_events(user_id,event_name,entity_id,created_at)
   values(new.user_id,'first_review_completed',review_item->>'id',coalesce(event_time,now()))
   on conflict(user_id,event_name,entity_id) where entity_id is not null do nothing;
  end if;
 end if;
 return new;
exception when others then
 raise log 'Brains milestone capture failed (SQLSTATE %)',sqlstate;
 return new;
end $$;
revoke all on function brains_admin.capture_first_milestones() from public,anon,authenticated;
create trigger brains_activation_milestones after insert or update of document on public.brains_cloud
for each row execute function brains_admin.capture_first_milestones();

-- Preserve the earliest *recorded* milestone for existing libraries. Skip invalid or
-- missing timestamps instead of assigning an invented historical date.
insert into brains_admin.analytics_events(user_id,event_name,entity_id,created_at)
select user_id,'first_card_created',entity_id,at_time from (
 select c.user_id,x->>'id' entity_id,brains_admin.safe_time(x->>'createdAt') at_time,
  row_number() over(partition by c.user_id order by brains_admin.safe_time(x->>'createdAt') nulls last,x->>'id') milestone_rank
 from public.brains_cloud c cross join lateral jsonb_array_elements(coalesce(c.document->'cards','[]'::jsonb)) x
 where x->>'id' is not null
) first_card where milestone_rank=1 and at_time is not null
on conflict do nothing;

insert into brains_admin.analytics_events(user_id,event_name,entity_id,created_at)
select user_id,'first_review_completed',entity_id,at_time from (
 select c.user_id,x->>'id' entity_id,brains_admin.safe_time(x->>'at') at_time,
  row_number() over(partition by c.user_id order by brains_admin.safe_time(x->>'at') nulls last,x->>'id') milestone_rank
 from public.brains_cloud c cross join lateral jsonb_array_elements(coalesce(c.document->'reviews','[]'::jsonb)) x
 where x->>'id' is not null
) first_review where milestone_rank=1 and at_time is not null
on conflict do nothing;

-- A session is reported only after its last review has been persisted. Never grant arbitrary event insertion.
create or replace function public.brains_review_session_completed(p_session_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or p_session_id is null then raise exception 'authenticationRequired' using errcode='42501'; end if;
 if not exists(
  select 1 from public.brains_cloud c cross join lateral jsonb_array_elements(coalesce(c.document->'reviews','[]'::jsonb)) r
  where c.user_id=who and r->>'sessionId'=p_session_id::text
    and brains_admin.safe_time(r->>'at')>now()-interval '1 day'
 ) then raise exception 'reviewNotFound' using errcode='22023'; end if;
 insert into brains_admin.analytics_events(user_id,event_name,entity_id)
 values(who,'review_session_completed',p_session_id::text)
 on conflict(user_id,event_name,entity_id) where entity_id is not null do nothing;
end $$;
revoke all on function public.brains_review_session_completed(uuid) from public,anon;
grant execute on function public.brains_review_session_completed(uuid) to authenticated;

create or replace function public.brains_claim_first_card_celebration()
returns boolean language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); inserted_rows bigint;
begin
 if who is null then raise exception 'authenticationRequired' using errcode='42501'; end if;
 if not exists(select 1 from public.brains_cloud c where c.user_id=who
  and jsonb_array_length(coalesce(c.document->'cards','[]'::jsonb))>0) then return false; end if;
 insert into brains_admin.analytics_events(user_id,event_name,entity_id)
 values(who,'first_card_celebrated','first-card')
 on conflict(user_id,event_name,entity_id) where entity_id is not null do nothing;
 get diagnostics inserted_rows = row_count;
 return inserted_rows>0;
end $$;
revoke all on function public.brains_claim_first_card_celebration() from public,anon;
grant execute on function public.brains_claim_first_card_celebration() to authenticated;

-- Private read model: source timestamps are reused; unavailable history remains NULL.
create or replace view brains_admin.user_journey as
with card_times as (
 select c.user_id,brains_admin.safe_time(x->>'createdAt') at_time,x->>'id' entity_id
 from public.brains_cloud c cross join lateral jsonb_array_elements(coalesce(c.document->'cards','[]'::jsonb)) x
), review_times as (
 select c.user_id,brains_admin.safe_time(x->>'at') at_time,x->>'id' entity_id
 from public.brains_cloud c cross join lateral jsonb_array_elements(coalesce(c.document->'reviews','[]'::jsonb)) x
), firsts as (
 select u.id user_id,u.email,u.created_at signup_at,u.raw_user_meta_data->>'full_name' full_name,
  (select min(e.created_at) from brains_admin.analytics_events e where e.user_id=u.id and e.event_name='area_created') first_area_at,
  least((select min(c.at_time) from card_times c where c.user_id=u.id),
        (select min(e.created_at) from brains_admin.analytics_events e where e.user_id=u.id and e.event_name='first_card_created')) first_card_at,
  least((select min(r.at_time) from review_times r where r.user_id=u.id),
        (select min(e.created_at) from brains_admin.analytics_events e where e.user_id=u.id and e.event_name='first_review_completed')) first_review_at,
  (select min(e.created_at) from brains_admin.analytics_events e where e.user_id=u.id and e.event_name='review_session_completed') first_session_at,
  (select max(a.created_at) from brains_admin.activity a where a.user_id=u.id and a.created_at<=now()) last_activity_at,
  (select count(*) from card_times c where c.user_id=u.id) card_count
 from auth.users u
), study_days as (
 select distinct user_id,(created_at at time zone 'America/Sao_Paulo')::date study_day
 from brains_admin.activity where event_name in ('card_created','card_reviewed') and created_at<=now()
), habit as (
 select d.user_id,min(d.study_day) first_habit_day from study_days d
 where (select count(*) from study_days prior where prior.user_id=d.user_id and prior.study_day between d.study_day-6 and d.study_day)>=5
 group by d.user_id
)
select f.*,h.first_habit_day,
 case when h.first_habit_day is not null then 'habit' when f.first_review_at is not null then 'reviewed'
      when f.first_card_at is not null then 'activated' when f.first_area_at is not null then 'area_no_cards' else 'registered' end stage,
 (select m.id from brains_admin.email_messages m where m.user_id=f.user_id order by m.created_at desc limit 1) last_message_id
from firsts f left join habit h on h.user_id=f.user_id;
revoke all on brains_admin.user_journey from public,anon,authenticated;

create or replace function brains_admin.activation(p_from timestamptz default null,p_to timestamptz default null,
 p_stage text default '',p_engagement text default '',p_search text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not brains_admin.allowed() then raise exception 'adminRequired' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>100000 or length(coalesce(p_search,''))>200 or
    p_stage not in ('','registered','area_no_cards','activated','reviewed','habit','without_review') or
    p_engagement not in ('','active','inactive_7d','emailed','opened','clicked','returned_after_click','activated_after_click') or
    (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'invalidFilter' using errcode='22023'; end if;
 with cohort as materialized(select j.* from brains_admin.user_journey j
  where (p_from is null or j.signup_at>=p_from) and (p_to is null or j.signup_at<p_to)),
 last_click as (select distinct on(e.user_id) e.user_id,e.happened_at,e.message_id
  from brains_admin.email_events e join cohort c on c.user_id=e.user_id
  where e.event_type='clicked' and c.first_card_at is not null and e.happened_at<=c.first_card_at
    and e.happened_at>=c.first_card_at-interval '7 days'
  order by e.user_id,e.happened_at desc,e.provider_event_id desc),
 totals as (select count(*) registered,count(*) filter(where first_area_at is not null) area,
  count(*) filter(where first_area_at is not null and first_card_at is null) area_no_cards,
  count(*) filter(where first_card_at is not null) activated,
  count(*) filter(where first_review_at is not null) reviewed,
  count(*) filter(where first_session_at is not null) sessions,
  count(*) filter(where first_habit_day is not null) habit,
  percentile_cont(.5) within group(order by extract(epoch from first_card_at-first_area_at))
   filter(where first_area_at is not null and first_card_at>=first_area_at) median_seconds
  from cohort),
 filtered as (select c.*,m.campaign last_email,m.status last_email_status,
  (select max(e.happened_at) from brains_admin.email_events e where e.user_id=c.user_id) last_email_interaction,
  lc.message_id attributed_message_id,
  (select min(v.created_at) from brains_admin.analytics_events v join brains_admin.email_events click on click.user_id=v.user_id
   where click.user_id=c.user_id and click.event_type='clicked' and v.event_name='page_view' and v.path in ('/home','/areas')
    and v.created_at>=click.happened_at and v.created_at<click.happened_at+interval '7 days') return_at
  from cohort c left join brains_admin.email_messages m on m.id=c.last_message_id
  left join last_click lc on lc.user_id=c.user_id
  where (coalesce(p_stage,'')='' or (p_stage='without_review' and c.first_card_at is not null and c.first_review_at is null)
    or (p_stage='registered' and c.first_area_at is null)
    or (p_stage='area_no_cards' and c.first_area_at is not null and c.first_card_at is null)
    or (p_stage='activated' and c.first_card_at is not null)
    or (p_stage='reviewed' and c.first_review_at is not null)
    or (p_stage='habit' and c.first_habit_day is not null))
   and (coalesce(p_search,'')='' or c.email ilike '%'||p_search||'%' or c.full_name ilike '%'||p_search||'%')),
 engaged as (select * from filtered f where coalesce(p_engagement,'')=''
   or (p_engagement='active' and f.last_activity_at>=now()-interval '7 days')
   or (p_engagement='inactive_7d' and (f.last_activity_at is null or f.last_activity_at<now()-interval '7 days'))
   or (p_engagement='emailed' and f.last_message_id is not null)
   or (p_engagement='opened' and exists(select 1 from brains_admin.email_events e where e.user_id=f.user_id and e.event_type='opened'))
   or (p_engagement='clicked' and exists(select 1 from brains_admin.email_events e where e.user_id=f.user_id and e.event_type='clicked'))
   or (p_engagement='returned_after_click' and f.return_at is not null)
   or (p_engagement='activated_after_click' and f.attributed_message_id is not null)),
 campaigns as (select m.campaign,count(*) filter(where m.sent_at is not null) sent,
  count(distinct m.id) filter(where exists(select 1 from brains_admin.email_events e where e.message_id=m.id and e.event_type='delivered')) delivered,
  count(distinct m.id) filter(where exists(select 1 from brains_admin.email_events e where e.message_id=m.id and e.event_type='opened')) opened,
  count(distinct m.id) filter(where exists(select 1 from brains_admin.email_events e where e.message_id=m.id and e.event_type='clicked')) clicked,
  count(distinct m.user_id) filter(where lc.message_id=m.id) activated_after_click,
  count(distinct m.user_id) filter(where exists(
   select 1 from brains_admin.email_events click join brains_admin.analytics_events visit
     on visit.user_id=click.user_id and visit.event_name='page_view' and visit.path in ('/home','/areas')
      and visit.created_at>=click.happened_at and visit.created_at<click.happened_at+interval '7 days'
   where click.message_id=m.id and click.event_type='clicked')) returned_after_click
  from brains_admin.email_messages m join cohort c on c.user_id=m.user_id
  left join last_click lc on lc.message_id=m.id group by m.campaign)
 select jsonb_build_object('overview',to_jsonb(t),
  'campaigns',coalesce((select jsonb_agg(to_jsonb(c) order by c.campaign) from campaigns c),'[]'::jsonb),
  'total',(select count(*) from engaged),
  'users',coalesce((select jsonb_agg(to_jsonb(page) order by page.signup_at desc,page.user_id) from
    (select * from engaged order by signup_at desc,user_id limit 25 offset p_page*25) page),'[]'::jsonb))
 into result from totals t;
 return result;
end $$;
revoke all on function brains_admin.activation(timestamptz,timestamptz,text,text,text,integer) from public,anon;
grant execute on function brains_admin.activation(timestamptz,timestamptz,text,text,text,integer) to authenticated;
create or replace function public.brains_admin_activation(p_from timestamptz default null,p_to timestamptz default null,
 p_stage text default '',p_engagement text default '',p_search text default '',p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 select brains_admin.activation(p_from,p_to,p_stage,p_engagement,p_search,p_page);
$$;
revoke all on function public.brains_admin_activation(timestamptz,timestamptz,text,text,text,integer) from public,anon;
grant execute on function public.brains_admin_activation(timestamptz,timestamptz,text,text,text,integer) to authenticated;

create or replace function brains_admin.activation_timeline(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not brains_admin.allowed() then raise exception 'adminRequired' using errcode='42501'; end if;
 if p_user_id is null then raise exception 'invalidUser' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.at_time desc,t.kind),'[]'::jsonb) into result from (
  select 'signup' kind,u.created_at at_time,null::text detail from auth.users u where u.id=p_user_id
  union all select a.event_name,a.created_at,null from brains_admin.activity a where a.user_id=p_user_id and a.created_at<=now()
  union all select e.event_name,e.created_at,null from brains_admin.analytics_events e
   where e.user_id=p_user_id and e.event_name in ('review_session_completed','first_card_celebrated')
  union all select 'habit_consolidated',min(a.created_at),null from brains_admin.activity a
   join brains_admin.user_journey j on j.user_id=a.user_id
   where a.user_id=p_user_id and j.first_habit_day is not null and a.event_name in ('card_created','card_reviewed')
    and (a.created_at at time zone 'America/Sao_Paulo')::date=j.first_habit_day
   having count(*)>0
  union all select 'email_scheduled',m.created_at,m.campaign from brains_admin.email_messages m where m.user_id=p_user_id
  union all select 'email_sent',m.sent_at,m.campaign from brains_admin.email_messages m where m.user_id=p_user_id and m.sent_at is not null
  union all select 'email_cancelled',m.cancelled_at,m.campaign from brains_admin.email_messages m where m.user_id=p_user_id and m.cancelled_at is not null
  union all select 'email_failed',m.failed_at,m.campaign from brains_admin.email_messages m where m.user_id=p_user_id and m.failed_at is not null
  union all select 'email_'||e.event_type,e.happened_at,coalesce(e.target_url,m.campaign)
    from brains_admin.email_events e join brains_admin.email_messages m on m.id=e.message_id
    where e.user_id=p_user_id and e.event_type<>'sent'
  order by at_time desc limit 100
 ) t;
 return result;
end $$;
revoke all on function brains_admin.activation_timeline(uuid) from public,anon;
grant execute on function brains_admin.activation_timeline(uuid) to authenticated;
create or replace function public.brains_admin_activation_timeline(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select brains_admin.activation_timeline(p_user_id); $$;
revoke all on function public.brains_admin_activation_timeline(uuid) from public,anon;
grant execute on function public.brains_admin_activation_timeline(uuid) to authenticated;

-- Service-only communication operations. No library data is copied into these tables.
create or replace function public.brains_engagement_candidates()
returns table(user_id uuid,email text,first_name text,area_name text,campaign text,occurrence_key text,pending_count integer,next_due timestamptz)
language sql stable security definer set search_path='' as $$
 with schedules as (
  select c.user_id,
   least((select count(*) from jsonb_array_elements(coalesce(c.document->'cards','[]'::jsonb)) x
     where x->>'deleted'='false' and x->>'archived'='false'
      and exists(select 1 from jsonb_array_elements(coalesce(c.document->'decks','[]'::jsonb)) d
       where d->>'id'=x->>'deckId' and d->>'deleted'='false' and d->>'archived'='false'
        and exists(select 1 from jsonb_array_elements(coalesce(c.document->'areas','[]'::jsonb)) a
         where a->>'id'=d->>'areaId' and a->>'deleted'='false' and a->>'archived'='false'))
      and (x->'memory' is null or brains_admin.safe_time(x->'memory'->>'due')<=now())
      and not exists(select 1 from jsonb_array_elements(coalesce(c.document->'reviews','[]'::jsonb)) r
       where r->>'cardId'=x->>'id' and (brains_admin.safe_time(r->>'at') at time zone coalesce(c.document->'preferences'->>'timezone','America/Sao_Paulo'))::date=(now() at time zone coalesce(c.document->'preferences'->>'timezone','America/Sao_Paulo'))::date)),
     greatest(0,coalesce((c.document->'preferences'->>'goal')::integer,20)-
      (select count(distinct r->>'cardId') from jsonb_array_elements(coalesce(c.document->'reviews','[]'::jsonb)) r
       where (brains_admin.safe_time(r->>'at') at time zone coalesce(c.document->'preferences'->>'timezone','America/Sao_Paulo'))::date=(now() at time zone coalesce(c.document->'preferences'->>'timezone','America/Sao_Paulo'))::date)))::integer pending_count,
   (select min(brains_admin.safe_time(x->'memory'->>'due')) from jsonb_array_elements(coalesce(c.document->'cards','[]'::jsonb)) x
    where x->>'deleted'='false' and x->>'archived'='false' and brains_admin.safe_time(x->'memory'->>'due')>now()
     and exists(select 1 from jsonb_array_elements(coalesce(c.document->'decks','[]'::jsonb)) d
      where d->>'id'=x->>'deckId' and d->>'deleted'='false' and d->>'archived'='false'
       and exists(select 1 from jsonb_array_elements(coalesce(c.document->'areas','[]'::jsonb)) a
        where a->>'id'=d->>'areaId' and a->>'deleted'='false' and a->>'archived'='false'))) next_due
  from public.brains_cloud c
 ), state as (
  select j.*,u.email_confirmed_at,u.banned_until,
   coalesce(s.pending_count,0) pending_count,s.next_due,
   (select a->>'name' from public.brains_cloud c cross join lateral jsonb_array_elements(coalesce(c.document->'areas','[]'::jsonb)) a
    where c.user_id=j.user_id and a->>'id'=(select e.entity_id from brains_admin.analytics_events e
     where e.user_id=j.user_id and e.event_name='area_created' order by e.created_at,e.id limit 1)
    limit 1) area_name,
   (select max(m.sent_at) from brains_admin.email_messages m where m.user_id=j.user_id and m.sent_at is not null) last_sent_at,
   (select max(m.sent_at) from brains_admin.email_messages m where m.user_id=j.user_id and m.sent_at is not null and m.campaign in ('first_card_7d','reactivation')) last_reengage_at,
   (select count(*) from brains_admin.email_messages m where m.user_id=j.user_id and m.sent_at>now()-interval '7 days' and m.campaign='review_pending') reminders_7d,
   (select max(e.created_at) from brains_admin.analytics_events e where e.user_id=j.user_id and e.event_name='review_session_completed') last_session_at
  from brains_admin.user_journey j join auth.users u on u.id=j.user_id
  join brains_admin.email_preferences p on p.user_id=j.user_id and p.engagement_enabled
  left join schedules s on s.user_id=j.user_id
 ), eligible as (
  select s.*,
   case
    when first_area_at is not null and first_card_at is null and not exists(select 1 from brains_admin.email_messages m where m.user_id=s.user_id and m.campaign='welcome' and m.status not in ('cancelled','retryable')) then 'welcome'
    when first_area_at<=now()-interval '7 days' and first_card_at is null
      and (last_activity_at is null or last_activity_at<=now()-interval '7 days')
      and not exists(select 1 from brains_admin.email_messages m where m.user_id=s.user_id
       and m.campaign='first_card_7d' and m.status not in ('cancelled','retryable')) then 'first_card_7d'
    when first_area_at<=now()-interval '72 hours' and first_card_at is null and not exists(select 1 from brains_admin.email_messages m where m.user_id=s.user_id and m.campaign='first_card_72h' and m.status not in ('cancelled','retryable')) then 'first_card_72h'
    when last_session_at>=now()-interval '24 hours' and next_due is not null and pending_count=0
      and not exists(select 1 from brains_admin.email_messages m where m.user_id=s.user_id and m.campaign='review_complete' and m.created_at>=s.last_session_at) then 'review_complete'
    when first_card_at is not null and first_habit_day is null and last_activity_at<=now()-interval '7 days'
      and (last_reengage_at is null or last_reengage_at<=now()-interval '7 days') then 'reactivation'
    when first_card_at is not null and pending_count>0 and reminders_7d<3
      and (last_activity_at is null or last_activity_at<=now()-interval '24 hours') then 'review_pending'
   end campaign
  from state s where email_confirmed_at is not null and (banned_until is null or banned_until<now())
   and (last_sent_at is null or last_sent_at<=now()-interval '24 hours')
 )
 select e.user_id,e.email,
  nullif(split_part(coalesce(e.full_name,''),' ',1),'') first_name,e.area_name,e.campaign,
  case when e.campaign in ('welcome','first_card_72h') then 'first-area'
       when e.campaign='review_complete' then e.last_session_at::text
       else (now() at time zone 'America/Sao_Paulo')::date::text end occurrence_key,
  e.pending_count,e.next_due
 from eligible e where e.campaign is not null
 order by case e.campaign when 'welcome' then 1 when 'first_card_72h' then 2 when 'first_card_7d' then 3
  when 'review_pending' then 4 when 'review_complete' then 5 else 6 end,e.signup_at
 limit 50;
$$;
revoke all on function public.brains_engagement_candidates() from public,anon,authenticated;
grant execute on function public.brains_engagement_candidates() to service_role;

create or replace function public.brains_engagement_claim(p_user_id uuid,p_campaign text,p_occurrence_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record; message brains_admin.email_messages%rowtype;
begin
 if p_user_id is null then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,12));
 select * into candidate from public.brains_engagement_candidates() c
 where c.user_id=p_user_id and c.campaign=p_campaign and c.occurrence_key=p_occurrence_key;
 if not found then
  update brains_admin.email_messages set status='cancelled',cancel_reason='no_longer_eligible',cancelled_at=now()
  where user_id=p_user_id and campaign=p_campaign and occurrence_key=p_occurrence_key and status='scheduled';
  return null;
 end if;
 insert into brains_admin.email_messages(user_id,campaign,occurrence_key,status,scheduled_at,context)
 values(p_user_id,p_campaign,p_occurrence_key,'sending',now(),jsonb_build_object('area_name',candidate.area_name,'pending_count',candidate.pending_count,'next_due',candidate.next_due))
 on conflict(user_id,campaign,occurrence_key) do update set status='sending',scheduled_at=now()
  where brains_admin.email_messages.status='scheduled' or
   (brains_admin.email_messages.status='retryable' and brains_admin.email_messages.failed_at<=now()-interval '20 hours')
 returning * into message;
 if message.id is null then return null; end if;
 return jsonb_build_object('id',message.id,'user_id',p_user_id,'email',candidate.email,'first_name',candidate.first_name,
  'area_name',candidate.area_name,'campaign',p_campaign,'pending_count',candidate.pending_count,'next_due',candidate.next_due);
end $$;
revoke all on function public.brains_engagement_claim(uuid,text,text) from public,anon,authenticated;
grant execute on function public.brains_engagement_claim(uuid,text,text) to service_role;

create or replace function public.brains_engagement_mark(p_message_id uuid,p_status text,p_provider_id text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status='sent' then
  update brains_admin.email_messages set status='sent',sent_at=coalesce(sent_at,now()),provider_id=p_provider_id where id=p_message_id and status='sending';
 elsif p_status='failed' then
  update brains_admin.email_messages set status='failed',failed_at=now() where id=p_message_id and status='sending';
 elsif p_status='retryable' then
  update brains_admin.email_messages set status='retryable',failed_at=now() where id=p_message_id and status='sending';
 end if;
end $$;
revoke all on function public.brains_engagement_mark(uuid,text,text) from public,anon,authenticated;
grant execute on function public.brains_engagement_mark(uuid,text,text) to service_role;

create or replace function public.brains_engagement_webhook(p_event_id text,p_provider_id text,p_type text,p_at timestamptz,p_url text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare message brains_admin.email_messages%rowtype; normalized text;
begin
 if p_event_id is null or length(p_event_id)>200 or p_provider_id is null or p_at is null then raise exception 'invalidEvent' using errcode='22023'; end if;
 normalized:=replace(p_type,'email.','');
 if normalized not in ('sent','delivered','opened','clicked','bounced','complained','delivery_delayed','failed') then return true; end if;
 select * into message from brains_admin.email_messages where provider_id=p_provider_id;
 if not found then return false; end if;
 insert into brains_admin.email_events(provider_event_id,message_id,user_id,event_type,happened_at,target_url)
 values(p_event_id,message.id,message.user_id,normalized,p_at,left(p_url,2000)) on conflict(provider_event_id) do nothing;
 if normalized in ('delivered','bounced','complained') then
  update brains_admin.email_messages set status=normalized where id=message.id and status not in ('bounced','complained');
 end if;
 if normalized in ('bounced','complained') then
  insert into brains_admin.email_preferences(user_id,engagement_enabled) values(message.user_id,false)
  on conflict(user_id) do update set engagement_enabled=false,changed_at=now();
 end if;
 return true;
end $$;
revoke all on function public.brains_engagement_webhook(text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.brains_engagement_webhook(text,text,text,timestamptz,text) to service_role;

create or replace function public.brains_engagement_unsubscribe(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_user_id is null or not exists(select 1 from auth.users where id=p_user_id) then return; end if;
 insert into brains_admin.email_preferences(user_id,engagement_enabled) values(p_user_id,false)
 on conflict(user_id) do update set engagement_enabled=false,changed_at=now();
 update brains_admin.email_messages set status='cancelled',cancel_reason='unsubscribed',cancelled_at=now()
 where user_id=p_user_id and status='scheduled';
end $$;
revoke all on function public.brains_engagement_unsubscribe(uuid) from public,anon,authenticated;
grant execute on function public.brains_engagement_unsubscribe(uuid) to service_role;
