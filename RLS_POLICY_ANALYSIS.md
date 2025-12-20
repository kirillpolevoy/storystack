# RLS Policy Analysis - Production State

## Current State

Your production database has **both old and new RLS policies**, which creates a hybrid/conflicting state:

### Assets Table Policies

**Old Policies (user_id-based):**
- ✅ "Users can only see their own assets" → `auth.uid() = user_id`
- ✅ "Users can only update their own assets" → `auth.uid() = user_id`
- ✅ "Users can only delete their own assets" → `auth.uid() = user_id`

**New Policies (workspace_id-based):**
- ✅ `assets_select_member` → `is_workspace_member(workspace_id)`
- ✅ `assets_update_editor` → `has_workspace_role(workspace_id, 'editor')`

### Problem

Having **both sets of policies** means:
- **OR logic**: User can see assets if EITHER `user_id` matches OR they're a workspace member
- This might be intentional during migration, but can cause confusion
- Old policies will fail if `user_id` column is removed later

## Recommendations

### Option 1: Keep Both (During Migration)

**If you're still migrating data:**
- Keep both policies temporarily
- Once all assets have `workspace_id`, remove old policies
- This allows gradual migration

**Pros:**
- Works during transition
- No breaking changes

**Cons:**
- More complex to debug
- Policies might conflict

### Option 2: Remove Old Policies (Recommended)

**If all assets have `workspace_id`:**
- Remove old `user_id`-based policies
- Keep only workspace-based policies
- Cleaner, simpler

**Steps:**
1. Verify all assets have `workspace_id`:
   ```sql
   SELECT COUNT(*) FROM assets WHERE workspace_id IS NULL AND deleted_at IS NULL;
   ```

2. If count is 0, remove old policies:
   ```sql
   DROP POLICY IF EXISTS "Users can only see their own assets" ON assets;
   DROP POLICY IF EXISTS "Users can only update their own assets" ON assets;
   DROP POLICY IF EXISTS "Users can only delete their own assets" ON assets;
   ```

3. Ensure workspace policies cover all operations:
   - ✅ SELECT: `assets_select_member` exists
   - ✅ UPDATE: `assets_update_editor` exists
   - ❓ INSERT: Check if exists
   - ❓ DELETE: Check if exists

## Missing Policies?

Check if these exist:

```sql
-- INSERT policy for assets
SELECT policyname FROM pg_policies 
WHERE tablename = 'assets' AND cmd = 'INSERT';

-- DELETE policy for assets  
SELECT policyname FROM pg_policies 
WHERE tablename = 'assets' AND cmd = 'DELETE';
```

If missing, create them:

```sql
-- INSERT: Editors can insert assets
CREATE POLICY assets_insert_editor ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (has_workspace_role(workspace_id, 'editor'));

-- DELETE: Editors can delete assets
CREATE POLICY assets_delete_editor ON assets
  FOR DELETE
  TO authenticated
  USING (has_workspace_role(workspace_id, 'editor'));
```

## Next Steps

1. **Run `FIX_RLS_POLICIES_HYBRID.sql`** to check current state
2. **Decide**: Keep both or remove old policies
3. **Verify**: All operations (SELECT, INSERT, UPDATE, DELETE) have policies
4. **Test**: Ensure users can still access their data

## Impact on Mobile App

- **If old policies removed**: Mobile app needs `workspace_id` to work
- **If old policies kept**: Mobile app might work with `user_id` fallback (but not recommended)

**Recommendation**: Remove old policies and ensure all assets have `workspace_id` before deploying mobile app.

