-- Complete Migration: Final Steps
-- Run this after user_id columns are populated

-- ============================================
-- Step 1: Make user_id NOT NULL
-- ============================================
ALTER TABLE campaigns ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE assets ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- Step 2: Update tag_config primary key
-- ============================================
-- Drop old primary key constraint
ALTER TABLE tag_config DROP CONSTRAINT IF EXISTS tag_config_pkey;

-- Remove the 'id' column (we'll use user_id as primary key)
ALTER TABLE tag_config DROP COLUMN IF EXISTS id;

-- Make user_id the primary key
ALTER TABLE tag_config ADD PRIMARY KEY (user_id);

-- Ensure user_id is NOT NULL (should already be enforced by primary key)
ALTER TABLE tag_config ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- Step 3: Add indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_campaign_user ON assets(campaign_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tag_config_user_id ON tag_config(user_id);

-- ============================================
-- Step 4: Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 5: Create RLS Policies
-- ============================================

-- Campaigns policies
DROP POLICY IF EXISTS "Users can only see their own campaigns" ON campaigns;
CREATE POLICY "Users can only see their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own campaigns" ON campaigns;
CREATE POLICY "Users can only insert their own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own campaigns" ON campaigns;
CREATE POLICY "Users can only update their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own campaigns" ON campaigns;
CREATE POLICY "Users can only delete their own campaigns"
  ON campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Assets policies
DROP POLICY IF EXISTS "Users can only see their own assets" ON assets;
CREATE POLICY "Users can only see their own assets"
  ON assets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own assets" ON assets;
CREATE POLICY "Users can only insert their own assets"
  ON assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own assets" ON assets;
CREATE POLICY "Users can only update their own assets"
  ON assets FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own assets" ON assets;
CREATE POLICY "Users can only delete their own assets"
  ON assets FOR DELETE
  USING (auth.uid() = user_id);

-- Tag config policies
DROP POLICY IF EXISTS "Users can only see their own tag config" ON tag_config;
CREATE POLICY "Users can only see their own tag config"
  ON tag_config FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own tag config" ON tag_config;
CREATE POLICY "Users can only insert their own tag config"
  ON tag_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own tag config" ON tag_config;
CREATE POLICY "Users can only update their own tag config"
  ON tag_config FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own tag config" ON tag_config;
CREATE POLICY "Users can only delete their own tag config"
  ON tag_config FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Step 6: Add user_id to sequences table (optional, for future use)
-- ============================================
-- Add user_id column
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Make it NOT NULL (safe since table is empty)
ALTER TABLE sequences ALTER COLUMN user_id SET NOT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_campaign_user ON sequences(campaign_id, user_id);

-- Enable RLS
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can only see their own sequences" ON sequences;
CREATE POLICY "Users can only see their own sequences"
  ON sequences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own sequences" ON sequences;
CREATE POLICY "Users can only insert their own sequences"
  ON sequences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own sequences" ON sequences;
CREATE POLICY "Users can only update their own sequences"
  ON sequences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own sequences" ON sequences;
CREATE POLICY "Users can only delete their own sequences"
  ON sequences FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Step 7: Verify Migration
-- ============================================
-- Check that all tables have user_id as NOT NULL
SELECT 
    table_name,
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('campaigns', 'assets', 'tag_config')
  AND column_name = 'user_id'
ORDER BY table_name;

-- Check primary keys
SELECT 
    tc.table_name,
    kc.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kc 
    ON tc.constraint_name = kc.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('campaigns', 'assets', 'tag_config')
ORDER BY tc.table_name;

-- Check RLS status
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('campaigns', 'assets', 'tag_config');

