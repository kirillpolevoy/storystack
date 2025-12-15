-- Create a function to poll and process completed OpenAI batches
-- This uses pg_cron (Supabase's built-in cron extension)

-- First, enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function that finds pending batches and processes them
CREATE OR REPLACE FUNCTION poll_openai_batches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_record RECORD;
  edge_function_url TEXT;
BEGIN
  -- Get unique batch_ids that are still pending (have assets with openai_batch_id set)
  -- Check batches immediately (client-side handles 2-second polling, this is backup)
  FOR batch_record IN
    SELECT DISTINCT openai_batch_id as batch_id
    FROM assets
    WHERE openai_batch_id IS NOT NULL
      AND auto_tag_status = 'pending'
    LIMIT 10  -- Process up to 10 batches per run
  LOOP
    -- Call the edge function to check and process this batch
    -- Note: This requires the edge function URL - you'll need to set this
    -- You can get it from: supabase functions list
    edge_function_url := current_setting('app.edge_function_url', true);
    
    IF edge_function_url IS NULL OR edge_function_url = '' THEN
      -- Fallback: construct URL from project reference
      -- You'll need to set this in your database settings or environment
      RAISE NOTICE 'Edge function URL not configured. Set app.edge_function_url setting.';
      CONTINUE;
    END IF;
    
    -- Make HTTP request to edge function
    -- Note: pg_net extension is needed for HTTP requests from PostgreSQL
    PERFORM net.http_get(
      url := edge_function_url || '/auto_tag_asset?batch_id=' || batch_record.batch_id,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      )
    );
    
    RAISE NOTICE 'Polled batch: %', batch_record.batch_id;
  END LOOP;
END;
$$;

-- Schedule the function to run every minute (minimum interval for pg_cron)
-- Note: pg_cron has a 1-minute minimum, so we can't do 2 seconds server-side
-- For 2-second polling, use client-side polling (pollBatchStatus.ts)
SELECT cron.schedule(
  'poll-openai-batches',           -- Job name
  '* * * * *',                     -- Every 1 minute (minimum for pg_cron)
  $$SELECT poll_openai_batches()$$ -- Function to run
);

-- For true 2-second polling, you need client-side polling or a different approach
-- Client-side polling in pollBatchStatus.ts is set to 2 seconds

-- View scheduled jobs
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('poll-openai-batches');
