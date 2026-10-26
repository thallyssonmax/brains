-- Repair the legacy candidate function after V4 appended email_confirmed_at
-- to brains_admin.user_journey. Keep all existing campaign rules unchanged.
do $$
declare
  definition text;
  old_fragment text := 'select j.*,u.email_confirmed_at,u.banned_until,';
  new_fragment text := 'select j.*,u.banned_until,';
begin
  select pg_get_functiondef('public.brains_engagement_candidates_v3()'::regprocedure)
    into definition;

  if position(old_fragment in definition) > 0 then
    definition := replace(definition, old_fragment, new_fragment);
    execute definition;
  elsif position(new_fragment in definition) = 0 then
    raise exception 'Unexpected brains_engagement_candidates_v3 definition; refusing to patch';
  end if;
end
$$;
