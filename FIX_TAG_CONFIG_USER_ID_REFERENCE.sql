-- Fix any remaining references to tag_config.user_id
-- Run this in Supabase SQL Editor

-- 1. Verify user_id column is dropped
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'tag_config' AND column_name = 'user_id';
-- Should return 0 rows

-- 2. Check for any views that might reference user_id
DO $$
DECLARE
  view_rec RECORD;
BEGIN
  FOR view_rec IN 
    SELECT viewname, definition 
    FROM pg_views 
    WHERE schemaname = 'public' 
      AND definition LIKE '%tag_config%'
      AND definition LIKE '%user_id%'
  LOOP
    RAISE NOTICE 'Found view referencing tag_config.user_id: %', view_rec.viewname;
    RAISE NOTICE 'Definition: %', view_rec.definition;
  END LOOP;
END $$;

-- 3. Check for any materialized views
DO $$
DECLARE
  matview_rec RECORD;
BEGIN
  FOR matview_rec IN 
    SELECT matviewname, definition 
    FROM pg_matviews 
    WHERE schemaname = 'public' 
      AND definition LIKE '%tag_config%'
      AND definition LIKE '%user_id%'
  LOOP
    RAISE NOTICE 'Found materialized view referencing tag_config.user_id: %', matview_rec.matviewname;
  END LOOP;
END $$;

-- 4. Check for any functions that reference tag_config.user_id
DO $$
DECLARE
  func_rec RECORD;
BEGIN
  FOR func_rec IN 
    SELECT proname, prosrc 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND prosrc LIKE '%tag_config%'
      AND prosrc LIKE '%user_id%'
  LOOP
    RAISE NOTICE 'Found function referencing tag_config.user_id: %', func_rec.proname;
  END LOOP;
END $$;

-- 5. Verify tag_config structure is correct
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tag_config'
ORDER BY ordinal_position;

-- 6. If user_id column still exists (shouldn't), drop it
-- ALTER TABLE tag_config DROP COLUMN IF EXISTS user_id;

-- 7. Verify workspace_id exists and is NOT NULL
SELECT 
  COUNT(*) as total_rows,
  COUNT(workspace_id) as rows_with_workspace_id,
  COUNT(*) - COUNT(workspace_id) as rows_missing_workspace_id
FROM tag_config;

-- 8. Check unique constraint
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'tag_config'
  AND constraint_type = 'UNIQUE';

