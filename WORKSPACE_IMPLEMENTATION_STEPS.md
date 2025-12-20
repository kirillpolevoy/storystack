# Workspace Implementation - Next Steps

## ✅ What's Already Done

All the code changes are complete:
- Database schema migrations created
- RLS policies implemented
- Storage buckets configured
- Frontend components built
- Workspace context and state management
- All queries updated to be workspace-scoped
- Soft delete implemented
- Tag management updated

## 🚀 What You Need To Do

### Step 1: Apply Database Migrations

You have 5 migration files that need to be run **in order**:

1. `20251219134920_create_workspaces_schema.sql` - Creates tables and schema
2. `20251219134921_migrate_existing_users.sql` - Migrates existing users
3. `20251219134922_create_workspace_rls_policies.sql` - Sets up RLS
4. `20251219134923_create_workspace_storage.sql` - Creates storage bucket
5. `20251219134924_create_audit_triggers.sql` - Sets up audit logging

**Option A: Via Supabase Dashboard (Recommended for first time)**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open each migration file in order
4. Copy and paste the contents
5. Run each migration one at a time
6. Verify no errors

**Option B: Via Supabase CLI (If you have it set up)**
```bash
# If you have Supabase CLI installed and linked
supabase db push

# Or apply migrations manually
supabase migration up
```

### Step 2: Verify Migration Success

After running migrations, verify:

1. **Check tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('workspaces', 'workspace_members', 'audit_log', 'tags', 'asset_tags');
   ```

2. **Check existing users got workspaces:**
   ```sql
   SELECT w.id, w.name, wm.user_id, wm.role 
   FROM workspaces w 
   JOIN workspace_members wm ON w.id = wm.workspace_id 
   LIMIT 10;
   ```

3. **Check workspace_id was backfilled:**
   ```sql
   SELECT COUNT(*) as total_assets, 
          COUNT(workspace_id) as assets_with_workspace 
   FROM assets;
   ```

### Step 3: Test the Application

1. **Login as existing user:**
   - Should see a default workspace created
   - All existing assets/stories should be visible
   - Workspace switcher should appear in top-left

2. **Test workspace switching:**
   - Click workspace switcher
   - Should see workspace name/logo
   - Can switch between workspaces (if multiple)

3. **Test workspace settings (owner only):**
   - Navigate to workspace settings
   - Try renaming workspace
   - Try uploading a logo
   - Try removing logo

4. **Test soft delete:**
   - Delete an asset
   - Verify it disappears from library
   - Check database - `deleted_at` should be set, not actually deleted

5. **Test asset upload:**
   - Upload a new asset
   - Verify it uses new workspace storage path: `workspaces/{workspace_id}/assets/...`
   - Verify it's associated with active workspace

6. **Test tag management:**
   - Go to tag management
   - Create/edit/delete tags
   - Verify tags are workspace-scoped

### Step 4: Create Storage Bucket (If Not Auto-Created)

The migration should create `workspace_logos` bucket, but verify:

1. Go to Supabase Dashboard → **Storage**
2. Check if `workspace_logos` bucket exists
3. If not, create it manually:
   - Name: `workspace_logos`
   - Public: ✅ Yes
   - File size limit: 5MB
   - Allowed MIME types: `image/png, image/jpeg, image/webp`

### Step 5: Test Edge Function (Auto-tagging)

1. Upload a new asset
2. Verify auto-tagging still works
3. Check edge function logs to ensure it's using workspace_id

### Step 6: Monitor for Issues

Watch for:
- RLS policy errors (users can't access their data)
- Migration issues (existing users missing workspaces)
- Storage permission errors
- Edge function failures

## ⚠️ Important Notes

1. **Backup First:** Consider backing up your database before running migrations
2. **Test Environment:** If possible, test migrations on a staging/test database first
3. **Rollback Plan:** Keep the old code branch in case you need to rollback
4. **Existing Users:** The migration creates default workspaces, but verify all users got one

## 🔄 Optional: Copy/Move Assets Feature

The copy/move assets feature is not yet implemented. This is optional and can be added later. The core workspace functionality works without it.

## 📝 Migration Order is Critical

**DO NOT** skip or reorder migrations. They must run in this exact order:
1. Schema creation
2. User migration
3. RLS policies
4. Storage setup
5. Audit triggers

## 🆘 Troubleshooting

### If migrations fail:
- Check Supabase logs for specific errors
- Verify you have proper permissions
- Ensure no conflicting schema changes exist

### If existing users can't see their data:
- Check if default workspace was created
- Verify workspace_id was backfilled
- Check RLS policies are enabled

### If storage uploads fail:
- Verify `workspace_logos` bucket exists
- Check storage RLS policies
- Verify workspace_id is being passed correctly

## ✅ Definition of Done Checklist

- [ ] All migrations applied successfully
- [ ] Existing users can log in and see their data
- [ ] New users get default workspace on signup
- [ ] Workspace switcher appears and works
- [ ] Workspace settings work (rename, logo upload)
- [ ] Asset uploads use new workspace paths
- [ ] Soft delete works for assets/stories
- [ ] Tags are workspace-scoped
- [ ] RLS prevents cross-workspace data access
- [ ] Storage policies work correctly
- [ ] Edge functions use workspace_id



