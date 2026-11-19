-- Reuse each account's timezone and today's reviewed card IDs once per eligibility query.
-- Avoid rescanning and decompressing the full review document once for each pending card.
-- Same results, campaign rules and existing function privileges.
CREATE OR REPLACE FUNCTION public.brains_engagement_candidates_v3()
 RETURNS TABLE(user_id uuid, email text, first_name text, area_name text, campaign text, occurrence_key text, pending_count integer, next_due timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with settings as materialized (
  select c.user_id, coalesce(c.document->'preferences'->>'timezone','America/Sao_Paulo') timezone
  from public.brains_cloud c
 ), reviewed_today as materialized (
  select c.user_id,r->>'cardId' card_id
  from public.brains_cloud c join settings t on t.user_id=c.user_id
  cross join lateral jsonb_array_elements(coalesce(c.document->'reviews','[]'::jsonb)) r
  where (brains_admin.safe_time(r->>'at') at time zone t.timezone)::date=(now() at time zone t.timezone)::date
 ), schedules as (
  select c.user_id,
   least((select count(*) from jsonb_array_elements(coalesce(c.document->'cards','[]'::jsonb)) x
     where x->>'deleted'='false' and x->>'archived'='false'
      and exists(select 1 from jsonb_array_elements(coalesce(c.document->'decks','[]'::jsonb)) d
       where d->>'id'=x->>'deckId' and d->>'deleted'='false' and d->>'archived'='false'
        and exists(select 1 from jsonb_array_elements(coalesce(c.document->'areas','[]'::jsonb)) a
         where a->>'id'=d->>'areaId' and a->>'deleted'='false' and a->>'archived'='false'))
      and (x->'memory' is null or brains_admin.safe_time(x->'memory'->>'due')<=now())
      and not exists(select 1 from reviewed_today r
       where r.user_id=c.user_id and r.card_id=x->>'id')),
     greatest(0,coalesce((c.document->'preferences'->>'goal')::integer,20)-
      (select count(distinct r.card_id) from reviewed_today r where r.user_id=c.user_id)))::integer pending_count,
   (select min(brains_admin.safe_time(x->'memory'->>'due')) from jsonb_array_elements(coalesce(c.document->'cards','[]'::jsonb)) x
    where x->>'deleted'='false' and x->>'archived'='false' and brains_admin.safe_time(x->'memory'->>'due')>now()
     and exists(select 1 from jsonb_array_elements(coalesce(c.document->'decks','[]'::jsonb)) d
      where d->>'id'=x->>'deckId' and d->>'deleted'='false' and d->>'archived'='false'
       and exists(select 1 from jsonb_array_elements(coalesce(c.document->'areas','[]'::jsonb)) a
        where a->>'id'=d->>'areaId' and a->>'deleted'='false' and a->>'archived'='false'))) next_due
  from public.brains_cloud c
 ), state as (
  select j.*,u.banned_until,
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
    when first_area_at<=now()-interval '72 hours' and first_card_at is null
      and not exists(select 1 from brains_admin.email_messages m where m.user_id=s.user_id
       and m.campaign in ('first_card_72h','first_card_7d') and m.status not in ('cancelled','retryable')) then 'first_card_72h'
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
 select e.user_id,e.email::text,
  nullif(split_part(coalesce(e.full_name,''),' ',1),'') first_name,e.area_name,e.campaign,
  case when e.campaign in ('welcome','first_card_72h') then 'first-area'
       when e.campaign='review_complete' then e.last_session_at::text
       else (now() at time zone 'America/Sao_Paulo')::date::text end occurrence_key,
  e.pending_count,e.next_due
 from eligible e where e.campaign is not null
 order by case e.campaign when 'welcome' then 1 when 'first_card_72h' then 2 when 'first_card_7d' then 3
  when 'review_pending' then 4 when 'review_complete' then 5 else 6 end,e.signup_at
 limit 50;
$function$
;

