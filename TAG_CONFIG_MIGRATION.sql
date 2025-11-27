-- Step 3: Update tag_config Table (CORRECTED ORDER)
-- Run this if you got the "user_id does not exist" or "contains null values" error

-- First, add user_id column if it doesn't exist (allows NULL initially)
ALTER TABLE tag_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- IMPORTANT: Handle existing rows BEFORE making user_id NOT NULL
-- Option A: Delete all existing tag_config rows (RECOMMENDED - users will get new ones automatically)
DELETE FROM tag_config;

-- OR Option B: If you want to keep existing data, assign it to a specific user
-- First, get a user ID from your auth.users table:
-- SELECT id FROM auth.users LIMIT 1;
-- Then uncomment and replace YOUR_USER_ID_HERE:
-- UPDATE tag_config SET user_id = 'YOUR_USER_ID_HERE'::uuid WHERE user_id IS NULL;

-- Now drop the old primary key constraint (if it exists)
ALTER TABLE tag_config DROP CONSTRAINT IF EXISTS tag_config_pkey;

-- Remove the 'id' column (we'll use user_id as primary key)
ALTER TABLE tag_config DROP COLUMN IF EXISTS id;

-- Make user_id the primary key (this will fail if there are still NULL values)
ALTER TABLE tag_config ADD PRIMARY KEY (user_id);

-- Ensure user_id is NOT NULL (should already be enforced by primary key, but explicit is good)
ALTER TABLE tag_config ALTER COLUMN user_id SET NOT NULL;

-- Add index (already primary key, but good to have)
CREATE INDEX IF NOT EXISTS idx_tag_config_user_id ON tag_config(user_id);

