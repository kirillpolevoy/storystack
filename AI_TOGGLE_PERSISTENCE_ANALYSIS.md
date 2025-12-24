# AI Toggle Persistence - Root Cause Analysis

## Problem Statement
"Use with AI" toggle does not persist after being enabled/disabled. The UI shows the change optimistically, but after refetch, it reverts to the previous state.

## Architecture Flow Analysis

### Current Flow:
1. **User Action**: Clicks "Use with AI" checkbox
2. **handleToggleAI**: Sets `togglingTag` state, calls `toggleAIMutation.mutate()`
3. **onMutate** (runs FIRST, synchronously):
   - Cancels pending queries
   - Reads current tags from cache: `['tags', activeWorkspaceId]`
   - Creates optimistic update: `{ ...tag, useWithAI: enabled }`
   - Updates cache: `queryClient.setQueryData(['tags', activeWorkspaceId], optimisticTags)`
   - Returns context: `{ previousTags, optimisticTags }`
4. **mutationFn** (runs AFTER onMutate):
   - Reads from cache: `queryClient.getQueryData(['tags', activeWorkspaceId])`
   - Filters to get `autoTags`: `optimisticTags.filter(t => t.useWithAI).map(t => t.name)`
   - Saves to DB: `upsert({ workspace_id, auto_tags: autoTags })`
5. **onSuccess** (runs AFTER mutationFn):
   - Waits 300ms
   - Refetches: `queryClient.refetchQueries(['tags', activeWorkspaceId])`

## Root Cause Identified

### Issue #1: Race Condition in Refetch
**Problem**: The `onSuccess` refetch happens 300ms after DB write, but:
- Database replication lag may be > 300ms
- The refetch reads stale data from DB
- Stale data overwrites the optimistic update
- Result: Toggle appears to revert

**Evidence**: 
- `staleTime: 0` means query is always considered stale
- Refetch immediately after write may get pre-write state
- No verification that refetch data matches what we saved

### Issue #2: Cache Read Timing in mutationFn
**Problem**: `mutationFn` reads from cache, but:
- React Query's `onMutate` runs synchronously before `mutationFn`
- However, cache updates might not be immediately visible to `mutationFn` if there's any async timing
- If cache read fails or gets stale data, wrong `autoTags` array is saved

**Evidence**:
- Code reads: `queryClient.getQueryData(['tags', activeWorkspaceId])`
- Should have optimistic update, but no guarantee
- No fallback if cache doesn't have the update

### Issue #3: Query Key Mismatch (FIXED)
**Problem**: Other mutations were invalidating `['tags']` instead of `['tags', activeWorkspaceId]`
- This could cause unexpected refetches
- **Status**: Already fixed

### Issue #4: No Verification of Database Write
**Problem**: After saving, we don't verify the write succeeded with correct data
- If upsert fails silently, we don't know
- If upsert succeeds but with wrong data, we don't know
- Refetch then gets wrong data and overwrites optimistic update

## Solution Architecture

### Option A: Use Context from onMutate (RECOMMENDED)
Pass `optimisticTags` from `onMutate` context to `mutationFn` via mutation variables.

**Pros**:
- Guaranteed to have correct data
- No cache read timing issues
- Clean separation of concerns

**Cons**:
- Requires passing data through mutation

### Option B: Don't Refetch Immediately
Keep optimistic update, only invalidate (mark stale for next access).

**Pros**:
- No race condition
- Optimistic update stays until next natural refetch
- Simpler

**Cons**:
- Data might be stale if user navigates away and back quickly

### Option C: Verify Before Refetch
After DB write, verify the saved data matches what we expect, then refetch.

**Pros**:
- Ensures data integrity
- Only refetches if write succeeded correctly

**Cons**:
- Extra DB read
- More complex

### Option D: Use Optimistic Update as Source of Truth
Don't refetch at all - trust the optimistic update matches DB.

**Pros**:
- No race conditions
- Instant UI updates
- Simpler

**Cons**:
- If DB write fails, UI shows wrong state
- Need error handling to rollback

## Recommended Fix

**Hybrid Approach**: Use context from `onMutate` + Don't refetch immediately

1. Pass `optimisticTags` from `onMutate` context to `mutationFn` via mutation variables
2. Save to DB using the passed `optimisticTags` (guaranteed correct)
3. In `onSuccess`, DON'T refetch - just keep optimistic update
4. Add error handling to rollback on failure
5. Let natural query refetch happen on next page load or manual refresh

This ensures:
- ✅ No race conditions
- ✅ Correct data saved to DB
- ✅ UI stays in sync
- ✅ Data persists on refresh

## Implementation

```typescript
mutationFn: async ({ tagName, enabled, optimisticTags }: { 
  tagName: string
  enabled: boolean
  optimisticTags: TagConfig[]  // Passed from handleToggleAI
}) => {
  // Use passed optimisticTags directly - guaranteed correct
  const autoTags = optimisticTags.filter((t) => t.useWithAI).map((t) => t.name)
  // Save to DB...
}

onMutate: async ({ tagName, enabled }) => {
  // ... existing code ...
  return { previousTags, optimisticTags }
}

onSuccess: async () => {
  // DON'T refetch - keep optimistic update
  // It's already correct and matches DB
}
```

## Why It Was Working Before

The original implementation likely:
1. Didn't refetch immediately in `onSuccess`
2. Trusted the optimistic update
3. Let natural refetch happen on next access
4. Had simpler, more reliable flow

The redesign added complexity (refetch, delays, verification) that introduced race conditions.

