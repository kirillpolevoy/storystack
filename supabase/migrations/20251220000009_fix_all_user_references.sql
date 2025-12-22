-- Fix all foreign key references to auth.users to allow user deletion
-- Ensure all nullable references use SET NULL

-- 1. Fix assets.deleted_by (nullable, should use SET NULL)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets') THEN
    -- Drop existing constraint if it exists
    FOR r IN (
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'assets'::regclass
        AND contype = 'f'
        AND conkey::int[] = ARRAY(
          SELECT attnum::int
          FROM pg_attribute 
          WHERE attrelid = 'assets'::regclass 
          AND attname = 'deleted_by'
        )::int[]
    ) LOOP
      EXECUTE format('ALTER TABLE assets DROP CONSTRAINT %I', r.conname);
    END LOOP;
    
    -- Add new constraint with SET NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'deleted_by') THEN
      EXECUTE 'ALTER TABLE assets ADD CONSTRAINT assets_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
  END IF;
END $$;

-- 2. Fix stories.deleted_by (nullable, should use SET NULL)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stories') THEN
    -- Drop existing constraint if it exists
    FOR r IN (
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'stories'::regclass
        AND contype = 'f'
        AND conkey::int[] = ARRAY(
          SELECT attnum::int
          FROM pg_attribute 
          WHERE attrelid = 'stories'::regclass 
          AND attname = 'deleted_by'
        )::int[]
    ) LOOP
      EXECUTE format('ALTER TABLE stories DROP CONSTRAINT %I', r.conname);
    END LOOP;
    
    -- Add new constraint with SET NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stories' AND column_name = 'deleted_by') THEN
      EXECUTE 'ALTER TABLE stories ADD CONSTRAINT stories_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
  END IF;
END $$;

-- 3. Fix story_assets.added_by (nullable, should use SET NULL)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'story_assets') THEN
    -- Drop existing constraint if it exists
    FOR r IN (
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'story_assets'::regclass
        AND contype = 'f'
        AND conkey::int[] = ARRAY(
          SELECT attnum::int
          FROM pg_attribute 
          WHERE attrelid = 'story_assets'::regclass 
          AND attname = 'added_by'
        )::int[]
    ) LOOP
      EXECUTE format('ALTER TABLE story_assets DROP CONSTRAINT %I', r.conname);
    END LOOP;
    
    -- Add new constraint with SET NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'story_assets' AND column_name = 'added_by') THEN
      EXECUTE 'ALTER TABLE story_assets ADD CONSTRAINT story_assets_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
  END IF;
END $$;

