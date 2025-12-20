-- Fix audit trigger: Separate workspace and workspace_members logic to prevent OLD.role error
-- The workspaces table doesn't have a 'role' column, only workspace_members does

CREATE OR REPLACE FUNCTION create_audit_log_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  workspace_id_val UUID;
  entity_id_val UUID;
  action_val TEXT;
  diff_val JSONB;
BEGIN
  -- Determine workspace_id based on table
  IF TG_TABLE_NAME = 'workspaces' THEN
    workspace_id_val := NEW.id;
    entity_id_val := NEW.id;
  ELSIF TG_TABLE_NAME = 'workspace_members' THEN
    workspace_id_val := NEW.workspace_id;
    entity_id_val := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'assets' THEN
    workspace_id_val := NEW.workspace_id;
    entity_id_val := NEW.id;
  ELSIF TG_TABLE_NAME = 'stories' THEN
    workspace_id_val := NEW.workspace_id;
    entity_id_val := NEW.id;
  ELSIF TG_TABLE_NAME = 'tags' THEN
    workspace_id_val := NEW.workspace_id;
    entity_id_val := NEW.id;
  ELSIF TG_TABLE_NAME = 'story_assets' THEN
    -- Get workspace_id from story
    SELECT workspace_id INTO workspace_id_val
    FROM stories
    WHERE id = NEW.story_id;
    entity_id_val := NEW.id;
  ELSIF TG_TABLE_NAME = 'asset_tags' THEN
    -- Get workspace_id from asset
    SELECT workspace_id INTO workspace_id_val
    FROM assets
    WHERE id = NEW.asset_id;
    entity_id_val := NEW.id;
  ELSE
    RETURN NEW; -- Unknown table, skip audit
  END IF;

  -- Determine action based on operation
  IF TG_OP = 'INSERT' THEN
    action_val := 'create';
    diff_val := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check for soft delete (assets/stories only)
    IF TG_TABLE_NAME IN ('assets', 'stories') THEN
      IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        action_val := 'soft_delete';
        diff_val := jsonb_build_object(
          'deleted_at', NEW.deleted_at,
          'deleted_by', NEW.deleted_by
        );
      ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        action_val := 'restore';
        diff_val := jsonb_build_object('restored_at', NOW());
      ELSE
        action_val := 'update';
        diff_val := jsonb_build_object(
          'old', to_jsonb(OLD),
          'new', to_jsonb(NEW)
        );
      END IF;
    -- Check for role change in workspace_members (workspace_members only)
    ELSIF TG_TABLE_NAME = 'workspace_members' THEN
      IF OLD.role != NEW.role THEN
        action_val := 'role_change';
        diff_val := jsonb_build_object(
          'old_role', OLD.role,
          'new_role', NEW.role
        );
      ELSE
        action_val := 'update';
        diff_val := jsonb_build_object(
          'old', to_jsonb(OLD),
          'new', to_jsonb(NEW)
        );
      END IF;
    -- Check for workspace updates (workspaces only)
    ELSIF TG_TABLE_NAME = 'workspaces' THEN
      -- Check for name change
      IF OLD.name IS DISTINCT FROM NEW.name THEN
        action_val := 'update_name';
        diff_val := jsonb_build_object(
          'old_name', OLD.name,
          'new_name', NEW.name
        );
      -- Check for logo update
      ELSIF OLD.logo_path IS DISTINCT FROM NEW.logo_path THEN
        IF NEW.logo_path IS NULL THEN
          action_val := 'remove_logo';
        ELSE
          action_val := 'update_logo';
        END IF;
        diff_val := jsonb_build_object(
          'old_logo_path', OLD.logo_path,
          'new_logo_path', NEW.logo_path
        );
      ELSE
        -- Generic workspace update (other fields)
        action_val := 'update';
        diff_val := jsonb_build_object(
          'old', to_jsonb(OLD),
          'new', to_jsonb(NEW)
        );
      END IF;
    ELSE
      -- Generic update for other tables
      action_val := 'update';
      diff_val := jsonb_build_object(
        'old', to_jsonb(OLD),
        'new', to_jsonb(NEW)
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    action_val := 'delete';
    diff_val := to_jsonb(OLD);
    -- Get workspace_id from OLD record
    IF TG_TABLE_NAME = 'workspace_members' THEN
      workspace_id_val := OLD.workspace_id;
      entity_id_val := OLD.user_id;
    ELSIF TG_TABLE_NAME = 'assets' THEN
      workspace_id_val := OLD.workspace_id;
      entity_id_val := OLD.id;
    ELSIF TG_TABLE_NAME = 'stories' THEN
      workspace_id_val := OLD.workspace_id;
      entity_id_val := OLD.id;
    ELSIF TG_TABLE_NAME = 'tags' THEN
      workspace_id_val := OLD.workspace_id;
      entity_id_val := OLD.id;
    ELSIF TG_TABLE_NAME = 'story_assets' THEN
      SELECT workspace_id INTO workspace_id_val
      FROM stories
      WHERE id = OLD.story_id;
      entity_id_val := OLD.id;
    ELSIF TG_TABLE_NAME = 'asset_tags' THEN
      SELECT workspace_id INTO workspace_id_val
      FROM assets
      WHERE id = OLD.asset_id;
      entity_id_val := OLD.id;
    END IF;
  END IF;

  -- Insert audit log entry
  INSERT INTO audit_log (
    workspace_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    diff
  ) VALUES (
    workspace_id_val,
    auth.uid(),
    TG_TABLE_NAME,
    entity_id_val,
    action_val,
    diff_val
  );

  RETURN NEW;
END;
$$;

