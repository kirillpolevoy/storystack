# Bulk Image Processing Architecture Review

## Current Architecture

### Flow for 20+ Images (Batch API)
1. **User Action**: Selects 20+ assets → Clicks "Retag with AI"
2. **Frontend**: Calls edge function `auto_tag_asset` with batch request
3. **Edge Function**: 
   - Creates OpenAI Batch API job
   - Stores `batch_id` in `assets.openai_batch_id` column
   - Sets `auto_tag_status = 'pending'`
   - Returns `202 Accepted` with `batchId` in response
4. **Polling**: Client-side polling checks for pending batches every 10s
5. **Batch Completion**: When OpenAI batch completes, polling calls GET endpoint
6. **Result Processing**: Edge function downloads results and updates assets

### Flow for < 20 Images (Immediate Processing)
1. **User Action**: Selects < 20 assets → Clicks "Retag with AI"
2. **Frontend**: Calls edge function `auto_tag_asset` with batch request
3. **Edge Function**: Processes immediately using `getSuggestedTagsBatch`
4. **Response**: Returns tags immediately, updates DB synchronously

## Critical Issues Identified

### Issue 1: Batch ID Not Tracked in Frontend
**Location**: `apps/web/app/app/library/page.tsx:246-257`

**Problem**: 
- Edge function returns `batchId` in response (line 2391-2398)
- Frontend receives response but **doesn't extract or track the batchId**
- Polling mechanism relies on querying DB for `openai_batch_id`, but frontend never knows which batch was created
- No way to add batch to polling queue proactively

**Code**:
```typescript
const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
  body: batchRequest,
})

if (error) {
  // Error handling
}

console.log('[LibraryPage] Bulk retag response:', data)
// ❌ Missing: Extract batchId from data and add to polling queue
```

**Fix Needed**: Extract `batchId` from response and call `addBatchToPoll(batchId)`

---

### Issue 2: Polling Mechanism Doesn't Start Properly
**Location**: `apps/web/utils/pollBatchStatus.ts:51-73`

**Problem**:
- `startBatchPolling()` is called on mount
- But it only polls if there are pending batches in DB
- If batch was just created, it might not be found immediately
- No mechanism to proactively add newly created batches

**Code**:
```typescript
export function startBatchPolling(): void {
  if (pollingState.pollInterval) {
    return // Already polling
  }
  
  pollPendingBatches() // Only finds existing batches in DB
  // ❌ Missing: No way to add new batch proactively
}
```

**Fix Needed**: After creating batch, explicitly add it to polling queue

---

### Issue 3: Response Handling Doesn't Distinguish Batch vs Immediate
**Location**: `apps/web/app/app/library/page.tsx:246-257`

**Problem**:
- Edge function returns `202 Accepted` for batch API (async)
- Edge function returns `200 OK` for immediate processing (sync)
- Frontend doesn't check status code or response structure
- Can't differentiate between async batch and immediate results

**Code**:
```typescript
const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
  body: batchRequest,
})
// ❌ Missing: Check if response is 202 (batch) or 200 (immediate)
// ❌ Missing: Handle batchId from 202 response
```

**Fix Needed**: Check response status and handle batchId appropriately

---

### Issue 4: Batch Completion Event May Not Fire
**Location**: `apps/web/utils/pollBatchStatus.ts:214-222`

**Problem**:
- `processBatchResults` is called when batch completes
- But it only dispatches event if `result.success === true`
- Edge function GET endpoint returns `{ success: true }` on success
- But if `processBatchResults` throws, event never fires
- Frontend never knows batch completed

**Code**:
```typescript
const result = await response.json()

if (result.success) {
  removeBatchFromPoll(batchId)
  window.dispatchEvent(new CustomEvent('batchCompleted', { detail: { batchId } }))
}
// ❌ Missing: Error handling if processBatchResults fails
```

**Fix Needed**: Better error handling and event dispatching

---

### Issue 5: Race Condition in Status Updates
**Location**: `apps/web/app/app/library/page.tsx:191-229`

**Problem**:
- Sets `auto_tag_status = 'pending'` before calling edge function
- Edge function also sets status to pending
- But there's a race condition: if edge function fails, status stays pending
- No rollback mechanism

**Code**:
```typescript
// Set status to pending BEFORE calling edge function
const { data: updateData, error: updateError } = await supabase
  .from('assets')
  .update({ auto_tag_status: 'pending' })
  .in('id', assetIds)

// Then call edge function
const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
  body: batchRequest,
})

// ❌ Missing: If edge function fails, status stays pending forever
```

**Fix Needed**: Only set pending after edge function confirms batch creation

---

### Issue 6: Missing Batch ID in Response Handling
**Location**: `supabase/functions/auto_tag_asset/index.ts:2391-2398`

**Problem**:
- Edge function returns `batchId` in response
- But response structure might not be properly parsed by frontend
- Supabase functions.invoke might wrap the response

**Code**:
```typescript
return new Response(JSON.stringify({ 
  results: tagResults,
  batchId,  // ✅ Included
  message: 'Batch API job created successfully...',
}), {
  status: 202,
})
```

**Fix Needed**: Verify frontend can access `data.batchId` from response

---

## Recommended Fixes

### Fix 1: Extract and Track Batch ID
```typescript
const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
  body: batchRequest,
})

if (error) {
  // Handle error
  return
}

// Check if this is a batch API response (202) or immediate (200)
if (data?.batchId) {
  console.log('[LibraryPage] Batch API job created:', data.batchId)
  // Add to polling queue immediately
  addBatchToPoll(data.batchId)
} else if (data?.results) {
  // Immediate processing - results already available
  console.log('[LibraryPage] Immediate processing complete')
}
```

### Fix 2: Improve Polling Initialization
```typescript
// After batch creation
if (data?.batchId) {
  addBatchToPoll(data.batchId)
  // Ensure polling is running
  if (!pollingState.pollInterval) {
    startBatchPolling()
  }
}
```

### Fix 3: Better Error Handling
```typescript
// Only set pending AFTER batch is confirmed created
const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
  body: batchRequest,
})

if (error) {
  // Don't set pending if batch creation failed
  throw error
}

if (data?.batchId) {
  // Batch created successfully - now set pending
  await supabase
    .from('assets')
    .update({ auto_tag_status: 'pending' })
    .in('id', assetIds)
}
```

### Fix 4: Verify Edge Function Response Structure
Check that Supabase functions.invoke properly unwraps the Response JSON.

---

## Testing Checklist

1. ✅ Create batch with 20+ images → Verify batchId returned
2. ✅ Verify batchId stored in database
3. ✅ Verify polling picks up batch
4. ✅ Verify batch completion triggers result processing
5. ✅ Verify assets updated with tags
6. ✅ Verify UI shows updated tags
7. ✅ Test with < 20 images (immediate processing)
8. ✅ Test error scenarios (API failure, network error)

---

## Priority Fixes

1. **HIGH**: Extract batchId from response and add to polling queue
2. **HIGH**: Fix status update race condition
3. **MEDIUM**: Improve error handling in polling
4. **MEDIUM**: Verify response structure parsing
5. **LOW**: Add better logging and monitoring




