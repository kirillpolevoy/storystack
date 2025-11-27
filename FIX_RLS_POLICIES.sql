-- Fix RLS Policies for campaigns table
-- The INSERT policy might be blocking campaign creation

-- First, drop existing policies to recreate them correctly
DROP POLICY IF EXISTS "Users can only see their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can only insert their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can only update their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can only delete their own campaigns" ON campaigns;

-- Recreate policies with correct syntax
CREATE POLICY "Users can only see their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

-- IMPORTANT: INSERT policy must check that user_id matches auth.uid()
CREATE POLICY "Users can only insert their own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own campaigns"
  ON campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Verify policies
SELECT 
    policyname,
    CASE 
        WHEN cmd = 'r' THEN 'SELECT'
        WHEN cmd = 'a' THEN 'INSERT'
        WHEN cmd = 'w' THEN 'UPDATE'
        WHEN cmd = 'd' THEN 'DELETE'
    END as operation,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'campaigns'
ORDER BY cmd;


