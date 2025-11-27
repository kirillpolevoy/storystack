# Troubleshooting Auto-Tagging

## Current Status
- ✅ Tags are enabled in Tag Management UI
- ❌ Auto-tagging is not running

## Possible Issues

### 1. Tags Not Saved to Database
Even though tags show as enabled in UI, they might not be saved to `tag_config.auto_tags` in the database.

**Check:** Run `VERIFY_TAG_SAVE.sql` to see what's actually in the database.

**Fix:** If `auto_tags` is empty or NULL:
- Go to Tag Management screen
- Toggle a tag OFF, then ON again (this triggers save)
- Check console logs for `[TagManagement] ✅ Auto-tag config saved successfully`

### 2. Edge Function URL Not Configured
Auto-tagging requires `EXPO_PUBLIC_EDGE_BASE_URL` to be set.

**Check:** Look for this warning in console:
```
[AutoTag] Edge function URL not configured. Set EXPO_PUBLIC_EDGE_BASE_URL to enable auto-tagging.
```

**Fix:** Set environment variable:
```bash
EXPO_PUBLIC_EDGE_BASE_URL=https://your-project.supabase.co/functions/v1
```

### 3. Edge Function Not Being Called
Check console logs when importing photos:
- Should see: `[AutoTag] Triggering auto-tagging for asset: [id]`
- Should see: `[AutoTag] Image URL: [url]`

If you don't see these, the edge function isn't being called.

### 4. Edge Function Failing
Check edge function logs in Supabase Dashboard:
- Go to Edge Functions → auto_tag_asset → Logs
- Look for errors about:
  - Missing user_id
  - Empty tag vocabulary
  - OpenAI API errors

### 5. Tags Enabled But Empty Array
If `auto_tags` is `[]` (empty array), auto-tagging will skip.

**Check:** Run `VERIFY_TAG_SAVE.sql`

**Fix:** Enable at least one tag in Tag Management screen.

## Debug Steps

1. **Check Database:**
   ```sql
   SELECT auto_tags FROM tag_config 
   WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;
   ```

2. **Check Console Logs:**
   - When importing photo, look for `[AutoTag]` messages
   - When toggling tags, look for `[TagManagement]` messages

3. **Check Edge Function:**
   - Supabase Dashboard → Edge Functions → auto_tag_asset → Logs
   - Look for errors or warnings

4. **Test Edge Function Directly:**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/auto_tag_asset \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"assetId": "some-asset-id", "imageUrl": "https://example.com/image.jpg"}'
   ```

## Expected Flow

1. User enables tags in Tag Management → `saveAutoTagConfig()` saves to `tag_config.auto_tags`
2. User imports photo → Edge function is called
3. Edge function gets `user_id` from asset → Loads `tag_config.auto_tags` for that user
4. Edge function uses enabled tags for AI tagging → Updates asset with tags

## Quick Test

1. Enable a tag in Tag Management (toggle switch ON)
2. Check console: Should see `[TagManagement] ✅ Auto-tag config saved successfully`
3. Import a new photo
4. Check console: Should see `[AutoTag] Triggering auto-tagging`
5. Check edge function logs in Supabase Dashboard


