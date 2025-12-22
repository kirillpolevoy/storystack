-- Create default workspace trigger for new users
-- Automatically creates a default workspace named "My Workspace" when a new user signs up

CREATE OR REPLACE FUNCTION create_default_workspace_for_user()
RETURNS TRIGGER AS $$
DECLARE
  workspace_id_val UUID;
BEGIN
  -- Create default workspace
  INSERT INTO workspaces (name, created_by, status)
  VALUES ('My Workspace', NEW.id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Add user as owner
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, NEW.id, 'owner', NEW.id);
  
  -- Create default tag_config if needed
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users INSERT
DROP TRIGGER IF EXISTS trigger_create_default_workspace ON auth.users;
CREATE TRIGGER trigger_create_default_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_workspace_for_user();

COMMENT ON FUNCTION create_default_workspace_for_user IS 'Automatically creates a default workspace named "My Workspace" for new users when they sign up';

