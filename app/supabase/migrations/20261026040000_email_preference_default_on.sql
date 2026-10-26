-- Email preference starts enabled; an explicit saved opt-out is never overwritten.
-- Engagement delivery remains separately locked in the server code.
alter table brains_admin.email_preferences
 alter column engagement_enabled set default true;

insert into brains_admin.email_preferences(user_id,engagement_enabled)
select id,true from auth.users
on conflict(user_id) do nothing;

create or replace function brains_admin.capture_signup_email_consent() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into brains_admin.email_preferences(user_id,engagement_enabled)
 values(new.id,case when new.raw_user_meta_data->>'brains_engagement_opt_in'='false' then false else true end)
 on conflict(user_id) do nothing;
 return new;
exception when others then
 raise log 'Brains signup email preference capture failed (SQLSTATE %)',sqlstate;
 return new;
end $$;

create or replace function public.brains_email_consent(p_enabled boolean default null)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare who uuid:=auth.uid(); current_value boolean;
begin
 if who is null then raise exception 'authenticationRequired' using errcode='42501'; end if;
 if p_enabled is null then
  insert into brains_admin.email_preferences(user_id,engagement_enabled) values(who,true)
  on conflict(user_id) do nothing;
 else
  insert into brains_admin.email_preferences(user_id,engagement_enabled) values(who,p_enabled)
  on conflict(user_id) do update set engagement_enabled=excluded.engagement_enabled,changed_at=now();
  if not p_enabled then
   update brains_admin.email_messages set status='cancelled',cancel_reason='unsubscribed',cancelled_at=now()
   where user_id=who and status='scheduled';
  end if;
 end if;
 select engagement_enabled into current_value from brains_admin.email_preferences where user_id=who;
 return coalesce(current_value,true);
end $$;

