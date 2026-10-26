-- Brains email journey V4. Additive-only: keeps existing accounts, messages and events intact.
-- Welcome is queued only for a real confirmation event; no historical users are backfilled.
alter table brains_admin.email_messages drop constraint if exists email_messages_campaign_check;
alter table brains_admin.email_messages add constraint email_messages_campaign_check
 check (campaign in ('welcome','first_area_48h','first_card_72h','first_card_7d','review_pending','review_complete','reactivation'));

alter table brains_admin.email_events drop constraint if exists email_events_event_type_check;
alter table brains_admin.email_events add constraint email_events_event_type_check
 check (event_type in ('sent','delivered','opened','clicked','bounced','complained','delivery_delayed','failed','returned','converted_area','converted_card','converted_review','converted_session'));

create or replace function brains_admin.capture_welcome_on_confirmation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null and
    (tg_op='INSERT' or old.email_confirmed_at is null) and
    coalesce((select p.engagement_enabled from brains_admin.email_preferences p where p.user_id=new.id),
      coalesce(new.raw_user_meta_data->>'brains_engagement_opt_in','true')<>'false') then
  insert into brains_admin.email_messages(user_id,campaign,occurrence_key,status,scheduled_at,context)
  values(new.id,'welcome','signup-confirmed','scheduled',now(),'{}'::jsonb)
  on conflict(user_id,campaign,occurrence_key) do nothing;
 end if;
 return new;
exception when others then
 raise log 'Brains welcome queue failed (SQLSTATE %)',sqlstate;
 return new;
end $$;
revoke all on function brains_admin.capture_welcome_on_confirmation() from public,anon,authenticated;
drop trigger if exists brains_queue_welcome_on_confirmation on auth.users;
create trigger brains_queue_welcome_on_confirmation after insert or update of email_confirmed_at on auth.users
for each row execute function brains_admin.capture_welcome_on_confirmation();

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
      when f.first_card_at is not null then 'activated' when f.first_area_at is not null then 'area_no_cards' else case when (select u.email_confirmed_at from auth.users u where u.id=f.user_id) is not null then 'confirmed_no_area' else 'registered' end end stage,
 (select m.id from brains_admin.email_messages m where m.user_id=f.user_id order by m.created_at desc limit 1) last_message_id,
 (select u.email_confirmed_at from auth.users u where u.id=f.user_id) email_confirmed_at
from firsts f left join habit h on h.user_id=f.user_id;
revoke all on brains_admin.user_journey from public,anon,authenticated;

create or replace function brains_admin.activation(p_from timestamptz default null,p_to timestamptz default null,
 p_stage text default '',p_engagement text default '',p_search text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not brains_admin.allowed() then raise exception 'adminRequired' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>100000 or length(coalesce(p_search,''))>200 or
    p_stage not in ('','registered','confirmed_no_area','area_no_cards','activated','reviewed','habit','without_review') or
    p_engagement not in ('','active','inactive_7d','emailed','opened','clicked','returned_after_click','activated_after_click') or
    (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'invalidFilter' using errcode='22023'; end if;
 with cohort as materialized(select j.* from brains_admin.user_journey j
  where (p_from is null or j.signup_at>=p_from) and (p_to is null or j.signup_at<p_to)),
 last_click as (select distinct on(e.user_id) e.user_id,e.happened_at,e.message_id
  from brains_admin.email_events e join cohort c on c.user_id=e.user_id
  where e.event_type='converted_card'
  order by e.user_id,e.happened_at desc,e.provider_event_id desc),
 totals as (select count(*) registered,count(*) filter(where email_confirmed_at is not null) confirmed,
  count(*) filter(where email_confirmed_at is not null and first_area_at is null) confirmed_no_area,
  count(*) filter(where first_area_at is not null) area,
  count(*) filter(where first_area_at is not null and first_card_at is null) area_no_cards,
  count(*) filter(where first_card_at is not null) activated,
  count(*) filter(where first_review_at is not null) reviewed,
  count(*) filter(where first_session_at is not null) sessions,
  count(*) filter(where first_habit_day is not null) habit,
  percentile_cont(.5) within group(order by extract(epoch from first_card_at-first_area_at))
   filter(where first_area_at is not null and first_card_at>=first_area_at) median_seconds,
  percentile_cont(.5) within group(order by extract(epoch from first_area_at-email_confirmed_at))
   filter(where email_confirmed_at is not null and first_area_at>=email_confirmed_at) median_confirmed_area_seconds
  from cohort),
 filtered as (select c.*,m.campaign last_email,m.status last_email_status,
  (select max(e.happened_at) from brains_admin.email_events e where e.user_id=c.user_id) last_email_interaction,
  lc.message_id attributed_message_id,
  (select min(e.happened_at) from brains_admin.email_events e where e.user_id=c.user_id and e.event_type='returned') return_at
  from cohort c left join brains_admin.email_messages m on m.id=c.last_message_id
  left join last_click lc on lc.user_id=c.user_id
  where (coalesce(p_stage,'')='' or (p_stage='without_review' and c.first_card_at is not null and c.first_review_at is null)
    or (p_stage='registered' and c.first_area_at is null and c.email_confirmed_at is null)
    or (p_stage='confirmed_no_area' and c.first_area_at is null and c.email_confirmed_at is not null)
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
   or (p_engagement='returned_after_click' and exists(select 1 from brains_admin.email_events e where e.user_id=f.user_id and e.event_type='returned'))
   or (p_engagement='activated_after_click' and exists(select 1 from brains_admin.email_events e where e.user_id=f.user_id and e.event_type='converted_card'))),
 campaigns as (select m.campaign,count(*) filter(where m.sent_at is not null) sent,
  count(distinct m.id) filter(where exists(select 1 from brains_admin.email_events e where e.message_id=m.id and e.event_type='delivered')) delivered,
  count(distinct m.id) filter(where exists(select 1 from brains_admin.email_events e where e.message_id=m.id and e.event_type='opened')) opened,
  count(distinct m.id) filter(where exists(select 1 from brains_admin.email_events e where e.message_id=m.id and e.event_type='clicked')) clicked,
  count(distinct m.user_id) filter(where exists(select 1 from brains_admin.email_events e where e.message_id=m.id and e.event_type='converted_card')) activated_after_click,
  count(distinct m.user_id) filter(where exists(select 1 from brains_admin.email_events e where e.message_id=m.id and e.event_type='returned')) returned_after_click
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

alter function public.brains_engagement_candidates() rename to brains_engagement_candidates_v3;
create or replace function public.brains_engagement_candidates()
returns table(user_id uuid,email text,first_name text,area_name text,campaign text,occurrence_key text,pending_count integer,next_due timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 return query
 with queue as (
  select m.user_id,u.email::text email,
   nullif(split_part(regexp_replace(trim(coalesce(u.raw_user_meta_data->>'full_name','')),'\s+',' ','g'),' ',1),'') first_name,
   null::text area_name,m.campaign,m.occurrence_key,0::integer pending_count,null::timestamptz next_due,
   1::integer priority,u.created_at signup_at
  from brains_admin.email_messages m join auth.users u on u.id=m.user_id
  join brains_admin.email_preferences p on p.user_id=m.user_id and p.engagement_enabled
  where m.campaign='welcome' and m.occurrence_key='signup-confirmed'
    and (m.status='scheduled' or (m.status='retryable' and m.failed_at<=now()-interval '20 hours'))
    and m.scheduled_at<=now() and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until<now())
  union all
  select j.user_id,j.email::text,
   nullif(split_part(regexp_replace(trim(coalesce(j.full_name,'')),'\s+',' ','g'),' ',1),''),
   null::text,'first_area_48h','signup-confirmed',0::integer,null::timestamptz,
   2::integer,j.signup_at
  from brains_admin.user_journey j join auth.users u on u.id=j.user_id
  join brains_admin.email_preferences p on p.user_id=j.user_id and p.engagement_enabled
  where u.email_confirmed_at<=now()-interval '48 hours'
    and (u.banned_until is null or u.banned_until<now())
    and j.first_area_at is null
    and exists(select 1 from brains_admin.email_messages w where w.user_id=j.user_id
      and w.campaign='welcome' and w.occurrence_key='signup-confirmed' and w.sent_at is not null)
    and not exists(select 1 from public.brains_cloud c cross join lateral
      jsonb_array_elements(coalesce(c.document->'areas','[]'::jsonb)) a
      where c.user_id=j.user_id and coalesce(a->>'deleted','false')='false'
        and coalesce(a->>'archived','false')='false')
    and not exists(select 1 from brains_admin.email_messages old where old.user_id=j.user_id
      and old.campaign='first_area_48h' and old.status<>'retryable')
    and (not exists(select 1 from brains_admin.email_messages sent where sent.user_id=j.user_id and sent.sent_at is not null)
      or (select max(sent.sent_at) from brains_admin.email_messages sent where sent.user_id=j.user_id and sent.sent_at is not null)<=now()-interval '24 hours')
  union all
  select v.user_id,v.email,v.first_name,v.area_name,v.campaign,v.occurrence_key,v.pending_count,v.next_due,
   case v.campaign when 'first_card_72h' then 3 when 'first_card_7d' then 4
     when 'review_pending' then 5 when 'reactivation' then 6 when 'review_complete' then 7 else 8 end,
   j.signup_at
  from public.brains_engagement_candidates_v3() v
  join brains_admin.user_journey j on j.user_id=v.user_id
  where v.campaign<>'welcome'
 )
 select q.user_id,q.email,q.first_name,q.area_name,q.campaign,q.occurrence_key,q.pending_count,q.next_due
 from queue q order by q.priority,q.signup_at limit 50;
end $$;
revoke all on function public.brains_engagement_candidates() from public,anon,authenticated;
grant execute on function public.brains_engagement_candidates() to service_role;

create or replace function public.brains_engagement_claim(p_user_id uuid,p_campaign text,p_occurrence_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record; message brains_admin.email_messages%rowtype; area_id text;
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
 select coalesce(
  (select a->>'id' from jsonb_array_elements(coalesce(c.document->'areas','[]'::jsonb)) a
   where a->>'id'=(select e.entity_id from brains_admin.analytics_events e
    where e.user_id=p_user_id and e.event_name='area_created' order by e.created_at,e.id limit 1)
     and coalesce(a->>'deleted','false')='false' and coalesce(a->>'archived','false')='false' limit 1),
  (select x.area->>'id' from jsonb_array_elements(coalesce(c.document->'areas','[]'::jsonb)) with ordinality x(area,ord)
   where coalesce(x.area->>'deleted','false')='false' and coalesce(x.area->>'archived','false')='false'
   order by x.ord limit 1)
 ) into area_id from public.brains_cloud c where c.user_id=p_user_id;
 insert into brains_admin.email_messages(user_id,campaign,occurrence_key,status,scheduled_at,context)
 values(p_user_id,p_campaign,p_occurrence_key,'sending',now(),jsonb_build_object('area_name',candidate.area_name,'pending_count',candidate.pending_count,'next_due',candidate.next_due))
 on conflict(user_id,campaign,occurrence_key) do update set status='sending',scheduled_at=now()
  where brains_admin.email_messages.status='scheduled' or
   (brains_admin.email_messages.status='retryable' and brains_admin.email_messages.failed_at<=now()-interval '20 hours')
 returning * into message;
 if message.id is null then return null; end if;
 return jsonb_build_object('id',message.id,'user_id',p_user_id,'email',candidate.email,'first_name',candidate.first_name,
  'area_name',candidate.area_name,'area_id',area_id,'campaign',p_campaign,'pending_count',candidate.pending_count,'next_due',candidate.next_due);
end $$;
revoke all on function public.brains_engagement_claim(uuid,text,text) from public,anon,authenticated;
grant execute on function public.brains_engagement_claim(uuid,text,text) to service_role;

create or replace function public.brains_track_email_return(p_message_id uuid,p_path text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null then raise exception 'authenticationRequired' using errcode='42501'; end if;
 if p_message_id is null or p_path not in ('/home','/areas','/settings') then raise exception 'invalidEmailReturn' using errcode='22023'; end if;
 if not exists(select 1 from brains_admin.email_messages m where m.id=p_message_id and m.user_id=who and m.sent_at is not null) then
  raise exception 'emailMessageNotFound' using errcode='42501';
 end if;
 insert into brains_admin.email_events(provider_event_id,message_id,user_id,event_type,happened_at,target_url)
 values('brains-return:'||p_message_id::text,p_message_id,who,'returned',now(),left(p_path,2000))
 on conflict(provider_event_id) do nothing;
 return true;
end $$;
revoke all on function public.brains_track_email_return(uuid,text) from public,anon;
grant execute on function public.brains_track_email_return(uuid,text) to authenticated;

create or replace function public.brains_track_email_conversion(p_message_id uuid,p_stage text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare who uuid:=auth.uid(); event_name text;
begin
 if who is null then raise exception 'authenticationRequired' using errcode='42501'; end if;
 if p_message_id is null or p_stage not in ('area','card','review','session') then raise exception 'invalidEmailConversion' using errcode='22023'; end if;
 if not exists(select 1 from brains_admin.email_messages m where m.id=p_message_id and m.user_id=who and m.sent_at is not null)
   or not exists(select 1 from brains_admin.email_events e where e.message_id=p_message_id and e.user_id=who and e.event_type='returned') then
  raise exception 'emailReturnNotFound' using errcode='42501';
 end if;
 event_name:=case p_stage when 'area' then 'converted_area' when 'card' then 'converted_card'
  when 'review' then 'converted_review' else 'converted_session' end;
 insert into brains_admin.email_events(provider_event_id,message_id,user_id,event_type,happened_at,target_url)
 values('brains-conversion:'||p_stage||':'||p_message_id::text,p_message_id,who,event_name,now(),p_stage)
 on conflict(provider_event_id) do nothing;
 return true;
end $$;
revoke all on function public.brains_track_email_conversion(uuid,text) from public,anon;
grant execute on function public.brains_track_email_conversion(uuid,text) to authenticated;

notify pgrst,'reload schema';
