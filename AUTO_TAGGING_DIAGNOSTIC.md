# Auto-Tagging Diagnostic Guide

## Issue: Auto-tagging not running for 5 images

### Root Causes Identified

1. **No Tags Enabled** (Most Likely)
   - Edge function checks `tag_config.auto_tags` for user
   - If empty/null, returns early with empty tags (line 2337-2344)
   - No error thrown, just silent failure
   - **Fix Applied**: Added user-visible alert when all results are empty

2. **Response Not Handled Properly**
   - UploadZone wasn't extracting batchId or handling immediate results
   - **Fix Applied**: Added proper response handling for both batch and immediate processing

3. **UI Not Refreshing**
   - Query invalidation wasn't happening after tagging
   - **Fix Applied**: Added query invalidation and refetch after processing

---

## Diagnostic Steps

### Step 1: Check Tag Configuration
1. Go to `/app/tags` page
2. Check if any tags have "Use with AI" checkbox enabled
3. If none are enabled, that's the issue - enable at least one tag

### Step 2: Check Browser Console
When uploading 5 images, look for:
- `[UploadZone] 🚀 Triggering batch auto-tagging for X assets`
- `[UploadZone] 📥 Edge function response received`
- `[auto_tag_asset] Using tag vocabulary (enabled tags only)`
- `[auto_tag_asset] Number of enabled tags: X`

**If you see "Number of enabled tags: 0"** → No tags are enabled, that's the problem

### Step 3: Check Edge Function Logs
In Supabase Dashboard → Edge Functions → auto_tag_asset → Logs:
- Look for `[auto_tag_asset] No tags enabled for AI auto-tagging - skipping batch`
- This confirms no tags are enabled

---

## Fixes Applied

### Fix 1: UploadZone Response Handling
- ✅ Extract batchId from response and add to polling queue
- ✅ Handle immediate results (< 20 images)
- ✅ Invalidate queries to refresh UI
- ✅ Show alert if all results are empty (no tags enabled)

### Fix 2: Library Page Bulk Retag
- ✅ Extract batchId and add to polling queue
- ✅ Handle immediate results
- ✅ Show alert if no tags enabled

### Fix 3: Error Detection
- ✅ Detect when all results are empty
- ✅ Show user-friendly alert pointing to tag configuration

---

## Expected Behavior After Fixes

### For 5 Images (Immediate Processing):
1. User uploads 5 images
2. UploadZone calls edge function with batch request
3. Edge function processes immediately (< 20 images)
4. Edge function saves tags to database
5. Edge function returns `{ results: [{ assetId, tags }, ...] }`
6. UploadZone detects results → Invalidates queries → UI refreshes
7. If all tags empty → Shows alert about enabling tags

### If No Tags Enabled:
1. Edge function returns early with empty tags
2. UploadZone detects all empty → Shows alert
3. User goes to `/app/tags` → Enables tags → Retries

---

## Next Steps for User

1. **Check Tag Configuration**:
   - Go to `/app/tags`
   - Ensure at least one tag has "Use with AI" enabled
   - If no tags exist, create some first

2. **Test Upload Again**:
   - Upload 5 images
   - Check browser console for logs
   - Should see tags applied or alert about no tags enabled

3. **If Still Not Working**:
   - Check browser console for errors
   - Check Supabase Edge Function logs
   - Verify OpenAI API key is configured
   - Verify user has `tag_config` row with `auto_tags` array

---

## Common Issues

### Issue: "No tags enabled" alert appears
**Solution**: Go to `/app/tags` and enable tags for AI

### Issue: Edge function returns 500 error
**Solution**: Check Supabase logs, verify OpenAI API key

### Issue: Tags not appearing in UI
**Solution**: Check query invalidation is working, verify database has tags

### Issue: Batch API not working (20+ images)
**Solution**: Verify batchId is extracted and added to polling queue




