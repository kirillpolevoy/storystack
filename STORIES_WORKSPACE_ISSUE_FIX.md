# Stories Workspace Issue - Diagnosis and Fix

## Problem
When `kpolevoy@gmail.com` added `ashmurak@gmail.com` to his workspace, `ashmurak@gmail.com` started seeing stories in her own workspace that shouldn't be there.

## Root Cause
The issue is likely one of the following:

1. **Stories created with wrong `workspace_id`**: Stories may have been created with `workspace_id` set to the wrong workspace (e.g., kpolevoy's stories have ashmurak's workspace_id)

2. **Stories without proper `workspace_id`**: Stories created before the workspace migration might not have `workspace_id` set correctly

3. **RLS Policy Behavior**: The RLS policy allows users to see stories from ANY workspace they're a member of:
   ```sql
   CREATE POLICY "stories_select_member"
     ON stories FOR SELECT
     USING (is_workspace_member(workspace_id));
   ```
   However, the application code filters by `workspace_id`:
   ```typescript
   .eq('workspace_id', workspaceId)
   ```
   If stories have the wrong `workspace_id`, they'll show up in the wrong workspace.

## Solution

### Step 1: Diagnose the Issue
Run `DIAGNOSE_STORIES_WORKSPACE_ISSUE.sql` to:
- Find user IDs and workspaces
- Check story workspace assignments
- Identify stories with NULL or incorrect `workspace_id`
- Verify RLS access patterns

### Step 2: Fix the Data
Run `FIX_STORIES_WORKSPACE_ISSUE.sql` to:
- Identify stories in wrong workspaces
- Update stories to belong to their owner's workspace
- Add a trigger to prevent this in the future

### Step 3: Verify the Fix
The fix script includes verification queries that will show:
- Stories that were fixed
- Stories that still have issues (if any)
- Confirmation that story owners are members of their stories' workspaces

## Prevention

The fix includes a database trigger that validates workspace membership when stories are created or updated:

```sql
CREATE TRIGGER check_story_workspace_membership
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON stories
  FOR EACH ROW
  EXECUTE FUNCTION validate_story_workspace_membership();
```

This ensures that:
- Stories can only be created if the user is a member of the workspace
- Stories cannot be moved to a workspace where the owner is not a member

## Testing

After applying the fix:

1. **Verify stories are in correct workspaces**:
   ```sql
   SELECT s.id, s.name, u.email, s.workspace_id, w.name
   FROM stories s
   JOIN auth.users u ON u.id = s.user_id
   JOIN workspaces w ON w.id = s.workspace_id
   WHERE s.deleted_at IS NULL
   ORDER BY u.email, s.created_at DESC;
   ```

2. **Verify RLS is working correctly**:
   - Login as ashmurak@gmail.com
   - Check that she only sees stories from her own workspace
   - Check that she can see stories from kpolevoy's workspace only when she switches to that workspace

3. **Test story creation**:
   - Create a story in ashmurak's workspace
   - Verify it appears only in her workspace
   - Verify kpolevoy cannot see it unless he's a member of her workspace

## Notes

- The RLS policy correctly allows users to see stories from workspaces they're members of
- The application correctly filters by `workspace_id` when querying
- The issue is data integrity: stories must have the correct `workspace_id`
- The trigger ensures data integrity going forward

