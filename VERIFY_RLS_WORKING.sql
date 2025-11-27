-- Verify RLS is working correctly
-- Check the actual policy definitions

-- 1. Check policy definitions in detail
SELECT 
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN cmd = 'r' THEN 'SELECT'
        WHEN cmd = 'a' THEN 'INSERT'
        WHEN cmd = 'w' THEN 'UPDATE'
        WHEN cmd = 'd' THEN 'DELETE'
    END as cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'campaigns'
ORDER BY cmd;

-- 2. Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'campaigns';

-- 3. Check current role (should be authenticated, not postgres)
SELECT current_user, session_user;

-- 4. Check if auth.uid() function works
SELECT auth.uid() as current_auth_uid;

-- IMPORTANT: If you're running queries as 'postgres' role, RLS policies won't work!
-- You need to run queries as the authenticated user.
-- In Supabase SQL Editor, make sure you're not using "postgres" role.


