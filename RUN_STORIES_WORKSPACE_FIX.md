# How to Fix Stories Workspace Issue

## Quick Fix (Recommended)

1. **Run the diagnostic first** (optional, but recommended to see what's wrong):
   - Open Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `DIAGNOSE_STORIES_WORKSPACE_ISSUE.sql`
   - Run it to see the current state

2. **Apply the fix**:
   - The fix is already in a migration file: `supabase/migrations/20251220000005_fix_stories_workspace_issue.sql`
   - If using Supabase CLI: `supabase db push`
   - If using Supabase Dashboard: Copy the migration file contents and run in SQL Editor

3. **Verify the fix**:
   - Run the verification query from `DIAGNOSE_STORIES_WORKSPACE_ISSUE.sql` (Step 7)
   - Or check manually: Login as ashmurak@gmail.com and verify she only sees stories from her own workspace

## What the Fix Does

1. **Fixes existing data**: Updates stories to belong to their owner's workspace
   - Prioritizes workspace created by the story owner
   - Falls back to any workspace the owner is a member of

2. **Prevents future issues**: Adds a database trigger that:
   - Validates workspace membership when stories are created
   - Prevents stories from being created in workspaces where the owner is not a member

## Manual Fix (If Migration Doesn't Work)

If you prefer to run the fix manually:

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `FIX_STORIES_WORKSPACE_ISSUE.sql`
3. Run it step by step (the file has comments separating each step)
4. Check the verification query at the end

## Testing After Fix

1. **As ashmurak@gmail.com**:
   - Should only see stories from her own workspace
   - Should NOT see stories from kpolevoy's workspace in her workspace view
   - Should be able to switch to kpolevoy's workspace to see those stories

2. **As kpolevoy@gmail.com**:
   - Should see stories from his own workspace
   - Should see stories from shared workspaces when switched to them

3. **Create a new story**:
   - Should only be created in the active workspace
   - Should fail if trying to create in a workspace you're not a member of (due to trigger)

## Rollback (If Needed)

If the fix causes issues, you can rollback:

```sql
-- Remove the trigger
DROP TRIGGER IF EXISTS check_story_workspace_membership ON stories;

-- Remove the function
DROP FUNCTION IF EXISTS validate_story_workspace_membership();
```

Note: The data fix (UPDATE) cannot be easily rolled back, but you can re-run the diagnostic queries to see what changed.

