# Deployment Checklist - Backward Compatible Code

## Pre-Deployment

- [x] Update hooks to support both `user_id` and `workspace_id`
- [x] Update tags page to support both schemas
- [x] Update batch polling to filter by workspace
- [x] Test with both schemas (if possible)

## Deployment Steps

1. **Deploy Code** (Safe - backward compatible)
   ```bash
   # Deploy web app
   npm run build
   # Deploy to Vercel/production
   ```

2. **Verify Production Schema** (Run in Supabase SQL Editor)
   ```sql
   -- Run CHECK_PRODUCTION_SCHEMA.sql
   ```

3. **Test Production**
   - [ ] Login works
   - [ ] Assets load (using user_id or workspace_id)
   - [ ] Tags page works
   - [ ] Tag management works
   - [ ] Bulk operations work
   - [ ] Autotagging works

## Post-Deployment

### Option A: Keep Legacy Schema (Current)
- Code works with `user_id` filtering
- No workspace features available
- Everything works as before

### Option B: Migrate to Workspace Schema (Future)
1. **Backup Database**
   ```bash
   supabase db dump -f backup.sql
   ```

2. **Apply Migrations**
   ```bash
   supabase migration up
   ```

3. **Verify Migration**
   - Run `CHECK_PRODUCTION_SCHEMA.sql`
   - Verify all assets have `workspace_id`
   - Verify all users have workspaces

4. **Test Production**
   - [ ] Workspace switcher appears
   - [ ] Assets load by workspace
   - [ ] Workspace members can be added
   - [ ] All features work with workspaces

## Rollback Plan

If issues occur:
1. Code is backward compatible - should work with old schema
2. If migration was applied, restore from backup:
   ```bash
   psql -f backup.sql
   ```

## Support

- Check logs for schema detection
- Look for `[TagManagement]`, `[useAssets]` console logs
- Verify `activeWorkspaceId` in localStorage (if migrated)
