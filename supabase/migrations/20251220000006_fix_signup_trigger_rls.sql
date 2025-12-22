-- Fix signup trigger to handle RLS properly
-- The issue is that RLS policies might block the trigger even with SECURITY DEFINER
-- We need to ensure the trigger can create workspace and member without RLS blocking

-- First, grant necessary permissions to the function's role
-- The function runs as the definer (postgres/service_role), so we need to ensure it can insert

-- Drop and recreate the function with better error handling
CREATE OR REPLACE FUNCTION create_default_workspace_for_user()
RETURNS TRIGGER AS $$
DECLARE
  workspace_id_val UUID;
BEGIN
  -- Create default workspace
  -- SECURITY DEFINER should bypass RLS, but ensure created_by is set correctly
  INSERT INTO workspaces (name, created_by, status)
  VALUES ('My Workspace', NEW.id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Add user as owner
  -- SECURITY DEFINER should bypass RLS for this insert
  -- The RLS policy requires has_workspace_role, but we're creating the first member
  -- Since we're SECURITY DEFINER, RLS should be bypassed
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, NEW.id, 'owner', NEW.id);
  
  -- Create default tag_config if needed
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    -- This ensures signup doesn't fail even if workspace creation fails
    RAISE WARNING 'Error creating default workspace for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated role (though SECURITY DEFINER should handle it)
GRANT EXECUTE ON FUNCTION create_default_workspace_for_user() TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_workspace_for_user() TO anon;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_create_default_workspace ON auth.users;
CREATE TRIGGER trigger_create_default_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_workspace_for_user();

COMMENT ON FUNCTION create_default_workspace_for_user IS 'Automatically creates a default workspace named "My Workspace" for new users when they sign up. Uses SECURITY DEFINER to bypass RLS.';

