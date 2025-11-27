# Generate Migration Based on Current Structure

## Step 1: Run Diagnostic Script

Run `CHECK_TABLE_STRUCTURE.sql` in Supabase SQL Editor to see:
- What columns exist in each table
- What primary keys are set
- What foreign keys exist
- RLS status
- How many rows have NULL user_id

## Step 2: Based on Results, Run Appropriate Migrations

### Scenario A: `user_id` column doesn't exist in any table

Run these migrations in order:

```sql
-- 1. Add user_id to campaigns (if it doesn't exist)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Add user_id to assets (if it doesn't exist)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 3. Add user_id to tag_config (if it doesn't exist)
ALTER TABLE tag_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
```

### Scenario B: `user_id` exists but is nullable and has NULL values

You need to assign existing data to a user first:

```sql
-- Assign all existing data to a user (replace with your user UUID)
UPDATE campaigns 
SET user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid 
WHERE user_id IS NULL;

UPDATE assets 
SET user_id = (
  SELECT user_id 
  FROM campaigns 
  WHERE campaigns.id = assets.campaign_id
)
WHERE user_id IS NULL;

UPDATE tag_config 
SET user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid 
WHERE user_id IS NULL;
```

### Scenario C: `user_id` exists and all rows have values

You can proceed directly to making it NOT NULL and setting up primary keys.

## Step 3: Complete the Migration

After handling existing data:

```sql
-- Make user_id NOT NULL
ALTER TABLE campaigns ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE assets ALTER COLUMN user_id SET NOT NULL;

-- For tag_config: change primary key from 'id' to 'user_id'
ALTER TABLE tag_config DROP CONSTRAINT IF EXISTS tag_config_pkey;
ALTER TABLE tag_config DROP COLUMN IF EXISTS id;
ALTER TABLE tag_config ADD PRIMARY KEY (user_id);
ALTER TABLE tag_config ALTER COLUMN user_id SET NOT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_campaign_user ON assets(campaign_id, user_id);
```

## Step 4: Enable RLS

```sql
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_config ENABLE ROW LEVEL SECURITY;

-- Add RLS policies (see DATABASE_MIGRATION.md Step 4)
```


