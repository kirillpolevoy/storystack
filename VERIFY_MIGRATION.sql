-- Comprehensive Migration Verification Script
-- Run this to verify all migration steps are complete

-- ============================================
-- 1. Check Table Structure
-- ============================================
SELECT 
    '=== TABLE STRUCTURE ===' as check_type,
    '' as table_name,
    '' as column_name,
    '' as data_type,
    '' as is_nullable;

SELECT 
    'Structure' as check_type,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('campaigns', 'assets', 'tag_config')
  AND column_name IN ('id', 'user_id')
ORDER BY table_name, column_name;

-- ============================================
-- 2. Verify user_id Column Exists and is NOT NULL
-- ============================================
SELECT 
    '=== USER_ID COLUMNS ===' as check_type,
    '' as table_name,
    '' as column_name,
    '' as is_nullable;

SELECT 
    'user_id check' as check_type,
    table_name,
    column_name,
    is_nullable,
    CASE 
        WHEN is_nullable = 'NO' THEN '✅ NOT NULL'
        ELSE '❌ NULLABLE - NEEDS FIX'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('campaigns', 'assets', 'tag_config')
  AND column_name = 'user_id'
ORDER BY table_name;

-- ============================================
-- 3. Check Primary Keys
-- ============================================
SELECT 
    '=== PRIMARY KEYS ===' as check_type,
    '' as table_name,
    '' as column_name,
    '' as constraint_name;

SELECT 
    'Primary Key' as check_type,
    tc.table_name,
    kc.column_name,
    tc.constraint_name,
    CASE 
        WHEN tc.table_name = 'tag_config' AND kc.column_name = 'user_id' THEN '✅ CORRECT'
        WHEN tc.table_name IN ('campaigns', 'assets') AND kc.column_name = 'id' THEN '✅ CORRECT'
        ELSE '⚠️ CHECK'
    END as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kc 
    ON tc.constraint_name = kc.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('campaigns', 'assets', 'tag_config')
ORDER BY tc.table_name;

-- ============================================
-- 4. Check Foreign Keys
-- ============================================
SELECT 
    '=== FOREIGN KEYS ===' as check_type,
    '' as table_name,
    '' as column_name,
    '' as references;

SELECT 
    'Foreign Key' as check_type,
    tc.table_name,
    kc.column_name,
    ccu.table_name || '(' || ccu.column_name || ')' as references,
    CASE 
        WHEN kc.column_name = 'user_id' AND ccu.table_name = 'users' THEN '✅ CORRECT'
        ELSE '⚠️ CHECK'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kc
    ON tc.constraint_name = kc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('campaigns', 'assets', 'tag_config')
ORDER BY tc.table_name;

-- ============================================
-- 5. Check Indexes
-- ============================================
SELECT 
    '=== INDEXES ===' as check_type,
    '' as index_name,
    '' as table_name,
    '' as column_name;

SELECT 
    'Index' as check_type,
    i.indexname as index_name,
    i.tablename as table_name,
    a.attname as column_name,
    CASE 
        WHEN i.indexname LIKE 'idx_%user_id%' THEN '✅ USER_ID INDEX'
        WHEN i.indexname LIKE '%pkey%' THEN 'PRIMARY KEY'
        ELSE 'OTHER'
    END as index_type
FROM pg_indexes i
JOIN pg_class c ON c.relname = i.indexname
JOIN pg_index idx ON idx.indexrelid = c.oid
JOIN pg_class t ON t.oid = idx.indrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(idx.indkey)
WHERE i.schemaname = 'public'
  AND i.tablename IN ('campaigns', 'assets', 'tag_config')
  AND (i.indexname LIKE '%user_id%' OR i.indexname LIKE '%pkey%')
ORDER BY i.tablename, i.indexname;

-- ============================================
-- 6. Check RLS Status
-- ============================================
SELECT 
    '=== RLS STATUS ===' as check_type,
    '' as table_name,
    '' as rls_enabled;

SELECT 
    'RLS Status' as check_type,
    tablename as table_name,
    CASE 
        WHEN rowsecurity THEN '✅ ENABLED'
        ELSE '❌ DISABLED - NEEDS FIX'
    END as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('campaigns', 'assets', 'tag_config')
ORDER BY tablename;

-- ============================================
-- 7. Check RLS Policies
-- ============================================
SELECT 
    '=== RLS POLICIES ===' as check_type,
    '' as table_name,
    '' as policy_name,
    '' as operation;

SELECT 
    'RLS Policy' as check_type,
    schemaname || '.' || tablename as table_name,
    policyname as policy_name,
    CASE 
        WHEN cmd = 'r' THEN 'SELECT'
        WHEN cmd = 'a' THEN 'INSERT'
        WHEN cmd = 'w' THEN 'UPDATE'
        WHEN cmd = 'd' THEN 'DELETE'
        ELSE cmd::text
    END as operation,
    CASE 
        WHEN qual::text LIKE '%auth.uid()%' THEN '✅ USER-SPECIFIC'
        ELSE '⚠️ CHECK'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('campaigns', 'assets', 'tag_config')
ORDER BY tablename, cmd, policyname;

-- ============================================
-- 8. Check for NULL user_id values
-- ============================================
SELECT 
    '=== NULL USER_ID CHECK ===' as check_type,
    '' as table_name,
    '' as null_count,
    '' as total_count;

SELECT 
    'NULL Check' as check_type,
    'campaigns' as table_name,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_count,
    COUNT(*) as total_count,
    CASE 
        WHEN COUNT(*) FILTER (WHERE user_id IS NULL) = 0 THEN '✅ NO NULLS'
        ELSE '❌ HAS NULLS - NEEDS FIX'
    END as status
FROM campaigns
UNION ALL
SELECT 
    'NULL Check' as check_type,
    'assets' as table_name,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_count,
    COUNT(*) as total_count,
    CASE 
        WHEN COUNT(*) FILTER (WHERE user_id IS NULL) = 0 THEN '✅ NO NULLS'
        ELSE '❌ HAS NULLS - NEEDS FIX'
    END as status
FROM assets
UNION ALL
SELECT 
    'NULL Check' as check_type,
    'tag_config' as table_name,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_count,
    COUNT(*) as total_count,
    CASE 
        WHEN COUNT(*) FILTER (WHERE user_id IS NULL) = 0 THEN '✅ NO NULLS'
        ELSE '❌ HAS NULLS - NEEDS FIX'
    END as status
FROM tag_config;

-- ============================================
-- 9. Check tag_config structure (should NOT have 'id' column)
-- ============================================
SELECT 
    '=== TAG_CONFIG STRUCTURE CHECK ===' as check_type,
    '' as column_name,
    '' as exists;

SELECT 
    'tag_config columns' as check_type,
    column_name,
    CASE 
        WHEN column_name = 'id' THEN '❌ SHOULD NOT EXIST'
        WHEN column_name = 'user_id' THEN '✅ EXISTS'
        ELSE 'OTHER'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tag_config'
ORDER BY column_name;

-- ============================================
-- 10. Sample Data Verification
-- ============================================
SELECT 
    '=== SAMPLE DATA ===' as check_type,
    '' as table_name,
    '' as user_id,
    '' as count;

SELECT 
    'Sample Data' as check_type,
    'campaigns' as table_name,
    user_id::text as user_id,
    COUNT(*) as count
FROM campaigns
GROUP BY user_id
ORDER BY count DESC
LIMIT 5;

SELECT 
    'Sample Data' as check_type,
    'assets' as table_name,
    user_id::text as user_id,
    COUNT(*) as count
FROM assets
GROUP BY user_id
ORDER BY count DESC
LIMIT 5;

SELECT 
    'Sample Data' as check_type,
    'tag_config' as table_name,
    user_id::text as user_id,
    COUNT(*) as count
FROM tag_config
GROUP BY user_id
ORDER BY count DESC
LIMIT 5;

-- ============================================
-- SUMMARY
-- ============================================
SELECT 
    '=== MIGRATION SUMMARY ===' as summary,
    '' as item,
    '' as status;

SELECT 
    'Summary' as summary,
    'user_id columns exist and NOT NULL (campaigns, assets, tag_config)' as item,
    CASE 
        WHEN (
            (SELECT COUNT(*) FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'campaigns'
             AND column_name = 'user_id' 
             AND is_nullable = 'NO') = 1
            AND (SELECT COUNT(*) FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'assets'
                 AND column_name = 'user_id' 
                 AND is_nullable = 'NO') = 1
            AND (SELECT COUNT(*) FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'tag_config'
                 AND column_name = 'user_id' 
                 AND is_nullable = 'NO') = 1
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status
UNION ALL
SELECT 
    'Summary' as summary,
    'tag_config uses user_id as primary key' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kc ON tc.constraint_name = kc.constraint_name
            WHERE tc.table_name = 'tag_config' 
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kc.column_name = 'user_id'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status
UNION ALL
SELECT 
    'Summary' as summary,
    'tag_config does NOT have id column' as item,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'tag_config'
            AND column_name = 'id'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status
UNION ALL
SELECT 
    'Summary' as summary,
    'RLS enabled on all tables' as item,
    CASE 
        WHEN (SELECT COUNT(*) FROM pg_tables 
              WHERE schemaname = 'public'
              AND tablename IN ('campaigns', 'assets', 'tag_config')
              AND rowsecurity) = 3
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status
UNION ALL
SELECT 
    'Summary' as summary,
    'RLS policies exist (12+ total)' as item,
    CASE 
        WHEN (SELECT COUNT(*) FROM pg_policies 
              WHERE schemaname = 'public'
              AND tablename IN ('campaigns', 'assets', 'tag_config')) >= 12
        THEN '✅ PASS'
        ELSE '⚠️ CHECK'
    END as status
UNION ALL
SELECT 
    'Summary' as summary,
    'sequences table has user_id' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'sequences'
            AND column_name = 'user_id'
            AND is_nullable = 'NO'
        ) THEN '✅ PASS'
        ELSE '⚠️ OPTIONAL'
    END as status
UNION ALL
SELECT 
    'Summary' as summary,
    'No NULL user_id values' as item,
    CASE 
        WHEN (
            (SELECT COUNT(*) FILTER (WHERE user_id IS NULL) FROM campaigns) = 0
            AND (SELECT COUNT(*) FILTER (WHERE user_id IS NULL) FROM assets) = 0
            AND (SELECT COUNT(*) FILTER (WHERE user_id IS NULL) FROM tag_config) = 0
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status;

