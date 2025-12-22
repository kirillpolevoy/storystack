-- Fix foreign key constraints to allow user deletion
-- Change RESTRICT to SET NULL where appropriate

-- 1. Fix workspaces.created_by - allow NULL when user is deleted
-- First, allow NULL values (since column is NOT NULL)
ALTER TABLE workspaces
  ALTER COLUMN created_by DROP NOT NULL;

-- Drop all foreign key constraints on created_by column
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'workspaces'::regclass
      AND contype = 'f'
      AND conkey::int[] = ARRAY(
        SELECT attnum::int
        FROM pg_attribute 
        WHERE attrelid = 'workspaces'::regclass 
        AND attname = 'created_by'
      )::int[]
  ) LOOP
    EXECUTE format('ALTER TABLE workspaces DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Add the foreign key constraint with SET NULL
ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- 2. Fix workspace_invitations.invited_by - allow NULL when user is deleted
-- First, allow NULL values (since column is NOT NULL)
ALTER TABLE workspace_invitations
  ALTER COLUMN invited_by DROP NOT NULL;

-- Drop all foreign key constraints on invited_by column
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'workspace_invitations'::regclass
      AND contype = 'f'
      AND conkey::int[] = ARRAY(
        SELECT attnum::int
        FROM pg_attribute 
        WHERE attrelid = 'workspace_invitations'::regclass 
        AND attname = 'invited_by'
      )::int[]
  ) LOOP
    EXECUTE format('ALTER TABLE workspace_invitations DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Add the foreign key constraint with SET NULL
ALTER TABLE workspace_invitations
  ADD CONSTRAINT workspace_invitations_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Add comment explaining the change
COMMENT ON COLUMN workspaces.created_by IS 'User who created the workspace. Set to NULL if user is deleted.';
COMMENT ON COLUMN workspace_invitations.invited_by IS 'User who sent the invitation. Set to NULL if user is deleted.';

