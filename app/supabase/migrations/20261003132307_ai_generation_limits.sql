-- Additive accounting for paid AI calls. Existing libraries and study state are untouched.
create schema if not exists brains_admin;
create table brains_admin.ai_generations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 card_id uuid not null,
 kind text not null check (kind in ('sentence','image')),
 status text not null default 'pending' check (status in ('pending','done','failed')),
 created_at timestamptz not null default now()
);
alter table brains_admin.ai_generations enable row level security;
revoke all on brains_admin.ai_generations from public, anon, authenticated;
create index ai_generations_card on brains_admin.ai_generations(user_id,card_id,kind,created_at) where status in ('pending','done');
create index ai_generations_day on brains_admin.ai_generations(kind,created_at) where status in ('pending','done');

create function public.ai_generation_remaining(p_card_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
 return jsonb_build_object(
  'sentence',greatest(0,3-(select count(*) from brains_admin.ai_generations where user_id=v_user and card_id=p_card_id and kind='sentence' and status in ('pending','done'))),
  'image',greatest(0,3-(select count(*) from brains_admin.ai_generations where user_id=v_user and card_id=p_card_id and kind='image' and status in ('pending','done')))
 );
end; $$;
revoke all on function public.ai_generation_remaining(uuid) from public,anon;
grant execute on function public.ai_generation_remaining(uuid) to authenticated;

create function public.ai_generation_claim(p_card_id uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_user uuid := auth.uid();
 v_count integer;
 v_id uuid;
 v_day timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_daily_limit integer;
 v_global_limit integer;
begin
 if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
 if p_card_id is null or p_kind not in ('sentence','image') then raise exception 'invalid_generation'; end if;
 -- Serialize global daily accounting and same-card claims across devices.
 perform pg_catalog.pg_advisory_xact_lock(9500,pg_catalog.hashtext(p_kind||v_day::text));
 select count(*) into v_count from brains_admin.ai_generations where user_id=v_user and card_id=p_card_id and kind=p_kind and status in ('pending','done');
 if v_count >= 3 then raise exception 'ai_limit_card'; end if;
 if p_kind='image' then v_daily_limit:=5; v_global_limit:=100;
 else v_daily_limit:=15; v_global_limit:=300; end if;
 select count(*) into v_count from brains_admin.ai_generations where user_id=v_user and kind=p_kind and created_at>=v_day and status in ('pending','done');
 if v_count>=v_daily_limit then raise exception 'ai_limit_daily'; end if;
 select count(*) into v_count from brains_admin.ai_generations where kind=p_kind and created_at>=v_day and status in ('pending','done');
 if v_count>=v_global_limit then raise exception 'ai_limit_global'; end if;
 select count(*) into v_count from brains_admin.ai_generations where user_id=v_user and card_id=p_card_id and kind=p_kind and status in ('pending','done');
 insert into brains_admin.ai_generations(user_id,card_id,kind) values(v_user,p_card_id,p_kind) returning id into v_id;
 return jsonb_build_object('id',v_id,'remaining',2-v_count);
end; $$;
revoke all on function public.ai_generation_claim(uuid,text) from public,anon;
grant execute on function public.ai_generation_claim(uuid,text) to authenticated;

create function public.ai_generation_finish(p_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
 update brains_admin.ai_generations set status=case when p_success then 'done' else 'failed' end where id=p_id and user_id=v_user and status='pending';
end; $$;
revoke all on function public.ai_generation_finish(uuid,boolean) from public,anon;
grant execute on function public.ai_generation_finish(uuid,boolean) to authenticated;
