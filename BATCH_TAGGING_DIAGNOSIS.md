# Batch Tagging Not Triggering - Principal Engineer Analysis

## Problem Statement
Uploading more than 1 image does not result in auto-tagging. Single image works, but 2-19 images don't trigger auto-tagging.

## Expected Behavior
- **< 20 images**: Process synchronously (same as single image) - immediate results, tags saved to DB
- **20+ images**: Use OpenAI Batch API, kick off polling

## Current Flow Analysis

### Upload Flow (< 20 images)
1. User uploads 5 images
2. Each upload succeeds → `onSuccess` callback fires
3. Asset added to `uploadedAssets` state + ref
4. When queue empty → `triggerBatchTagging` called after 500ms delay
5. Edge function called with batch request
6. Edge function queries DB for assets (with retry logic)
7. If assets found → Process with `getSuggestedTagsBatch`
8. Tags saved to DB
9. Response returned with `{ results: [...] }`
10. Frontend invalidates queries to refresh UI

## Potential Issues Identified

### Issue 1: Race Condition - Assets Not Committed Yet
**Location**: `UploadZone.tsx` line 104-121

**Problem**: 
- `triggerBatchTagging` is called 500ms after queue is empty
- But assets might not be committed/queryable in DB yet
- Edge function retry logic (8 retries, exponential backoff) might not be enough
- OR retry logic finds assets but then processing fails silently

**Evidence**:
- Edge function has retry logic (lines 2307-2335)
- But if assets aren't found after 8 retries, it returns 404 error
- Frontend doesn't handle 404 error - just logs and returns

### Issue 2: Edge Function Error Not Handled
**Location**: `UploadZone.tsx` line 323-336

**Problem**:
- If edge function returns error (404, 500, etc.), frontend just logs and returns
- No retry mechanism
- No user feedback
- Batch tagging silently fails

### Issue 3: Response Handling May Be Wrong
**Location**: `UploadZone.tsx` line 365-378

**Problem**:
- Checks for `data?.results` but edge function might return error
- If edge function returns 404 (assets not found), `data` might be null
- No fallback or retry

### Issue 4: Timing Issue
**Location**: `UploadZone.tsx` line 104

**Problem**:
- 500ms delay might not be enough for DB replication
- Should wait longer OR add retry logic in frontend

## Root Cause Hypothesis

**Most Likely**: Race condition where edge function is called before assets are queryable in database.

When multiple images upload:
1. Uploads complete → Assets committed to DB (async)
2. 500ms delay → Not enough time for DB replication
3. Edge function called → Queries DB → Assets not found
4. Retry logic runs → Still not found (replication lag)
5. Edge function returns 404 → Frontend logs error and gives up

## Recommended Fixes

### Fix 1: Increase Delay Before Batch Tagging
Add longer delay (2-3 seconds) before calling `triggerBatchTagging` to ensure assets are committed.

### Fix 2: Add Frontend Retry Logic
If edge function returns 404 (assets not found), retry after delay instead of giving up.

### Fix 3: Process Assets Individually as Fallback
If batch fails with 404, try processing assets individually with delays.

### Fix 4: Better Error Handling
Show user feedback when batch tagging fails, allow manual retry.

## Immediate Action Items

1. Add logging to see if edge function is being called
2. Check edge function logs to see if assets are found
3. Add delay before calling `triggerBatchTagging`
4. Add retry logic in frontend for 404 errors
5. Add user feedback for failures




