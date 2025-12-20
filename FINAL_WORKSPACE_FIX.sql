-- ============================================================================
-- FINAL COMPREHENSIVE FIX FOR WORKSPACE CREATION
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Create RPC Function (Primary Solution)
-- ============================================================================

-- Drop function with all possible signatures
DROP FUNCTION IF EXISTS public.create_workspace(TEXT);
DROP FUNCTION IF EXISTS public.create_workspace(text);
DROP FUNCTION IF EXISTS create_workspace(TEXT);

-- Create function (matches pattern from get_workspace_members_with_emails)
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_by UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workspace_id_val UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create a workspace';
  END IF;

  INSERT INTO workspaces (name, created_by, status)
  VALUES (workspace_name, current_user_id, 'active')
  RETURNING id INTO workspace_id_val;
  
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, current_user_id, 'owner', current_user_id);
  
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.created_by,
    w.status,
    w.created_at,
    w.updated_at
  FROM workspaces w
  WHERE w.id = workspace_id_val;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_workspace IS 'Creates workspace for authenticated user. Bypasses RLS.';

-- ============================================================================
-- PART 2: Fix RLS Policies (Fallback Solution)
-- ============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Remove all INSERT policies
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON workspaces;

-- Create INSERT policy
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Ensure SELECT policy for creators exists (critical for .select() after INSERT)
DROP POLICY IF EXISTS "workspaces_select_creator" ON workspaces;
CREATE POLICY "workspaces_select_creator"
  ON workspaces 
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Ensure grants
GRANT INSERT, SELECT, UPDATE, DELETE ON workspaces TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- PART 3: Verification & Testing
-- ============================================================================

-- Check function exists
SELECT '✓ Function Status' as check_type;
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'Function EXISTS'
    ELSE 'Function MISSING - RUN PART 1 AGAIN'
  END as status
FROM pg_proc 
WHERE proname = 'create_workspace' AND pronamespace = 'public'::regnamespace;

SELECT 'Function Details:' as check_type;
SELECT 
  proname,
  prosecdef as is_security_definer,
  pg_get_function_arguments(oid) as signature
FROM pg_proc 
WHERE proname = 'create_workspace' AND pronamespace = 'public'::regnamespace;

-- Check INSERT policy
SELECT '✓ INSERT Policy' as check_type;
SELECT 
  policyname,
  permissive,
  roles,
  CASE 
    WHEN with_check LIKE '%auth.uid()%' AND with_check LIKE '%created_by%' THEN 'CORRECT'
    ELSE 'INCORRECT - CHECK WITH_CHECK'
  END as policy_status
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

-- Check SELECT policies
SELECT '✓ SELECT Policies' as check_type;
SELECT 
  policyname,
  permissive,
  CASE 
    WHEN qual LIKE '%created_by%' THEN 'Creator policy EXISTS'
    WHEN qual LIKE '%workspace_members%' THEN 'Member policy EXISTS'
    ELSE 'Other policy'
  END as policy_type
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'SELECT'
ORDER BY policyname;

-- Check grants
SELECT '✓ Grants' as check_type;
SELECT 
  grantee,
  STRING_AGG(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'workspaces'
  AND grantee = 'authenticated'
GROUP BY grantee;

-- ============================================================================
-- NEXT STEPS:
-- 1. If function shows as MISSING, re-run PART 1
-- 2. Wait 30 seconds for Supabase schema cache to refresh
-- 3. Try creating a workspace in the app
-- 4. If still fails, check browser console for exact error
-- ============================================================================

