# Apply RLS Fix for Workspace Members

## Problem
The `workspace_members` RLS policy uses `is_workspace_member(workspace_id)` which requires knowing the `workspace_id` upfront. But when users query `workspace_members` by `user_id` to find their workspaces, the policy can't evaluate because it doesn't know which workspace_id to check.

## Solution
Update the RLS policy to allow users to see their own memberships directly by checking `user_id = auth.uid()`.

## Steps

1. **Run the migration SQL in Supabase SQL Editor:**

```sql
-- Fix workspace_members RLS policy to allow users to query their own memberships
DROP POLICY IF EXISTS "workspace_members_select_member" ON workspace_members;

CREATE POLICY "workspace_members_select_member"
  ON workspace_members FOR SELECT
  USING (
    -- Users can see their own memberships
    user_id = auth.uid()
    OR
    -- Users can see members of workspaces they belong to (for workspace member lists)
    is_workspace_member(workspace_id)
  );
```

2. **Verify the user is in workspace_members:**

Run this query to check:
```sql
SELECT 
  wm.*,
  w.name as workspace_name,
  u.email as user_email
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
JOIN auth.users u ON u.id = wm.user_id
WHERE u.email = 'photo@kirillpolevoy.com';
```

If the user is NOT in workspace_members, run the fix script from `FIX_USER_WORKSPACE_ACCESS.sql`.

3. **Test the workspace switcher:**

After applying the fix:
- Have the user refresh the page
- Check browser console for `[WorkspaceSwitcher]` logs
- The workspace switcher should appear in the sidebar

## Why This Fixes It

The original policy `is_workspace_member(workspace_id)` works when you know the workspace_id (like when viewing workspace settings), but fails when querying by user_id because the policy can't determine which workspace_id to check.

The new policy allows:
- Users to see their own memberships: `user_id = auth.uid()`
- Users to see other members of workspaces they belong to: `is_workspace_member(workspace_id)`

This covers both use cases.

