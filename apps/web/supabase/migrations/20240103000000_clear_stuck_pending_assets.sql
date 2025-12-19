-- Clear stuck pending assets
-- This migration resets assets that have been stuck in 'pending' status
-- for more than 1 hour (likely failed or stuck edge function calls)

UPDATE assets
SET auto_tag_status = NULL
WHERE auto_tag_status = 'pending'
  AND updated_at < NOW() - INTERVAL '1 hour';

-- Optional: If you want to mark them as failed instead of clearing:
-- UPDATE assets
-- SET auto_tag_status = 'failed'
-- WHERE auto_tag_status = 'pending'
--   AND updated_at < NOW() - INTERVAL '1 hour';

COMMENT ON COLUMN assets.auto_tag_status IS 'Status of auto-tagging: pending, completed, failed, or NULL (not attempted)';


