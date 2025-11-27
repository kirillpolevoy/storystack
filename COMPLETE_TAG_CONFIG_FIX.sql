-- Complete Fix for tag_config Migration
-- Run these statements ONE AT A TIME in order

-- Step 1: Check current state
SELECT * FROM tag_config;

-- Step 2: Delete ALL existing rows (they have NULL user_id)
-- This is safe because users will get new configs created automatically
DELETE FROM tag_config;

-- Step 3: Verify table is empty
SELECT COUNT(*) FROM tag_config; -- Should return 0

-- Step 4: Drop the old primary key constraint (if it exists)
ALTER TABLE tag_config DROP CONSTRAINT IF EXISTS tag_config_pkey;

-- Step 5: Remove the 'id' column (if it still exists)
ALTER TABLE tag_config DROP COLUMN IF EXISTS id;

-- Step 6: Now make user_id the primary key
-- This will work because the table is empty
ALTER TABLE tag_config ADD PRIMARY KEY (user_id);

-- Step 7: Set NOT NULL constraint
ALTER TABLE tag_config ALTER COLUMN user_id SET NOT NULL;

-- Step 8: Add index
CREATE INDEX IF NOT EXISTS idx_tag_config_user_id ON tag_config(user_id);

-- Step 9: Verify the structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tag_config';

-- Done! The table is now ready for user-specific tag configs.


