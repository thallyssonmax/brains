-- Deduplicate authenticated visitors across browsers and allow later authentication journeys.
create or replace function brains_admin.track(p_id uuid,p_anonymous_id uuid,p_event text,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if p_id is null or p_anonymous_id is null or p_event not in ('page_view','login_completed') or p_event is null then raise exception 'invalidEvent'; end if;
 if p_path is null or p_path not in ('/','/login','/home','/areas','/settings') then raise exception 'invalidPath'; end if;
 if p_event='login_completed' and (who is null or p_path<>'/login') then raise exception 'authenticationRequired'; end if;
 if who is null and p_path not in ('/','/login') then raise exception 'authenticationRequired'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_anonymous_id::text,1));
 if who is not null and exists(select 1 from brains_admin.analytics_events where anonymous_id=p_anonymous_id and user_id is not null and user_id is distinct from who) then raise exception 'visitorChanged'; end if;
 -- Bound accidental/client abuse per visitor; no PII, referrer, query or token stored.
 if (select count(*) from brains_admin.analytics_events where anonymous_id=p_anonymous_id and created_at>now()-interval '1 minute')>=60 then return; end if;
 insert into brains_admin.analytics_events(id,user_id,anonymous_id,event_name,path) values(p_id,who,p_anonymous_id,p_event,p_path) on conflict(id) do nothing;
end $$;

create or replace function brains_admin.capture_creation() returns trigger language plpgsql security definer set search_path='' as $$
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
exception when others then
 -- Analytics is best-effort; never interrupt a user's library save.
 raise log 'Brains analytics capture failed (SQLSTATE %)',SQLSTATE;
 return new;
end $$;
