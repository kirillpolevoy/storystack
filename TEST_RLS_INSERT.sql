-- Test RLS Policies by simulating what the app does
-- Run this as the authenticated user (not as postgres role)

-- Test 1: Check current user context
SELECT auth.uid() as current_user_id;

-- Test 2: Try to insert a campaign (this should work if RLS is correct)
-- Replace '9b934e32-28c0-43fe-a105-60d4230e7096' with your actual user ID
INSERT INTO campaigns (user_id, name)
VALUES ('9b934e32-28c0-43fe-a105-60d4230e7096'::uuid, 'Test Campaign')
RETURNING id, name, user_id;

-- Test 3: Check if the insert worked
SELECT id, name, user_id 
FROM campaigns 
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
ORDER BY created_at DESC
LIMIT 5;

-- Test 4: Try to insert with wrong user_id (should fail)
-- This should be blocked by RLS
INSERT INTO campaigns (user_id, name)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'Should Fail')
RETURNING id;


