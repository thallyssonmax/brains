create table public.brains_media_gc (
 user_id uuid not null references auth.users(id), path text not null,
 claimed boolean not null default false, completed boolean not null default false,
 queued_at timestamptz not null default now(), primary key(user_id,path),
 check(split_part(path,'/',1)=user_id::text and array_length(string_to_array(path,'/'),1)=2)
);
alter table public.brains_media_gc enable row level security;
revoke all on public.brains_media_gc from anon;
grant select,insert,update on public.brains_media_gc to authenticated;
create policy brains_media_gc_owner on public.brains_media_gc for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function public.brains_media_paths(doc jsonb) returns table(path text)
language sql immutable security invoker set search_path='' as $$
 select distinct item.value #>> '{}'
 from jsonb_array_elements(coalesce(doc->'cards','[]'::jsonb)) c,
 lateral (values(c->'front'),(c->'back')) side(value),
 lateral (values(side.value->'imagePath'),(side.value->'audioPath')) item(value)
 where jsonb_typeof(item.value)='string' and item.value #>> '{}' <> ''
$$;
revoke all on function public.brains_media_paths(jsonb) from public,anon;
grant execute on function public.brains_media_paths(jsonb) to authenticated;

create function public.brains_track_media() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
 if exists(select 1 from public.brains_media_paths(new.document) p
  where split_part(p.path,'/',1)<>new.user_id::text
  or array_length(string_to_array(p.path,'/'),1)<>2) then raise exception 'mediaOwnerMismatch'; end if;
 if exists(select 1 from public.brains_media_paths(new.document) p
  join public.brains_media_gc g on g.user_id=new.user_id and g.path=p.path where g.claimed)
 then raise exception 'mediaRetired'; end if;
 if tg_op='UPDATE' then
  insert into public.brains_media_gc(user_id,path)
  select new.user_id,p.path from public.brains_media_paths(old.document) p
  where not exists(select 1 from public.brains_media_paths(new.document) n where n.path=p.path)
  on conflict on constraint brains_media_gc_pkey do nothing;
 end if;
 return new;
end $$;
revoke all on function public.brains_track_media() from public,anon;
create trigger brains_track_media before insert or update on public.brains_cloud
for each row execute function public.brains_track_media();

create function public.brains_claim_media_gc() returns table(path text)
language plpgsql security invoker set search_path='' as $$
declare who uuid:=auth.uid(); doc jsonb;
begin
 if who is null then raise exception 'authenticationRequired'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(who::text,0));
 select document into doc from public.brains_cloud where user_id=who;
 if doc is null then return; end if;
 -- Recover abandoned uploads, including older clients, without touching recent uploads.
 insert into public.brains_media_gc(user_id,path)
 select who,s.name from storage.objects s where s.bucket_id='brains-media'
 and split_part(s.name,'/',1)=who::text and array_length(string_to_array(s.name,'/'),1)=2
 and s.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.brains_media_paths(doc) p where p.path=s.name)
 order by s.created_at limit 50 on conflict on constraint brains_media_gc_pkey do nothing;
 return query
 update public.brains_media_gc g set claimed=true where g.user_id=who and g.path in (
  select q.path from public.brains_media_gc q where q.user_id=who and not q.completed
  and not exists(select 1 from public.brains_media_paths(doc) p where p.path=q.path)
  order by q.queued_at,q.path limit 50
 ) returning g.path;
end $$;
create function public.brains_finish_media_gc(target_path text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authenticationRequired'; end if;
 if exists(select 1 from storage.objects where bucket_id='brains-media' and name=target_path)
 then raise exception 'mediaCleanupPending'; end if;
 update public.brains_media_gc set completed=true
 where user_id=auth.uid() and path=target_path and claimed;
end $$;
revoke all on function public.brains_claim_media_gc(),public.brains_finish_media_gc(text) from public,anon;
grant execute on function public.brains_claim_media_gc(),public.brains_finish_media_gc(text) to authenticated;

create policy brains_media_delete_retired on storage.objects for delete to authenticated using (
 bucket_id='brains-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.brains_media_gc g where g.user_id=(select auth.uid()) and g.path=name and g.claimed)
 and not exists(select 1 from public.brains_cloud c, lateral public.brains_media_paths(c.document) p
 where c.user_id=(select auth.uid()) and p.path=name)
);
create policy brains_media_no_reupload_retired on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'brains-media' or not exists (
 select 1 from public.brains_media_gc g where g.user_id=(select auth.uid()) and g.path=name and g.claimed
));

