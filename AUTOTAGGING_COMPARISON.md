# Autotagging Implementation: Mobile App vs Web App

## Overview

Both mobile and web apps use the same backend Edge Function (`supabase/functions/auto_tag_asset`) but differ in how they trigger and handle autotagging.

## Shared Backend: Edge Function

**Location:** `supabase/functions/auto_tag_asset/index.ts`

**Key Features:**
- Uses OpenAI Vision API for image analysis
- Workspace-scoped tag vocabulary (from `tag_config.auto_tags`)
- Supports two processing modes:
  - **Synchronous API** (< 20 images): Immediate processing
  - **Batch API** (≥ 20 images): Async processing with 50% cost savings
- Image optimization: Resizes to 1024px long edge for AI processing
- Returns tags that match the workspace's enabled tag vocabulary

## Mobile App Implementation

### Architecture

**Queue System:** `utils/autoTagQueue.ts`
- **Batch Processing**: Groups 5 images per API call (reduces calls by 5x)
- **Rate Limiting**: 10-second delays between batches
- **Retry Logic**: Exponential backoff (30s, 1m, 2m, 5m, 10m)
- **Background Retries**: 30-second delay for rate-limited requests
- **Status Tracking**: Updates `auto_tag_status` in database (`pending`, `failed`, `completed`)

### Flow

1. **Photo Import** (`app/index.tsx`):
   - User selects photos via native ImagePicker
   - Photos are compressed, uploaded, and inserted into database
   - Each asset is inserted with `auto_tag_status: 'pending'`
   - After all uploads complete, assets are queued for autotagging

2. **Queuing** (`utils/autoTagQueue.ts`):
   ```typescript
   // Individual queuing (normal flow)
   queueAutoTag(assetId, publicUrl, {
     onSuccess: (result) => { /* update UI */ },
     onError: (error) => { /* handle error */ },
     onRetryStart: (assetId) => { /* show retry banner */ }
   })
   
   // Bulk queuing (20+ images)
   queueBulkAutoTag(assets) // Sends all in ONE batch to OpenAI
   ```

3. **Batch Processing**:
   - **< 20 images**: Uses synchronous API (immediate results)
   - **≥ 20 images**: Uses OpenAI Batch API (async, 50% cost savings)
   - Batches of 5 images per API call (normal mode)
   - All images in one batch (bulk mode for 20+)

4. **Status Updates**:
   - `pending` → Processing started
   - `completed` → Tags successfully applied
   - `failed` → Error occurred (with retry logic)

5. **UI Feedback**:
   - Shows loading indicators on photos being tagged
   - Displays success indicators when tags are applied
   - Shows retry banners for failed/rate-limited requests
   - Periodic polling checks for pending assets (every 30 seconds)

### Key Characteristics

- **Queue-based**: Uses a sophisticated queue system with rate limiting
- **Individual callbacks**: Each asset has success/error callbacks
- **Background retries**: Automatically retries failed requests
- **Status persistence**: Database tracks `auto_tag_status` for each asset
- **Optimistic updates**: UI updates immediately, syncs with DB later

## Web App Implementation

### Architecture

**Direct Batch Calls:** `apps/web/components/library/UploadZone.tsx`
- **Batch Collection**: Collects all uploaded assets before triggering
- **Single API Call**: Sends all assets in ONE request to edge function
- **Polling System**: Polls for batch completion (every 10 seconds)
- **No Queue**: Direct calls, no intermediate queue system

### Flow

1. **Photo Upload** (`apps/web/utils/upload.ts`):
   - User drags/drops or selects files
   - Files are processed, compressed, and uploaded
   - Each asset is inserted with `auto_tag_status: 'pending'`
   - Assets are collected in an array as they complete

2. **Batch Triggering** (`apps/web/components/library/UploadZone.tsx`):
   ```typescript
   // After ALL uploads complete
   triggerBatchTagging(uploadedAssets)
   
   // Calls edge function with ALL assets at once
   supabase.functions.invoke('auto_tag_asset', {
     body: { assets: [...allAssets] }
   })
   ```

3. **Response Handling**:
   - **< 20 images**: Immediate results, tags applied synchronously
   - **≥ 20 images**: Returns `batchId`, triggers polling system
   - Polling checks batch status every 10 seconds
   - Updates UI when batch completes

4. **Polling** (`apps/web/utils/pollBatchStatus.ts`):
   - Polls edge function for batch completion
   - Checks database for pending batches
   - Dispatches `batchCompleted` event when done
   - Components listen for events to refresh UI

### Key Characteristics

- **Direct batch calls**: No queue, sends all assets at once
- **Polling-based**: Uses polling to check batch status
- **Simpler architecture**: Less complex than mobile queue system
- **Event-driven**: Uses browser events for UI updates
- **Database-driven**: Relies on database status for tracking

## Key Differences

| Aspect | Mobile App | Web App |
|--------|-----------|---------|
| **Trigger Method** | Queue-based (`autoTagQueue`) | Direct batch call |
| **Batch Size** | 5 images per call (normal), all images (bulk) | All images in one call |
| **Rate Limiting** | Built-in (10s delays, exponential backoff) | Handled by edge function |
| **Retry Logic** | Sophisticated (exponential backoff, background retries) | Basic (edge function handles) |
| **Status Tracking** | Database + in-memory queue | Database + polling |
| **UI Updates** | Callback-based (immediate) | Event-based (polling) |
| **Error Handling** | Per-asset callbacks | Batch-level error handling |
| **Background Processing** | Yes (retries pending assets) | Yes (polling checks batches) |
| **Cost Optimization** | Batches of 5 (normal), Batch API for 20+ | Batch API for 20+ |

## Advantages

### Mobile App Queue System
- ✅ Better rate limit protection
- ✅ More granular error handling (per-asset)
- ✅ Sophisticated retry logic
- ✅ Works well for incremental uploads
- ✅ Handles network interruptions gracefully

### Web App Direct Batch
- ✅ Simpler implementation
- ✅ More efficient for bulk uploads (single API call)
- ✅ Less client-side complexity
- ✅ Better for web's stateless nature
- ✅ Easier to debug (fewer moving parts)

## Recommendations

1. **Mobile**: Keep queue system - it's well-suited for mobile's network conditions
2. **Web**: Consider adding queue system for better rate limit handling on large uploads
3. **Unified**: Both could benefit from shared retry/error handling utilities
4. **Monitoring**: Add metrics to compare performance between implementations

## Edge Function Behavior

Both platforms use the same edge function, which:
- Detects batch size automatically
- Uses Batch API for 20+ images (50% cost savings)
- Uses synchronous API for < 20 images (immediate results)
- Fetches workspace-specific tag vocabulary
- Returns tags that match enabled tags only
- Updates database with tags and status

