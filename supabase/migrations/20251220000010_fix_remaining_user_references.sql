-- Fix remaining foreign key references to auth.users that don't have explicit ON DELETE clauses
-- These default to RESTRICT, which prevents user deletion

-- 1. Fix workspace_members.created_by (nullable, should use SET NULL)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_members') THEN
    -- Drop existing constraint if it exists
    FOR r IN (
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'workspace_members'::regclass
        AND contype = 'f'
        AND conkey::int[] = ARRAY(
          SELECT attnum::int
          FROM pg_attribute 
          WHERE attrelid = 'workspace_members'::regclass 
          AND attname = 'created_by'
        )::int[]
    ) LOOP
      EXECUTE format('ALTER TABLE workspace_members DROP CONSTRAINT %I', r.conname);
    END LOOP;
    
    -- Add new constraint with SET NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_members' AND column_name = 'created_by') THEN
      EXECUTE 'ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
  END IF;
END $$;

-- 2. Fix audit_log.actor_user_id (nullable, should use SET NULL)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    -- Drop existing constraint if it exists
    FOR r IN (
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'audit_log'::regclass
        AND contype = 'f'
        AND conkey::int[] = ARRAY(
          SELECT attnum::int
          FROM pg_attribute 
          WHERE attrelid = 'audit_log'::regclass 
          AND attname = 'actor_user_id'
        )::int[]
    ) LOOP
      EXECUTE format('ALTER TABLE audit_log DROP CONSTRAINT %I', r.conname);
    END LOOP;
    
    -- Add new constraint with SET NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_log' AND column_name = 'actor_user_id') THEN
      EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
  END IF;
END $$;

-- 3. Fix asset_tags.created_by (nullable, should use SET NULL)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_tags') THEN
    -- Drop existing constraint if it exists
    FOR r IN (
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'asset_tags'::regclass
        AND contype = 'f'
        AND conkey::int[] = ARRAY(
          SELECT attnum::int
          FROM pg_attribute 
          WHERE attrelid = 'asset_tags'::regclass 
          AND attname = 'created_by'
        )::int[]
    ) LOOP
      EXECUTE format('ALTER TABLE asset_tags DROP CONSTRAINT %I', r.conname);
    END LOOP;
    
    -- Add new constraint with SET NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'asset_tags' AND column_name = 'created_by') THEN
      EXECUTE 'ALTER TABLE asset_tags ADD CONSTRAINT asset_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
  END IF;
END $$;

