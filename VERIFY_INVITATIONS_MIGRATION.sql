-- Verification Script for Workspace Invitations Migration
-- Run this in your Supabase SQL Editor to verify the migration was applied correctly

-- ============================================================================
-- 1. CHECK IF TABLE EXISTS
-- ============================================================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'workspace_invitations'
    ) 
    THEN '✅ Table workspace_invitations exists'
    ELSE '❌ Table workspace_invitations does NOT exist'
  END AS table_check;

-- ============================================================================
-- 2. CHECK TABLE STRUCTURE
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'workspace_invitations'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. CHECK IF RLS IS ENABLED
-- ============================================================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'workspace_invitations'
      AND rowsecurity = true
    ) 
    THEN '✅ RLS is enabled on workspace_invitations'
    ELSE '❌ RLS is NOT enabled on workspace_invitations'
  END AS rls_check;

-- ============================================================================
-- 4. CHECK IF POLICIES EXIST
-- ============================================================================
SELECT 
  policyname AS policy_name,
  CASE 
    WHEN cmd = 'r' THEN 'SELECT'
    WHEN cmd = 'a' THEN 'INSERT'
    WHEN cmd = 'w' THEN 'UPDATE'
    WHEN cmd = 'd' THEN 'DELETE'
    ELSE cmd::text
  END AS command
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'workspace_invitations'
ORDER BY policyname;

-- Expected policies:
-- - workspace_invitations_select_member (SELECT)
-- - workspace_invitations_insert_admin (INSERT)
-- - workspace_invitations_update_admin (UPDATE)
-- - workspace_invitations_delete_admin (DELETE)

-- ============================================================================
-- 5. CHECK IF INDEXES EXIST
-- ============================================================================
SELECT 
  indexname AS index_name,
  indexdef AS index_definition
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'workspace_invitations'
ORDER BY indexname;

-- Expected indexes:
-- - idx_workspace_invitations_workspace_id
-- - idx_workspace_invitations_email
-- - idx_workspace_invitations_status
-- - idx_workspace_invitations_email_status

-- ============================================================================
-- 6. CHECK IF FUNCTION EXISTS
-- ============================================================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM pg_proc 
      WHERE proname = 'process_workspace_invitations_for_user'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) 
    THEN '✅ Function process_workspace_invitations_for_user exists'
    ELSE '❌ Function process_workspace_invitations_for_user does NOT exist'
  END AS function_check;

-- ============================================================================
-- 7. CHECK FUNCTION SIGNATURE
-- ============================================================================
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END AS security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'process_workspace_invitations_for_user';

-- ============================================================================
-- 8. CHECK FUNCTION PERMISSIONS
-- ============================================================================
SELECT 
  p.proname AS function_name,
  r.rolname AS granted_to,
  CASE 
    WHEN has_function_privilege(r.rolname, p.oid, 'EXECUTE') 
    THEN '✅ Has EXECUTE permission'
    ELSE '❌ No EXECUTE permission'
  END AS permission_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname = 'process_workspace_invitations_for_user'
  AND r.rolname = 'authenticated';

-- ============================================================================
-- 9. CHECK UNIQUE CONSTRAINT
-- ============================================================================
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'workspace_invitations'::regclass
  AND contype = 'u';

-- Should show: UNIQUE constraint on (workspace_id, email, status)

-- ============================================================================
-- 10. SUMMARY CHECK
-- ============================================================================
SELECT 
  'Migration Verification Summary' AS summary,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspace_invitations') AS table_exists,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_invitations') AS policy_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'workspace_invitations') AS index_count,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'process_workspace_invitations_for_user' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) AS function_exists;

