-- ============================================================================
-- COMPLETE ARCHITECTURAL FIX FOR WORKSPACE CREATION
-- ============================================================================
-- This fixes both RPC function and RLS policy issues
-- Run this in Supabase SQL Editor, then refresh schema cache if needed
-- ============================================================================

-- ============================================================================
-- STEP 1: Create RPC function (bypasses RLS)
-- ============================================================================

-- Drop all variations
DROP FUNCTION IF EXISTS public.create_workspace(TEXT);
DROP FUNCTION IF EXISTS public.create_workspace(text);
DROP FUNCTION IF EXISTS create_workspace(TEXT);

-- Create function matching pattern from get_workspace_members_with_emails
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

  -- Insert workspace (bypasses RLS)
  INSERT INTO workspaces (name, created_by, status)
  VALUES (workspace_name, current_user_id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Insert member (bypasses RLS)
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, current_user_id, 'owner', current_user_id);
  
  -- Insert tag_config (bypasses RLS)
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  -- Return workspace
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

-- Grant execute (matching pattern from other functions)
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_workspace IS 'Creates a new workspace for the authenticated user. Bypasses RLS using SECURITY DEFINER.';

-- ============================================================================
-- STEP 2: Fix RLS policies for direct insert fallback
-- ============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;

-- Create INSERT policy (PERMISSIVE is default, but be explicit)
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Ensure SELECT policy allows creators to see their workspace
-- This is critical for .select() after INSERT
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
-- STEP 3: Verify
-- ============================================================================

SELECT 'Function created:' as status;
SELECT proname, prosecdef, pg_get_function_arguments(oid) as signature
FROM pg_proc 
WHERE proname = 'create_workspace';

SELECT 'INSERT policy:' as status;
SELECT policyname, permissive, roles, with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

SELECT 'SELECT policies:' as status;
SELECT policyname, permissive, qual
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'SELECT'
ORDER BY policyname;

-- ============================================================================
-- IMPORTANT: If RPC function still returns 404 after running this:
-- 1. Go to Supabase Dashboard > Database > Functions
-- 2. Check if create_workspace appears in the list
-- 3. If not, wait 30 seconds and refresh
-- 4. Supabase PostgREST may need to refresh its schema cache
-- ============================================================================

