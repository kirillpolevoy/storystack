-- Add user_id to sequences table
-- Run this to prepare sequences table for user partitioning

-- Step 1: Add user_id column
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 2: Since table is empty, make it NOT NULL immediately
ALTER TABLE sequences ALTER COLUMN user_id SET NOT NULL;

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_campaign_user ON sequences(campaign_id, user_id);

-- Step 4: Enable RLS
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Users can only see their own sequences"
  ON sequences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own sequences"
  ON sequences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own sequences"
  ON sequences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own sequences"
  ON sequences FOR DELETE
  USING (auth.uid() = user_id);

-- Step 6: Verify
SELECT 
    'sequences' as table_name,
    column_name,
    is_nullable,
    CASE 
        WHEN is_nullable = 'NO' THEN '✅ NOT NULL'
        ELSE '❌ NULLABLE'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sequences'
  AND column_name = 'user_id';

-- Check RLS status
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'sequences';

-- Check policies
SELECT 
    policyname,
    CASE 
        WHEN cmd = 'r' THEN 'SELECT'
        WHEN cmd = 'a' THEN 'INSERT'
        WHEN cmd = 'w' THEN 'UPDATE'
        WHEN cmd = 'd' THEN 'DELETE'
        ELSE cmd::text
    END as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'sequences'
ORDER BY cmd;
