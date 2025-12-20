-- Comprehensive architectural diagnostic for workspace creation
-- This will identify ALL issues preventing workspace creation

-- ============================================================================
-- 1. Check if RPC function exists and its signature
-- ============================================================================
SELECT '=== RPC FUNCTION STATUS ===' as diagnostic;

SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer,
  p.proacl as permissions,
  p.prosrc as source_code_preview
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'create_workspace'
  AND n.nspname = 'public';

-- If function doesn't exist, show similar functions
SELECT '=== SIMILAR FUNCTIONS (for reference) ===' as diagnostic;
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%workspace%'
ORDER BY p.proname;

-- ============================================================================
-- 2. Check ALL RLS policies on workspaces table
-- ============================================================================
SELECT '=== ALL RLS POLICIES ON WORKSPACES ===' as diagnostic;
SELECT 
  policyname,
  cmd,
  permissive,  -- PERMISSIVE (default) or RESTRICTIVE
  roles,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE tablename = 'workspaces'
ORDER BY cmd, policyname;

-- ============================================================================
-- 3. Check if RLS is enabled and if there are RESTRICTIVE policies
-- ============================================================================
SELECT '=== RLS STATUS ===' as diagnostic;
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'workspaces';

-- Check for RESTRICTIVE policies (these BLOCK everything unless explicitly allowed)
SELECT '=== RESTRICTIVE POLICIES (BLOCKING) ===' as diagnostic;
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'workspaces'
  AND permissive = 'RESTRICTIVE';

-- ============================================================================
-- 4. Check table grants
-- ============================================================================
SELECT '=== TABLE GRANTS ===' as diagnostic;
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'workspaces'
  AND grantee IN ('authenticated', 'anon', 'public')
ORDER BY grantee, privilege_type;

-- ============================================================================
-- 5. Check function grants
-- ============================================================================
SELECT '=== FUNCTION GRANTS ===' as diagnostic;
SELECT 
  p.proname as function_name,
  acl.privilege_type,
  acl.grantee
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN LATERAL aclexplode(p.proacl) acl
WHERE p.proname = 'create_workspace'
  AND n.nspname = 'public';

-- ============================================================================
-- 6. Test auth.uid() availability
-- ============================================================================
SELECT '=== AUTH CONTEXT TEST ===' as diagnostic;
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role;

-- ============================================================================
-- 7. Check workspace_members INSERT policy (needed for RPC function)
-- ============================================================================
SELECT '=== WORKSPACE_MEMBERS INSERT POLICIES ===' as diagnostic;
SELECT 
  policyname,
  cmd,
  permissive,
  with_check
FROM pg_policies
WHERE tablename = 'workspace_members' AND cmd = 'INSERT';

-- ============================================================================
-- 8. Check tag_config INSERT policy (needed for RPC function)
-- ============================================================================
SELECT '=== TAG_CONFIG INSERT POLICIES ===' as diagnostic;
SELECT 
  policyname,
  cmd,
  permissive,
  with_check
FROM pg_policies
WHERE tablename = 'tag_config' AND cmd = 'INSERT';

