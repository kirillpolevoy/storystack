-- Architectural fix for workspace creation
-- Addresses: RPC function creation, RLS policies, RESTRICTIVE policies, grants

-- ============================================================================
-- STEP 1: Drop and recreate RPC function with explicit schema
-- ============================================================================

-- Drop function if exists (with all possible signatures)
DROP FUNCTION IF EXISTS public.create_workspace(TEXT);
DROP FUNCTION IF EXISTS create_workspace(TEXT);
DROP FUNCTION IF EXISTS public.create_workspace(text);

-- Create function with explicit public schema
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
SET search_path = public, pg_temp
AS $$
DECLARE
  workspace_id_val UUID;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create a workspace';
  END IF;

  -- Create workspace (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.workspaces (name, created_by, status)
  VALUES (workspace_name, current_user_id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Add creator as owner (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, current_user_id, 'owner', current_user_id);
  
  -- Create default tag_config (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  -- Return the created workspace (bypasses RLS due to SECURITY DEFINER)
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.created_by,
    w.status,
    w.created_at,
    w.updated_at
  FROM public.workspaces w
  WHERE w.id = workspace_id_val;
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO anon;

-- Add comment
COMMENT ON FUNCTION public.create_workspace IS 'Creates a new workspace for the authenticated user. Bypasses RLS using SECURITY DEFINER.';

-- ============================================================================
-- STEP 2: Fix RLS policies - ensure no RESTRICTIVE policies block everything
-- ============================================================================

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select_creator" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;

-- Create PERMISSIVE INSERT policy (default is PERMISSIVE, but be explicit)
CREATE POLICY "workspaces_insert_authenticated"
  ON public.workspaces 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Create PERMISSIVE SELECT policy for creators (allows .select() after INSERT)
CREATE POLICY "workspaces_select_creator"
  ON public.workspaces 
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Recreate SELECT policy for members (must be PERMISSIVE, not RESTRICTIVE)
CREATE POLICY "workspaces_select_member"
  ON public.workspaces 
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 3: Ensure all grants are correct
-- ============================================================================

-- Grant all necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT INSERT, SELECT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.tag_config TO authenticated;

-- ============================================================================
-- STEP 4: Verify everything
-- ============================================================================

SELECT '=== RPC FUNCTION ===' as check_type;
SELECT 
  proname,
  prosecdef,
  pg_get_function_arguments(oid) as args
FROM pg_proc 
WHERE proname = 'create_workspace' AND pronamespace = 'public'::regnamespace;

SELECT '=== INSERT POLICIES ===' as check_type;
SELECT policyname, permissive, roles, with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

SELECT '=== SELECT POLICIES ===' as check_type;
SELECT policyname, permissive, roles, qual
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'SELECT';

SELECT '=== GRANTS ===' as check_type;
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'workspaces'
  AND grantee = 'authenticated';

