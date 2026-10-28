-- Retain product analytics for 12 months. This does not touch account or study data.
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
    from cron.job
   where jobname = 'brains-analytics-retention-12-months';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'brains-analytics-retention-12-months',
    '25 3 * * *',
    $job$delete from brains_admin.analytics_events
          where created_at < now() - interval '12 months'$job$
  );
end;
$$;
