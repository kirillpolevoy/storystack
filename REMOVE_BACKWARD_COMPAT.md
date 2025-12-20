# Removed Backward Compatibility

All backward compatibility code has been removed. The codebase now requires `workspace_id` and will not work with the old `user_id` schema.

## Changes Made

### Hooks
- `useAssets.ts` - Requires `activeWorkspaceId`, returns empty if not set
- `useAvailableTags.ts` - Requires `activeWorkspaceId`, returns empty if not set  
- `useAvailableLocations.ts` - Requires `activeWorkspaceId`, returns empty if not set

### Pages
- `tags/page.tsx` - All mutations require `activeWorkspaceId`, throw error if not set

### Edge Functions
- `auto_tag_asset/index.ts` - Requires `workspace_id` on assets, no fallback to `user_id`

### Utilities
- `pollBatchStatus.ts` - Filters by `workspace_id` only

## Deleted Files
- `apps/web/lib/workspace-compat.ts` - Compatibility layer removed
- `BACKWARD_COMPATIBILITY_SUMMARY.md`
- `MIGRATION_STRATEGY.md`
- `PRODUCTION_MIGRATION_PLAN.md`

## Next Steps

1. **Migrate Production** - Ensure all assets have `workspace_id`
2. **Deploy** - Code is ready for workspace-only deployment
3. **Test** - Verify everything works with workspaces

