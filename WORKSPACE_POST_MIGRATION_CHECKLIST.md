# Post-Migration Verification Checklist

## ✅ Database Verification

Run these queries in Supabase SQL Editor to verify everything migrated correctly:

### 1. Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workspaces', 'workspace_members', 'audit_log', 'tags', 'asset_tags')
ORDER BY table_name;
```
**Expected:** All 5 tables should exist

### 2. Check Existing Users Got Workspaces
```sql
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  wm.user_id,
  wm.role,
  u.email
FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id
JOIN auth.users u ON u.id = wm.user_id
ORDER BY w.created_at DESC
LIMIT 10;
```
**Expected:** Each existing user should have at least one workspace with 'owner' role

### 3. Verify Assets Have workspace_id
```sql
SELECT 
  COUNT(*) as total_assets,
  COUNT(workspace_id) as assets_with_workspace,
  COUNT(*) - COUNT(workspace_id) as assets_missing_workspace
FROM assets;
```
**Expected:** `assets_missing_workspace` should be 0

### 4. Verify Stories Have workspace_id
```sql
SELECT 
  COUNT(*) as total_stories,
  COUNT(workspace_id) as stories_with_workspace,
  COUNT(*) - COUNT(workspace_id) as stories_missing_workspace
FROM stories;
```
**Expected:** `stories_missing_workspace` should be 0

### 5. Check Tag Migration
```sql
SELECT 
  COUNT(DISTINCT a.id) as assets_with_tags_array,
  COUNT(DISTINCT t.id) as normalized_tags_created,
  COUNT(DISTINCT at.asset_id) as assets_linked_to_tags
FROM assets a
LEFT JOIN asset_tags at ON at.asset_id = a.id
LEFT JOIN tags t ON t.id = at.tag_id
WHERE a.tags IS NOT NULL AND array_length(a.tags, 1) > 0;
```
**Expected:** Should show tags were migrated from arrays to normalized table

### 6. Verify tag_config Migration
```sql
SELECT 
  COUNT(*) as total_configs,
  COUNT(workspace_id) as configs_with_workspace
FROM tag_config;
```
**Expected:** All configs should have `workspace_id` (user_id column was dropped in migration)

### 7. Check Storage Bucket
Go to Supabase Dashboard → Storage → Check if `workspace_logos` bucket exists
**Expected:** Bucket should exist and be public

### 8. Verify RLS is Enabled
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('workspaces', 'workspace_members', 'assets', 'stories', 'tags', 'tag_config')
ORDER BY tablename;
```
**Expected:** `rowsecurity` should be `t` (true) for all tables

### 9. Check Helper Functions Exist
```sql
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_workspace_member', 'workspace_role', 'has_workspace_role')
ORDER BY routine_name;
```
**Expected:** All 3 functions should exist

### 10. Verify Audit Triggers
```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE 'audit_%'
ORDER BY event_object_table, trigger_name;
```
**Expected:** Should see triggers for workspaces, assets, stories, tags, etc.

---

## 🧪 Application Testing

### Test 1: Login as Existing User
1. Log in with an existing account
2. **Expected:** Should see workspace switcher in top-left
3. **Expected:** All existing assets/stories should be visible
4. **Expected:** Workspace name should appear (default: "My Workspace" or email-based)

### Test 2: Workspace Switcher
1. Click workspace switcher
2. **Expected:** Modal opens showing workspace(s)
3. **Expected:** Current workspace is highlighted
4. **Expected:** Can see workspace name/logo (or initials if no logo)

### Test 3: Upload New Asset
1. Upload a new photo
2. **Expected:** Asset appears in library
3. **Expected:** Storage path should be: `workspaces/{workspace_id}/assets/{asset_id}/...`
4. Check in database: `SELECT storage_path FROM assets ORDER BY created_at DESC LIMIT 1;`
5. **Expected:** Path starts with `workspaces/`

### Test 4: Soft Delete Asset
1. Delete an asset (long press → delete)
2. **Expected:** Asset disappears from library
3. Check in database: 
   ```sql
   SELECT id, deleted_at, deleted_by 
   FROM assets 
   WHERE id = '<deleted_asset_id>';
   ```
4. **Expected:** `deleted_at` should be set, `deleted_by` should be your user_id
5. **Expected:** Asset should NOT appear in normal queries (they filter `deleted_at IS NULL`)

### Test 5: Workspace Settings (Owner Only)
1. Navigate to workspace settings (from workspace switcher → "Manage Active Workspace")
2. **Expected:** Can see workspace name field
3. Try renaming workspace
4. **Expected:** Name updates successfully
5. Try uploading a logo
6. **Expected:** Logo uploads and appears in workspace switcher
7. Try removing logo
8. **Expected:** Logo removed, initials show instead

### Test 6: Tag Management
1. Go to tag management screen
2. **Expected:** Can see all tags from assets
3. Create a new tag
4. **Expected:** Tag appears in list
5. **Expected:** Tag is workspace-scoped (won't appear in other workspaces)

### Test 7: Create New Workspace (If Multiple Users)
1. If you have multiple users, invite one to a workspace
2. **Expected:** User can see workspace in switcher
3. **Expected:** User can see assets/stories in that workspace
4. **Expected:** User cannot see assets from other workspaces

### Test 8: Auto-Tagging
1. Upload a new asset
2. **Expected:** Auto-tagging should still work
3. Check edge function logs in Supabase Dashboard
4. **Expected:** Function should use `workspace_id` from asset

---

## 🐛 Common Issues & Fixes

### Issue: Existing users can't see their data
**Fix:** Check if workspace was created:
```sql
SELECT w.id, w.name, wm.user_id 
FROM workspaces w 
JOIN workspace_members wm ON w.id = wm.workspace_id 
WHERE wm.user_id = '<user_id>';
```

### Issue: Assets missing workspace_id
**Fix:** Run manual backfill:
```sql
UPDATE assets a
SET workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = a.user_id
  LIMIT 1
)
WHERE workspace_id IS NULL;
```

### Issue: RLS blocking access
**Fix:** Check if user is workspace member:
```sql
SELECT * FROM workspace_members WHERE user_id = '<user_id>';
```

### Issue: Storage upload fails
**Fix:** 
1. Verify `workspace_logos` bucket exists
2. Check storage RLS policies are correct
3. Verify `workspace_id` is being passed in upload

---

## 📝 Next Steps

### Optional: Copy/Move Assets Feature
The copy/move assets across workspaces feature is not yet implemented. This is optional and can be added later. The core workspace functionality works without it.

### Recommended: Add Field-Level Validation
Consider adding application-level validation for:
- Only owners can rename workspace
- Only owners can upload/remove logo
- Only owners can change owner role

These are currently enforced by RLS (role check) but not field-level restrictions.

---

## ✅ Success Criteria

- [ ] All existing users have workspaces
- [ ] All assets/stories have workspace_id
- [ ] Workspace switcher appears and works
- [ ] New uploads use workspace storage paths
- [ ] Soft delete works correctly
- [ ] Tags are workspace-scoped
- [ ] RLS prevents cross-workspace access
- [ ] Workspace settings work (owner only)
- [ ] Auto-tagging uses workspace_id

---

## 🎉 You're Done!

Once all tests pass, your workspace implementation is complete and ready for use!

