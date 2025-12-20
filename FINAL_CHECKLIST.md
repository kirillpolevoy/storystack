# Final Checklist - Production Migration & Deployment

## Pre-Deployment

- [ ] Run `CHECK_PRODUCTION_SCHEMA.sql` to verify current state
- [ ] Ensure all assets have `workspace_id` (or migrate them)
- [ ] Clean up RLS policies (remove old `user_id` policies if all assets migrated)
- [ ] Verify INSERT/DELETE policies exist for `assets` table
- [ ] Test edge function (`auto_tag_asset`) works with both schemas ✅ (already backward compatible)

## Deployment Order

1. **Edge Function** ✅
   ```bash
   supabase functions deploy auto_tag_asset
   ```
   - Already backward compatible
   - Works with both `user_id` and `workspace_id`

2. **Web App** ✅
   ```bash
   # Deploy to Vercel/production
   ```
   - Already backward compatible
   - Falls back to `user_id` if no workspace

3. **Mobile App** ⏸️
   - Wait until production is fully migrated
   - Requires `workspace_id` to exist
   - Will work automatically once migrated

## Post-Deployment Verification

- [ ] Web app loads assets correctly
- [ ] Tag management works
- [ ] Bulk operations work
- [ ] Autotagging works
- [ ] Workspace features work (if migrated)

## Files Created

- `CHECK_PRODUCTION_SCHEMA.sql` - Check schema state
- `FIX_RLS_POLICIES_HYBRID.sql` - Fix RLS policies
- `BACKWARD_COMPATIBILITY_SUMMARY.md` - Summary of changes
- `DEPLOYMENT_CHECKLIST.md` - Deployment steps
- `MOBILE_APP_DEPLOYMENT.md` - Mobile app guidance
- `RLS_POLICY_ANALYSIS.md` - Policy analysis

Good luck! 🚀

