# Debug Autotagging - Step by Step

## Step 1: Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions → `auto_tag_asset` → Logs
2. Look for recent invocations when you upload an asset
3. Check for these log messages:
   - `[auto_tag_asset] 🔍 Fetching tag_config from database for workspace:`
   - `[auto_tag_asset] 📦 Config retrieved:`
   - `[auto_tag_asset] ✅ Loaded auto_tags from config:` OR
   - `[auto_tag_asset] ⚠️  No tags enabled - auto-tagging will be skipped`

## Step 2: Run Diagnostic SQL

Run `DIAGNOSE_AUTOTAGGING.sql` to check:
- If tag_config exists for your workspace
- If auto_tags has any tags
- If assets have workspace_id

## Step 3: Check Tag Management UI

1. Go to `/app/tags`
2. Check if any tags are shown
3. Toggle "Use with AI" checkbox for tags you want to use
4. Verify tags appear in the list

## Step 4: Verify Workspace ID

Check if assets have workspace_id set:
```sql
SELECT id, workspace_id, auto_tag_status, created_at 
FROM assets 
WHERE deleted_at IS NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

## Step 5: Check tag_config

```sql
-- Replace WORKSPACE_ID with your actual workspace ID
SELECT workspace_id, auto_tags, array_length(auto_tags, 1) as tag_count
FROM tag_config
WHERE workspace_id = 'YOUR_WORKSPACE_ID_HERE';
```

## Common Issues

### Issue 1: No tag_config for workspace
**Fix:** Run the migration `20251219134928_ensure_tag_config_for_workspaces.sql` or manually create:
```sql
INSERT INTO tag_config (workspace_id, auto_tags)
VALUES ('YOUR_WORKSPACE_ID', ARRAY[]::text[])
ON CONFLICT (workspace_id) DO NOTHING;
```

### Issue 2: Empty auto_tags array
**Fix:** Enable tags in Tag Management UI (`/app/tags`). Toggle "Use with AI" for tags you want.

### Issue 3: Assets missing workspace_id
**Fix:** This shouldn't happen if upload is working correctly. Check upload code.

### Issue 4: Edge function not being called
**Fix:** Check browser console for `[UploadZone]` logs. Verify assets are being uploaded with `auto_tag_status: 'pending'`.

## Expected Flow

1. Asset uploaded → `auto_tag_status: 'pending'`
2. UploadZone batches assets → calls `auto_tag_asset` edge function
3. Edge function:
   - Gets workspace_id from asset ✅
   - Queries tag_config for workspace_id ✅
   - Gets auto_tags array ✅
   - If empty → returns empty tags (no autotagging) ⚠️
   - If tags exist → calls OpenAI → updates asset ✅

## Next Steps

1. Check edge function logs first - this will tell you exactly what's happening
2. Run diagnostic SQL to verify database state
3. Enable tags in Tag Management UI
4. Try uploading a new asset and check logs again

