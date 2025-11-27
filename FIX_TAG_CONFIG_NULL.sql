-- Quick Fix for NULL user_id values in tag_config
-- Run this BEFORE making user_id NOT NULL

-- Option 1: Delete all existing tag_config rows (RECOMMENDED)
-- Users will get new tag_config created automatically when they sign in
DELETE FROM tag_config;

-- After running the DELETE, you can proceed with the rest of the migration:
-- 1. Drop old primary key: ALTER TABLE tag_config DROP CONSTRAINT IF EXISTS tag_config_pkey;
-- 2. Drop id column: ALTER TABLE tag_config DROP COLUMN IF EXISTS id;
-- 3. Make user_id primary key: ALTER TABLE tag_config ADD PRIMARY KEY (user_id);
-- 4. Set NOT NULL: ALTER TABLE tag_config ALTER COLUMN user_id SET NOT NULL;

-- Option 2: If you MUST keep existing data, assign it to a user first
-- Uncomment and replace YOUR_USER_ID_HERE with an actual user ID:
-- UPDATE tag_config SET user_id = 'YOUR_USER_ID_HERE'::uuid WHERE user_id IS NULL;


