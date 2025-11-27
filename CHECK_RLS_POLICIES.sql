-- Check RLS Policies Detail
-- Run this to see what policies exist

SELECT 
    tablename as table_name,
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
        ELSE '⚠️ CHECK POLICY'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('campaigns', 'assets', 'tag_config')
ORDER BY tablename, 
    CASE cmd 
        WHEN 'r' THEN 1 
        WHEN 'a' THEN 2 
        WHEN 'w' THEN 3 
        WHEN 'd' THEN 4 
    END,
    policyname;

-- Count policies per table
SELECT 
    tablename as table_name,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 4 THEN '✅ COMPLETE'
        ELSE '⚠️ MISSING POLICIES'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('campaigns', 'assets', 'tag_config')
GROUP BY tablename
ORDER BY tablename;

-- Total policy count
SELECT 
    COUNT(*) as total_policies,
    CASE 
        WHEN COUNT(*) >= 12 THEN '✅ SUFFICIENT'
        ELSE '⚠️ NEED MORE POLICIES'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('campaigns', 'assets', 'tag_config');


