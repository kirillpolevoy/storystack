# Mobile App Deployment - Backward Compatibility

## Current Situation

The mobile app **already uses `workspace_id`** and expects workspaces to exist. However, if production hasn't been migrated yet, the mobile app might have issues.

## Analysis

### Mobile App Code
- ✅ Uses `WorkspaceContext` which calls `getOrCreateDefaultWorkspace()`
- ✅ Queries assets with `.eq('workspace_id', activeWorkspaceId)`
- ✅ Inserts assets with `workspace_id: activeWorkspaceId`
- ✅ Edge function (`auto_tag_asset`) is backward compatible

### Potential Issues

If production still uses `user_id` schema:

1. **Asset Queries**: `.eq('workspace_id', activeWorkspaceId)` will fail if:
   - `workspace_id` column doesn't exist (old schema)
   - `workspace_id` is NULL for all assets (not migrated)

2. **Asset Inserts**: `workspace_id: activeWorkspaceId` will fail if:
   - `workspace_id` column doesn't exist
   - RLS policies don't allow `workspace_id` inserts

3. **Workspace Creation**: `getOrCreateDefaultWorkspace()` might create workspaces, but:
   - Existing assets won't have `workspace_id` set
   - Queries will still fail

## Solution Options

### Option 1: Deploy Edge Function Only (Recommended for Now)

**What to deploy:**
- ✅ Edge function (`auto_tag_asset`) - already backward compatible
- ❌ Mobile app - wait until production is migrated

**Why:**
- Edge function works with both schemas
- Mobile app requires `workspace_id` to exist
- Web app is backward compatible, so it will work

### Option 2: Make Mobile App Backward Compatible

**Changes needed:**
1. Check if `workspace_id` column exists
2. Fallback to `user_id` queries if no workspace
3. Handle both schemas in asset inserts

**This is complex** because:
- Mobile app is React Native (different from web)
- Would need to detect schema at runtime
- More code changes needed

### Option 3: Migrate Production First

**Steps:**
1. Deploy edge function (backward compatible)
2. Migrate production database (`supabase migration up`)
3. Deploy mobile app (already uses workspaces)

**This is the cleanest approach** but requires:
- Database migration first
- Testing after migration

## Recommendation

**For now:**
1. ✅ **Deploy edge function** - it's backward compatible
2. ✅ **Deploy web app** - it's backward compatible  
3. ⏸️ **Wait on mobile app** - until production is migrated

**After production migration:**
1. ✅ Mobile app will work automatically (already uses workspaces)
2. ✅ No mobile app changes needed

## Testing

To test if mobile app works with current production:

1. **Check if workspaces exist:**
   ```sql
   SELECT COUNT(*) FROM workspaces;
   ```

2. **Check if assets have workspace_id:**
   ```sql
   SELECT COUNT(*) FROM assets WHERE workspace_id IS NOT NULL;
   ```

3. **If both are 0**: Mobile app will fail, need to migrate first
4. **If workspaces exist**: Mobile app should work

## Next Steps

1. **Deploy edge function** (safe, backward compatible)
2. **Deploy web app** (safe, backward compatible)
3. **Check production schema** (run `CHECK_PRODUCTION_SCHEMA.sql`)
4. **If migrated**: Deploy mobile app (will work)
5. **If not migrated**: Migrate production first, then deploy mobile app

