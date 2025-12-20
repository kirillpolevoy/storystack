# Batch Tagging Fix - Principal Engineer Analysis

## Root Cause Identified

**Primary Issue**: Race condition - Edge function called before assets are queryable in database

When uploading multiple images:
1. Uploads complete → Assets committed to DB (async operation)
2. 500ms delay → **NOT ENOUGH** time for DB replication/commit
3. Edge function called → Queries DB → Assets not found
4. Edge function retry logic (8 retries) → Still not found (replication lag)
5. Edge function returns 404 → Frontend logs error and **gives up**

## Fixes Applied

### Fix 1: Dynamic Delay Based on Asset Count
**Location**: `UploadZone.tsx` - All batch tagging trigger points

**Change**:
- Single image: 500ms delay (unchanged)
- Multiple images: 2-5 seconds delay (scales with count)
- Formula: `Math.min(2000 + (assetCount * 200), 5000)`
  - 2 images: 2400ms
  - 5 images: 3000ms  
  - 10 images: 4000ms
  - 20+ images: 5000ms (max)

**Rationale**: More assets = more DB operations = longer commit time

### Fix 2: Frontend Retry Logic for 404 Errors
**Location**: `triggerBatchTagging` function

**Change**:
- Detects 404 "Assets not found" errors
- Retries up to 3 times with 2-second delays
- Only retries for 404 errors (not other errors)
- Prevents infinite retries

**Rationale**: Handles edge cases where delay wasn't enough

### Fix 3: Better Error Detection
**Change**:
- Checks for "not found", "Assets not found", or status 404
- Distinguishes between retryable (404) and non-retryable errors
- No retry for "no tags enabled" errors

## Code Changes

### UploadZone.tsx

1. **Dynamic Delay Calculation**:
```typescript
const assetCount = uploadedAssetsRef.current.length
const delay = assetCount > 1 ? Math.min(2000 + (assetCount * 200), 5000) : 500
```

2. **Retry Logic in triggerBatchTagging**:
```typescript
const triggerBatchTagging = useCallback(async (assets, retryCount = 0) => {
  // ... call edge function ...
  
  if (error && isNotFoundError && retryCount < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, retryDelay))
    return triggerBatchTagging(assets, retryCount + 1)
  }
}, [])
```

3. **Ref Sync**:
- All `setUploadedAssets` calls now also update `uploadedAssetsRef.current`
- Ensures ref is always in sync with state

## Expected Behavior After Fix

### < 20 Images (Immediate Processing):
1. User uploads 5 images
2. Each upload completes → Asset added to collection
3. Queue becomes empty → Wait 3 seconds (for 5 images)
4. Edge function called → Assets found in DB (after delay)
5. Edge function processes immediately → Tags saved to DB
6. Response returned → UI refreshes → Tags visible

### 20+ Images (Batch API):
1. User uploads 25 images
2. Each upload completes → Asset added to collection
3. Queue becomes empty → Wait 5 seconds (max delay)
4. Edge function called → Assets found in DB
5. Edge function creates Batch API job → Returns batchId
6. Frontend adds to polling queue → Polls for completion
7. When batch completes → Tags saved → UI refreshes

## Testing Checklist

1. ✅ Upload 1 image → Should work (500ms delay)
2. ✅ Upload 5 images → Should work (3s delay + retry if needed)
3. ✅ Upload 10 images → Should work (4s delay + retry if needed)
4. ✅ Upload 25 images → Should use Batch API (5s delay)
5. ✅ Check browser console → Should see delay logs
6. ✅ Check edge function logs → Should see assets found
7. ✅ Verify tags appear → Should see tags after processing

## Monitoring

Watch for these logs:
- `[UploadZone] Waiting Xms before batch tagging (Y assets)...`
- `[UploadZone] 🚀 Triggering batch auto-tagging for Y assets`
- `[auto_tag_asset] Processing batch of Y assets`
- `[auto_tag_asset] Found Y assets` (should match requested count)

If you see retries:
- `[UploadZone] ⚠️ Assets not found (likely DB replication lag). Retrying...`

## Next Steps

1. Test with 5 images → Verify tags appear
2. Check browser console for timing logs
3. Check Supabase Edge Function logs for asset queries
4. If still failing, check DB replication settings




