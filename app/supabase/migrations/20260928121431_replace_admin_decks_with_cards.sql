-- Present the current user-facing hierarchy: areas contain cards. Legacy deck
-- records remain stored for compatibility but are no longer an Admin metric.
create or replace function brains_admin.overview(p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today timestamptz:=date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'; since timestamptz; result jsonb;
begin
 if not brains_admin.allowed() then raise exception 'adminRequired' using errcode='42501'; end if;
 if p_days is null or p_days not in (0,7,30,90) then raise exception 'invalidPeriod'; end if;
 since:=case when p_days=0 then least((select min(created_at) from auth.users),today) else today-make_interval(days=>p_days-1) end;
 with activity as materialized(select * from brains_admin.activity where created_at<=now()),
 totals as (select
  coalesce(sum((select count(*) from jsonb_array_elements(coalesce(document->'areas','[]')) x where x->>'deleted'='false')),0) areas,
  coalesce(sum((select count(*) from jsonb_array_elements(coalesce(document->'cards','[]')) x where x->>'deleted'='false')),0) cards
  from public.brains_cloud),
 growth as (
  select 'accounts' metric,created_at at_time from auth.users
  union all select 'areas',created_at from brains_admin.analytics_events where event_name='area_created'
  union all select 'cards',brains_admin.safe_time(item->>'createdAt')
   from public.brains_cloud c cross join lateral jsonb_array_elements(coalesce(c.document->'cards','[]')) item
   where item->>'deleted'='false'
 ),
 daily as (select (at_time at time zone 'America/Sao_Paulo')::date as day_key,
  count(*) filter(where metric='accounts') accounts,
  count(*) filter(where metric='areas') areas,
  count(*) filter(where metric='cards') cards
  from growth where at_time>=since and at_time<=now() group by 1)
 select jsonb_build_object(
 'accounts',(select count(*) from auth.users),'areas',totals.areas,'cards',totals.cards,
 'accounts_today',(select count(*) from auth.users where created_at>=today),
 'areas_today',(select count(*) from growth where metric='areas' and at_time>=today and at_time<=now()),
 'cards_today',(select count(*) from growth where metric='cards' and at_time>=today and at_time<=now()),
 'dau',(select count(distinct user_id) from activity where created_at>=today),
 'wau',(select count(distinct user_id) from activity where created_at>=today-interval '6 days'),
 'mau',(select count(distinct user_id) from activity where created_at>=today-interval '29 days'),
 'period_active',(select count(distinct user_id) from activity where created_at>=since),
 'tracking_since',(select started_at from brains_admin.config),
 'series',(select coalesce(jsonb_agg(jsonb_build_object('day',d::date,'accounts',coalesce(g.accounts,0),'areas',coalesce(g.areas,0),'cards',coalesce(g.cards,0)) order by d),'[]')
  from generate_series((since at time zone 'America/Sao_Paulo')::date,(today at time zone 'America/Sao_Paulo')::date,interval '1 day') d
  left join daily g on g.day_key=d::date)) into result from totals;
 return result;
end $$;

revoke all on function brains_admin.overview(integer) from public,anon;
grant execute on function brains_admin.overview(integer) to authenticated;
