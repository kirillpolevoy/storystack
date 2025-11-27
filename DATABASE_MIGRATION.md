# Database Migration: User Partitioning

This guide will help you migrate your database schema to support user-specific data.

## Step 1: Update `campaigns` Table

```sql
-- Make user_id required (if not already)
ALTER TABLE campaigns ALTER COLUMN user_id SET NOT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
```

## Step 2: Update `assets` Table

```sql
-- Add user_id column if it doesn't exist
ALTER TABLE assets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Make it required
ALTER TABLE assets ALTER COLUMN user_id SET NOT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_campaign_user ON assets(campaign_id, user_id);
```

## Step 3: Update `tag_config` Table

**IMPORTANT:** Run these statements in order. If you get "contains null values" error, you must delete existing rows first.

```sql
-- Step 3a: Add user_id column if it doesn't exist (allows NULL initially)
ALTER TABLE tag_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 3b: Handle existing rows with NULL user_id
-- Option A: DELETE all existing rows (they will be recreated per user automatically)
-- DELETE FROM tag_config;

-- Option B: Assign existing config to a specific user (recommended if you want to keep the data)
-- Replace 'YOUR_USER_ID_HERE' with your actual user UUID
UPDATE tag_config 
SET user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid 
WHERE user_id IS NULL;

-- Step 3c: Drop the old primary key constraint (if it exists)
ALTER TABLE tag_config DROP CONSTRAINT IF EXISTS tag_config_pkey;

-- Step 3d: Remove the 'id' column (we'll use user_id as primary key)
ALTER TABLE tag_config DROP COLUMN IF EXISTS id;

-- Step 3e: Make user_id the primary key (works because table is now empty)
ALTER TABLE tag_config ADD PRIMARY KEY (user_id);

-- Step 3f: Ensure user_id is NOT NULL (already enforced by primary key, but explicit)
ALTER TABLE tag_config ALTER COLUMN user_id SET NOT NULL;

-- Step 3g: Add index (already primary key, but good to have)
CREATE INDEX IF NOT EXISTS idx_tag_config_user_id ON tag_config(user_id);
```

**Note:** If you MUST keep existing tag config data, assign it to a user first:
```sql
-- Get a user ID: SELECT id FROM auth.users LIMIT 1;
-- Then: UPDATE tag_config SET user_id = 'YOUR_USER_ID_HERE'::uuid WHERE user_id IS NULL;
-- Then continue with steps 3c-3g above.
```

## Step 4: Enable Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_config ENABLE ROW LEVEL SECURITY;

-- Campaigns policies
CREATE POLICY "Users can only see their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own campaigns"
  ON campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Assets policies
CREATE POLICY "Users can only see their own assets"
  ON assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own assets"
  ON assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own assets"
  ON assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own assets"
  ON assets FOR DELETE
  USING (auth.uid() = user_id);

-- Tag config policies
CREATE POLICY "Users can only see their own tag config"
  ON tag_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own tag config"
  ON tag_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own tag config"
  ON tag_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own tag config"
  ON tag_config FOR DELETE
  USING (auth.uid() = user_id);
```

## Step 5: Migrate Existing Data (if needed)

If you have existing data without user_id, you'll need to assign it to a user:

```sql
-- Example: Assign all existing campaigns to a specific user
-- Replace 'YOUR_USER_ID_HERE' with an actual user ID
UPDATE campaigns 
SET user_id = 'YOUR_USER_ID_HERE'::uuid 
WHERE user_id IS NULL;

-- Assign all existing assets to campaigns' user_id
UPDATE assets 
SET user_id = (
  SELECT user_id 
  FROM campaigns 
  WHERE campaigns.id = assets.campaign_id
)
WHERE user_id IS NULL;

-- Create tag_config for existing users
INSERT INTO tag_config (user_id, auto_tags, custom_tags, deleted_tags)
SELECT DISTINCT user_id, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
FROM campaigns
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
```

## Important Notes

1. **Backup your database** before running these migrations
2. Run migrations in order
3. Test with a development database first
4. After migration, all queries will automatically filter by user_id via RLS

