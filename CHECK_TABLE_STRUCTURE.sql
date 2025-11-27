-- Diagnostic Script: Check Current Table Structure
-- Run this to see what columns exist before running migrations

-- 1. Check campaigns table structure
SELECT 
    'campaigns' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'campaigns'
ORDER BY ordinal_position;

-- 2. Check assets table structure
SELECT 
    'assets' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'assets'
ORDER BY ordinal_position;

-- 3. Check tag_config table structure
SELECT 
    'tag_config' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tag_config'
ORDER BY ordinal_position;

-- 4. Check primary keys
SELECT 
    tc.table_name,
    kc.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kc 
    ON tc.constraint_name = kc.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('campaigns', 'assets', 'tag_config')
ORDER BY tc.table_name;

-- 5. Check foreign keys
SELECT
    tc.table_name,
    kc.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kc
    ON tc.constraint_name = kc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('campaigns', 'assets', 'tag_config');

-- 6. Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('campaigns', 'assets', 'tag_config');

-- 7. Count rows with NULL user_id (if column exists)
SELECT 
    'campaigns' as table_name,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_id_count,
    COUNT(*) as total_rows
FROM campaigns
UNION ALL
SELECT 
    'assets' as table_name,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_id_count,
    COUNT(*) as total_rows
FROM assets
WHERE EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'assets' AND column_name = 'user_id')
UNION ALL
SELECT 
    'tag_config' as table_name,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_id_count,
    COUNT(*) as total_rows
FROM tag_config
WHERE EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'tag_config' AND column_name = 'user_id');


