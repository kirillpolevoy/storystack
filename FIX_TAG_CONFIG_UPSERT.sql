-- Fix tag_config upsert issue
-- The UPDATE policy was missing WITH CHECK clause, which causes upsert operations to fail

-- Drop and recreate the UPDATE policy with both USING and WITH CHECK
DROP POLICY IF EXISTS "Users can only update their own tag config" ON tag_config;

CREATE POLICY "Users can only update their own tag config"
  ON tag_config FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verify the policy was created correctly
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tag_config'
  AND cmd = 'w';











