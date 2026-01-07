-- Fix campaigns.user_id foreign key constraint to allow user deletion
-- Either delete campaigns when user is deleted (CASCADE) or set to NULL (SET NULL)
-- Since campaigns are being phased out, we'll use CASCADE to delete them

-- Check if campaigns table exists and has the constraint
DO $$ 
DECLARE
  constraint_exists boolean;
  table_exists boolean;
BEGIN
  -- Check if campaigns table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'campaigns'
  ) INTO table_exists;
  
  IF table_exists THEN
    -- Check if the constraint exists
    SELECT EXISTS (
      SELECT FROM pg_constraint
      WHERE conname = 'campaigns_user_id_fkey'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
      -- Drop the existing constraint
      ALTER TABLE campaigns DROP CONSTRAINT campaigns_user_id_fkey;
      
      -- Add new constraint with CASCADE (delete campaigns when user is deleted)
      ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
      
      RAISE NOTICE 'Fixed campaigns_user_id_fkey constraint to use CASCADE';
    ELSE
      RAISE NOTICE 'campaigns_user_id_fkey constraint does not exist, creating it with CASCADE';
      -- Create constraint if it doesn't exist
      ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
  ELSE
    RAISE NOTICE 'campaigns table does not exist, skipping constraint fix';
  END IF;
END $$;

