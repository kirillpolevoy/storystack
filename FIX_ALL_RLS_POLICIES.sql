-- Fix All RLS Policies
-- Run this to ensure all policies allow INSERT/UPDATE correctly

-- ============================================
-- Campaigns Policies
-- ============================================
DROP POLICY IF EXISTS "Users can only see their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can only insert their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can only update their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can only delete their own campaigns" ON campaigns;

CREATE POLICY "Users can only see their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

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

-- ============================================
-- Assets Policies
-- ============================================
DROP POLICY IF EXISTS "Users can only see their own assets" ON assets;
DROP POLICY IF EXISTS "Users can only insert their own assets" ON assets;
DROP POLICY IF EXISTS "Users can only update their own assets" ON assets;
DROP POLICY IF EXISTS "Users can only delete their own assets" ON assets;

CREATE POLICY "Users can only see their own assets"
  ON assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own assets"
  ON assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own assets"
  ON assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own assets"
  ON assets FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Tag Config Policies
-- ============================================
DROP POLICY IF EXISTS "Users can only see their own tag config" ON tag_config;
DROP POLICY IF EXISTS "Users can only insert their own tag config" ON tag_config;
DROP POLICY IF EXISTS "Users can only update their own tag config" ON tag_config;
DROP POLICY IF EXISTS "Users can only delete their own tag config" ON tag_config;

CREATE POLICY "Users can only see their own tag config"
  ON tag_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own tag config"
  ON tag_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own tag config"
  ON tag_config FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own tag config"
  ON tag_config FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Verify Policies
-- ============================================
SELECT 
    tablename,
    policyname,
    CASE 
        WHEN cmd = 'r' THEN 'SELECT'
        WHEN cmd = 'a' THEN 'INSERT'
        WHEN cmd = 'w' THEN 'UPDATE'
        WHEN cmd = 'd' THEN 'DELETE'
    END as operation,
    CASE 
        WHEN with_check LIKE '%auth.uid()%' THEN '✅ Has WITH CHECK'
        ELSE '⚠️ Missing WITH CHECK'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('campaigns', 'assets', 'tag_config')
ORDER BY tablename, cmd;


