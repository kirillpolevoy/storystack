# Fix Autotagging Issues

## Potential Issues

1. **No tag_config for workspace** - If a workspace doesn't have a tag_config entry, autotagging will return empty tags
2. **Empty auto_tags array** - If auto_tags is empty or null, no tags will be applied
3. **Assets missing workspace_id** - Assets must have workspace_id set

## Diagnostic Steps

1. Run `DIAGNOSE_AUTOTAGGING.sql` to check:
   - If tag_config exists for workspaces
   - If auto_tags has any tags enabled
   - If assets have workspace_id
   - If there are pending assets

## Common Fixes

### Fix 1: Create tag_config for workspace
If a workspace doesn't have tag_config, create one:

```sql
-- Replace WORKSPACE_ID with actual workspace ID
INSERT INTO tag_config (workspace_id, auto_tags)
VALUES (
  'WORKSPACE_ID_HERE',
  '[]'::jsonb  -- Start with empty array, user can enable tags in UI
)
ON CONFLICT (workspace_id) DO NOTHING;
```

### Fix 2: Enable tags for autotagging
Tags need to be enabled in the Tag Management UI. The `auto_tags` array in `tag_config` should contain tag names that are enabled for AI.

### Fix 3: Check edge function logs
Check Supabase Edge Function logs for `auto_tag_asset` to see:
- If tag_config is being found
- If workspace_id is being retrieved correctly
- If tag vocabulary is empty

## How Autotagging Works

1. Asset is uploaded with `auto_tag_status: 'pending'`
2. UploadZone batches assets and calls `auto_tag_asset` edge function
3. Edge function:
   - Gets workspace_id from asset
   - Queries `tag_config` for that workspace_id
   - Gets `auto_tags` array (enabled tags)
   - If empty, returns empty tags (no autotagging)
   - If tags exist, calls OpenAI to tag the image
   - Updates asset with tags and sets `auto_tag_status: 'completed'`

## Debugging

Check browser console for:
- `[UploadZone]` logs - shows batch tagging trigger
- `[auto_tag_asset]` logs in edge function - shows tag config fetch

Check Supabase logs for edge function errors.

