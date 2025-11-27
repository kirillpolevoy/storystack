# Check Edge Function Call

Since tags are correctly saved (9 enabled), the issue is likely:

1. **Edge function URL not configured** - Check console for:
   ```
   [AutoTag] Edge function URL not configured. Set EXPO_PUBLIC_EDGE_BASE_URL to enable auto-tagging.
   ```

2. **Edge function not being called** - When importing a photo, check console for:
   ```
   [AutoTag] Triggering auto-tagging for asset: [id]
   [AutoTag] Image URL: [url]
   ```

3. **Edge function failing** - Check Supabase Dashboard → Edge Functions → auto_tag_asset → Logs

## Next Steps

1. **Import a new photo** and watch the console logs
2. **Check for these messages:**
   - `[AutoTag] Triggering auto-tagging for asset: ...` ← Should appear
   - `[AutoTag] ✅ Success! Tags: [...]` ← Should appear if working
   - `[AutoTag] ❌ Edge function error: ...` ← If this appears, check error details

3. **Check Edge Function Logs:**
   - Go to Supabase Dashboard
   - Edge Functions → auto_tag_asset → Logs
   - Look for:
     - `[auto_tag_asset] Fetching tag_config from database for user: ...`
     - `[auto_tag_asset] ✅ Loaded auto_tags from config: [...]`
     - Any errors

4. **Verify Environment Variable:**
   - Check your `.env` or `.env.local` file
   - Should have: `EXPO_PUBLIC_EDGE_BASE_URL=https://your-project.supabase.co/functions/v1`
   - Format: `https://[project-ref].supabase.co/functions/v1`

## Common Issues

- **Missing EXPO_PUBLIC_EDGE_BASE_URL**: Edge function won't be called
- **Wrong edge function URL format**: Should end with `/functions/v1`
- **Edge function not deployed**: Check Supabase Dashboard → Edge Functions
- **OpenAI API key missing**: Check edge function environment variables in Supabase


