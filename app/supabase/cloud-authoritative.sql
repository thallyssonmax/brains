create table public.brains_cloud (
 user_id uuid primary key references auth.users(id), version bigint not null check(version>0),
 document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<10485760),
 updated_at timestamptz not null default now()
);
create table public.brains_cloud_operations (
 user_id uuid not null references auth.users(id), operation_id uuid not null,
 payload_hash text not null, created_at timestamptz not null default now(), primary key(user_id,operation_id)
);
alter table public.brains_cloud enable row level security;
alter table public.brains_cloud_operations enable row level security;
revoke all on public.brains_cloud, public.brains_cloud_operations from anon;
grant select,insert,update on public.brains_cloud to authenticated;
grant select,insert on public.brains_cloud_operations to authenticated;
create policy brains_cloud_owner on public.brains_cloud for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy brains_cloud_operations_owner on public.brains_cloud_operations for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.brains_cloud_save(expected_version bigint, operation_id uuid, payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare who uuid:=auth.uid(); current_row public.brains_cloud; previous_hash text;
begin
 if who is null then raise exception 'authenticationRequired'; end if;
 if operation_id is null or expected_version<0 then raise exception 'invalidRequest'; end if;
 if payload->>'schema' is distinct from '1' or jsonb_typeof(payload->'cards') is distinct from 'array' or jsonb_typeof(payload->'areas') is distinct from 'array' or jsonb_typeof(payload->'decks') is distinct from 'array' or jsonb_typeof(payload->'preferences') is distinct from 'object' then raise exception 'invalidLibrary'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(who::text,0));
 select * into current_row from public.brains_cloud where user_id=who;
 select o.payload_hash into previous_hash from public.brains_cloud_operations o where o.user_id=who and o.operation_id=brains_cloud_save.operation_id;
 if previous_hash is not null then
  if previous_hash<>md5(payload::text) then raise exception 'operationMismatch'; end if;
  return jsonb_build_object('version',current_row.version,'document',current_row.document);
 end if;
 if coalesce(current_row.version,0)<>expected_version then raise exception 'conflict'; end if;
 insert into public.brains_cloud(user_id,version,document) values(who,expected_version+1,payload)
 on conflict(user_id) do update set version=excluded.version,document=excluded.document,updated_at=now()
 returning * into current_row;
 insert into public.brains_cloud_operations(user_id,operation_id,payload_hash) values(who,operation_id,md5(payload::text));
 return jsonb_build_object('version',current_row.version,'document',current_row.document);
end $$;
revoke all on function public.brains_cloud_save(bigint,uuid,jsonb) from public,anon;
grant execute on function public.brains_cloud_save(bigint,uuid,jsonb) to authenticated;
