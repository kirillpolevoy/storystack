-- Check for any remaining references to tag_config.user_id
-- Run this in Supabase SQL Editor

-- 1. Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tag_config'
ORDER BY ordinal_position;

-- 2. Check for views that reference tag_config
SELECT 
  table_name as view_name,
  view_definition
FROM information_schema.views
WHERE view_definition LIKE '%tag_config%'
  AND view_definition LIKE '%user_id%';

-- 3. Check for triggers on tag_config
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'tag_config';

-- 4. Check for functions that reference tag_config.user_id
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%tag_config%'
  AND routine_definition LIKE '%user_id%';

-- 5. Check constraints
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'tag_config';

-- 6. Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'tag_config';

