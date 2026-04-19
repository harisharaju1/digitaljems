-- Migration: Custom job notification triggers
-- Phase 3 of Feature 2 — End-to-End Custom Order Pipeline
--
-- Prerequisites:
--   1. pg_net must be enabled on this Supabase project (Dashboard → Database → Extensions)
--   2. Set DB parameters before running:
--        ALTER DATABASE postgres SET "app.settings.supabase_url" = 'https://YOUR_PROJECT.supabase.co';
--        ALTER DATABASE postgres SET "app.settings.service_role_key" = 'YOUR_SERVICE_ROLE_KEY';
--   3. Deploy the custom-job-notify edge function first

-- CONCEPT: pg_net extension — allows SQL to make async HTTP calls without blocking the transaction
CREATE EXTENSION IF NOT EXISTS pg_net;

-- CONCEPT: trigger function — one function reused by two separate triggers (jobs + milestones)
CREATE OR REPLACE FUNCTION notify_custom_job_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id UUID;
  v_event  TEXT;
BEGIN
  -- Determine job_id and event type based on which table fired this trigger
  IF TG_TABLE_NAME = 'custom_jobs' THEN
    v_job_id := NEW.id;
    v_event  := 'status_change';
  ELSE
    v_job_id := NEW.job_id;
    v_event  := 'milestone_completed';
  END IF;

  -- CONCEPT: pg_net.http_post — fires and forgets; returns a job ID, not the HTTP response.
  -- The edge function call is enqueued asynchronously; the UPDATE commit is not delayed.
  -- This means: at-least-once delivery. If the function crashes, the DB write still committed.
  PERFORM net.http_post(
    url     := current_setting('app.settings.supabase_url', true) || '/functions/v1/custom-job-notify',
    body    := json_build_object('job_id', v_job_id, 'event', v_event)::text,
    headers := json_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )::jsonb
  );

  RETURN NEW;
END;
$$;

-- Trigger on job status changes only (not all column updates)
-- CONCEPT: WHEN clause — prevents the trigger from firing on unrelated column updates
CREATE TRIGGER trg_custom_job_status_notify
  AFTER UPDATE OF status ON custom_jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_custom_job_update();

-- Trigger on milestone completions only (status transitions to 'done')
CREATE TRIGGER trg_milestone_status_notify
  AFTER UPDATE OF status ON custom_job_milestones
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done')
  EXECUTE FUNCTION notify_custom_job_update();
