/**
 * Auto-tagging Queue Utility
 * 
 * Handles throttling and queuing of auto-tagging requests to prevent
 * overwhelming the Edge Function with concurrent requests.
 * 
 * Features:
 * - Batch processing: Groups 5 images per API call (reduces calls by 5x)
 * - Rate limit protection: 10 second delays between batches
 * - Exponential backoff: 30s, 1m, 2m, 5m, 10m retry delays
 * - Global rate limit tracking: Prevents processing during rate limit periods
 */

type AutoTagRequest = {
  assetId: string;
  imageUrl: string;
  retryCount?: number; // Track retry attempts
  onSuccess?: (result: { assetId: string; tags: string[] }) => void;
  onError?: (error: Error) => void;
  onRetryStart?: (assetId: string) => void; // Callback when background retry starts
};

class AutoTagQueue {
  private queue: AutoTagRequest[] = [];
  private processing = false;
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchSize = 5; // Process 5 images per batch for normal operations
  private readonly bulkBatchSize = 50; // For bulk operations (20+ images), use OpenAI Batch API (OpenAI supports up to 50k, but we'll use 50 as reasonable limit)
  private readonly bulkThreshold = 20; // When 20+ images are queued, use Batch API (50% cost savings)
  private readonly batchTimeout = 5000; // Wait max 5 seconds to collect batch (increased from 3s)
  private readonly delayBetweenBatches = 10000; // 10 seconds between batches (increased from 2s to avoid rate limits)
  private readonly maxRetries = 5; // Increased retries for rate limits
  private readonly retryDelays = [30000, 60000, 120000, 300000, 600000]; // Exponential backoff: 30s, 1m, 2m, 5m, 10m
  private readonly backgroundRetryDelay = 30 * 1000; // 30 seconds for background retries
  private rateLimitResetTime: number | null = null; // Track when rate limit resets
  private lastBatchTime: number = 0; // Track when last batch was processed

  /**
   * Add a request to the queue
   * Batches requests together to reduce API calls
   */
  enqueue(request: AutoTagRequest): void {
    console.log(`[AutoTagQueue] 📥 Enqueuing asset ${request.assetId}`);
    console.log(`[AutoTagQueue] Queue length before: ${this.queue.length}`);
    this.queue.push(request);
    console.log(`[AutoTagQueue] Queue length after: ${this.queue.length}`);
    console.log(`[AutoTagQueue] Processing: ${this.processing}, Batch timer: ${!!this.batchTimer}`);
    
    // Check if this is a bulk operation (20+ images queued)
    const isBulkOperation = this.queue.length >= this.bulkThreshold;
    // For bulk operations, process ALL items (no limit for Batch API)
    // For normal operations, use batchSize limit
    const effectiveBatchSize = isBulkOperation ? this.queue.length : this.batchSize;
    
    // If batch is full and we're not already processing, process immediately
    // For bulk operations (20+), send all images in one batch to Batch API
    // If we're already processing, the current batch will check for more items after it completes
    if (this.queue.length >= effectiveBatchSize && !this.processing) {
      if (isBulkOperation) {
        console.log(`[AutoTagQueue] 🚀 BULK OPERATION detected (${this.queue.length} >= ${this.bulkThreshold}), processing ALL images in single batch...`);
      } else {
        console.log(`[AutoTagQueue] 🚀 Batch full (${this.queue.length} >= ${effectiveBatchSize}), processing immediately...`);
      }
      this.processBatch(isBulkOperation);
      return;
    }
    
    // Otherwise, set a timer to process after timeout (only if not already processing)
    if (!this.batchTimer && !this.processing) {
      console.log(`[AutoTagQueue] ⏰ Setting batch timer (${this.batchTimeout}ms)...`);
      this.batchTimer = setTimeout(() => {
        console.log(`[AutoTagQueue] ⏰ Batch timer fired, queue length: ${this.queue.length}`);
        this.batchTimer = null;
        if (this.queue.length > 0 && !this.processing) {
          const isBulk = this.queue.length >= this.bulkThreshold;
          console.log(`[AutoTagQueue] 🚀 Processing batch from timer (bulk: ${isBulk})...`);
          this.processBatch(isBulk);
        }
      }, this.batchTimeout);
    }
  }

  /**
   * Process a batch of requests
   * @param isBulkOperation - If true, process all queued items in one batch (up to bulkBatchSize)
   */
  private async processBatch(isBulkOperation: boolean = false): Promise<void> {
    // Clear any pending batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.processing) {
      console.log(`[AutoTagQueue] Already processing, skipping (queue has ${this.queue.length} items)`);
      return;
    }
    
    if (this.queue.length === 0) {
      console.log(`[AutoTagQueue] Queue empty, nothing to process`);
      return;
    }
    
    // For bulk operations (Batch API), process ALL queued items (no size limit)
    // For normal operations, use batchSize limit
    const effectiveBatchSize = isBulkOperation 
      ? this.queue.length  // Process ALL items for Batch API
      : this.batchSize;
    
    console.log(`[AutoTagQueue] Starting batch processing (queue has ${this.queue.length} items, batch size: ${effectiveBatchSize}, bulk: ${isBulkOperation})`);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:89',message:'Starting batch processing',data:{queueLength:this.queue.length,batchSize:effectiveBatchSize,isBulkOperation,totalQueued:this.queue.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Check if we need to wait due to rate limiting
    const now = Date.now();
    if (this.rateLimitResetTime && now < this.rateLimitResetTime) {
      const waitTime = this.rateLimitResetTime - now;
      console.log(`[AutoTagQueue] ⏳ Rate limited, waiting ${Math.ceil(waitTime / 1000)}s before processing batch...`);
      setTimeout(() => {
        this.processBatch();
      }, waitTime);
      return;
    }

    // Ensure minimum delay between batches to avoid rate limits
    const timeSinceLastBatch = now - this.lastBatchTime;
    if (timeSinceLastBatch < this.delayBetweenBatches) {
      const waitTime = this.delayBetweenBatches - timeSinceLastBatch;
      console.log(`[AutoTagQueue] ⏳ Waiting ${Math.ceil(waitTime / 1000)}s before next batch (rate limit protection)...`);
      setTimeout(() => {
        this.processBatch();
      }, waitTime);
      return;
    }

    this.processing = true;
    this.lastBatchTime = now;

    // Take requests from the queue
    // For bulk operations (Batch API), take ALL queued items (no limit - Batch API handles large batches)
    // For normal operations, take up to batchSize
    const batch: AutoTagRequest[] = [];
    const maxBatchSize = isBulkOperation ? this.queue.length : this.batchSize; // Take ALL for bulk, limit for normal
    for (let i = 0; i < maxBatchSize && this.queue.length > 0; i++) {
      const request = this.queue.shift();
      if (request) {
        batch.push(request);
      }
    }

    if (batch.length === 0) {
      this.processing = false;
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:125',message:'Batch extracted from queue',data:{batchLength:batch.length,remainingQueue:this.queue.length,assetIds:batch.map(r=>r.assetId)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Process the batch
    await this.processBatchRequest(batch);
    
    // Always wait before processing next batch (even if queue is empty, in case more items arrive)
    if (this.queue.length > 0) {
      await this.delay(this.delayBetweenBatches);
    }

    this.processing = false;
    
    // Process next batch if queue has more items
    // This ensures all batches are processed even if enqueued rapidly
    if (this.queue.length > 0) {
      const isBulk = this.queue.length >= this.bulkThreshold;
      console.log(`[AutoTagQueue] Queue has ${this.queue.length} remaining items, processing next batch (bulk: ${isBulk})...`);
      this.processBatch(isBulk);
    } else {
      console.log(`[AutoTagQueue] Queue empty, batch processing complete`);
    }
  }

  /**
   * Process a batch of requests with retry logic
   */
  private async processBatchRequest(batch: AutoTagRequest[]): Promise<void> {
    const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!edgeBase || !supabaseAnonKey) {
      const error = new Error('Edge function URL or API key not configured');
      console.error('[AutoTagQueue] Configuration error:', error);
      batch.forEach(req => req.onError?.(error));
      return;
    }

    // Check if we're currently rate limited
    if (this.rateLimitResetTime && Date.now() < this.rateLimitResetTime) {
      const waitTime = this.rateLimitResetTime - Date.now();
      console.log(`[AutoTagQueue] ⏳ Rate limited, waiting ${Math.ceil(waitTime / 1000)}s before retry...`);
      setTimeout(() => {
        batch.forEach(req => this.enqueue(req)); // Re-queue without incrementing retry count
      }, waitTime);
      return;
    }

    // Use the retry count from the first request (all should have same retry count)
    const retryCount = batch[0]?.retryCount || 0;

    try {
      const isBulkRequest = batch.length >= this.bulkThreshold;
      console.log(`[AutoTagQueue] Processing batch of ${batch.length} assets (attempt ${retryCount + 1}/${this.maxRetries + 1})`);
      console.log(`[AutoTagQueue] ${isBulkRequest ? '🚀 BULK REQUEST' : '📦 Normal batch'}: ${batch.length} ${isBulkRequest ? '>= ' + this.bulkThreshold : '< ' + this.bulkThreshold} images`);
      console.log(`[AutoTagQueue] Edge function will ${isBulkRequest ? 'use OpenAI Batch API (50% cost savings)' : 'use synchronous API (immediate results)'}`);
      
      // Log image URLs being sent (for debugging A2 usage) - only log first 3 and last to avoid spam
      batch.forEach((req, idx) => {
        const isA2 = req.imageUrl.includes('/ai/');
        if (idx < 3 || idx === batch.length - 1) {
          console.log(`[AutoTagQueue] Image ${idx + 1}/${batch.length}: ${req.imageUrl.substring(0, 100)}...`);
          console.log(`[AutoTagQueue]   Is A2? ${isA2 ? 'YES ✅' : 'NO ⚠️ (A1 - edge function should convert to A2)'}`);
        }
      });
      if (batch.length > 4) {
        console.log(`[AutoTagQueue] ... (${batch.length - 4} more images)`);
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:187',message:'Sending batch request to edge function',data:{batchSize:batch.length,assetIds:batch.map(r=>r.assetId),imageUrls:batch.map(r=>r.imageUrl?.substring(0,100))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const response = await fetch(`${edgeBase}/auto_tag_asset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          assets: batch.map(req => ({
            assetId: req.assetId,
            imageUrl: req.imageUrl,
          })),
        }),
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:201',message:'Received response from edge function',data:{status:response.status,ok:response.ok,headers:Object.fromEntries(response.headers.entries())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (response.ok) {
        const responseText = await response.text();
        console.log(`[AutoTagQueue] 📥 Raw response text (first 500 chars):`, responseText.substring(0, 500));
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:203',message:'Batch response received',data:{batchSize:batch.length,responseLength:responseText.length,responsePreview:responseText.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        let result: any;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`[AutoTagQueue] ❌ Failed to parse response JSON:`, parseError);
          console.error(`[AutoTagQueue] Response text:`, responseText);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:210',message:'JSON parse failed',data:{error:String(parseError),responseText:responseText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          throw new Error(`Invalid JSON response from edge function`);
        }
        
        console.log(`[AutoTagQueue] 📥 Parsed response:`, JSON.stringify(result, null, 2));
        const results = result.results || [];
        const batchId = result.batchId; // Check for batchId (Batch API async processing)
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:217',message:'Parsed batch results',data:{resultsCount:results.length,expectedCount:batch.length,results:results.map((r:any)=>({assetId:r.assetId,tagsCount:r.tags?.length||0})),batchAssetIds:batch.map(r=>r.assetId),batchId:batchId||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // If batchId(s) present, this is a Batch API async job - add to polling queue
        const batchIds = result.batchIds || (batchId ? [batchId] : []);
        if (batchIds.length > 0) {
          console.log(`[AutoTagQueue] 🚀 ${batchIds.length} Batch API job(s) created: [${batchIds.join(', ')}] - adding to polling queue`);
          try {
            // Dynamically import to avoid circular dependencies
            const { addBatchToPoll, startBatchPolling } = await import('@/utils/pollBatchStatus');
            for (const id of batchIds) {
              addBatchToPoll(id);
              console.log(`[AutoTagQueue] ✅ Added batch ${id} to polling queue`);
            }
            startBatchPolling();
          } catch (pollError) {
            console.error(`[AutoTagQueue] ❌ Failed to add batches to polling queue:`, pollError);
            // Continue processing - polling will pick it up from database
          }
        }
        
        console.log(`[AutoTagQueue] ✅ Batch success! Processed ${results.length} assets${batchIds.length > 0 ? ` (${batchIds.length} async batches)` : ''}`);
        console.log(`[AutoTagQueue] Results array:`, JSON.stringify(results, null, 2));

        if (results.length === 0 && batchIds.length === 0) {
          console.error(`[AutoTagQueue] ❌❌❌ CRITICAL: Response has empty results array and no batchIds! ❌❌❌`);
          console.error(`[AutoTagQueue] Full response object:`, JSON.stringify(result, null, 2));
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:222',message:'Empty results array',data:{batchSize:batch.length,fullResponse:JSON.stringify(result)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          // Still process callbacks with empty tags so UI can update
        } else if (results.length === 0 && batchIds.length > 0) {
          console.log(`[AutoTagQueue] ℹ️  Empty results array is expected for Batch API (${batchIds.length} batches) - tags will be populated when batches complete`);
        }
        
        // Map results back to requests
        const resultMap = new Map(results.map((r: any) => {
          // Ensure result has assetId and tags
          if (!r || typeof r !== 'object' || !r.assetId) {
            console.error(`[AutoTagQueue] ❌ Invalid result object in results array:`, r);
            return null;
          }
          return [r.assetId, r.tags || []];
        }).filter((entry): entry is [string, string[]] => entry !== null));
        
        // Verify all batch assets have results (even if empty)
        const missingAssetIds = batch.map(r => r.assetId).filter(id => !resultMap.has(id));
        if (missingAssetIds.length > 0) {
          console.warn(`[AutoTagQueue] ⚠️  Missing results for ${missingAssetIds.length} assets:`, missingAssetIds);
          // Add empty tags for missing assets
          missingAssetIds.forEach(assetId => {
            resultMap.set(assetId, []);
          });
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:226',message:'Mapping results to requests',data:{resultMapSize:resultMap.size,batchSize:batch.length,resultAssetIds:Array.from(resultMap.keys()),batchAssetIds:batch.map(r=>r.assetId)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        batch.forEach(request => {
          const tags = resultMap.get(request.assetId) || [];
          console.log(`[AutoTagQueue] Asset ${request.assetId} tags:`, tags);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:230',message:'Processing callback for asset',data:{assetId:request.assetId,tagsCount:tags.length,tags:tags,hasCallback:!!request.onSuccess},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          if (tags.length === 0) {
            console.warn(`[AutoTagQueue] ⚠️  No tags returned for asset ${request.assetId}`);
            console.warn(`[AutoTagQueue] Available assetIds in results:`, Array.from(resultMap.keys()));
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autoTagQueue.ts:233',message:'No tags for asset',data:{assetId:request.assetId,availableAssetIds:Array.from(resultMap.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
          }
          request.onSuccess?.({ assetId: request.assetId, tags });
        });
        
        this.rateLimitResetTime = null; // Clear rate limit on success
        return;
      }

      // Handle specific error codes
      const errorText = await response.text();
      let errorJson: any = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // Not JSON, use text as-is
      }

      const errorCode = errorJson.code || '';
      const statusCode = response.status;
      
      // Parse Retry-After header if present
      const retryAfter = response.headers.get('Retry-After');
      let retryAfterMs: number | null = null;
      if (retryAfter) {
        const retryAfterSeconds = parseInt(retryAfter, 10);
        if (!isNaN(retryAfterSeconds)) {
          retryAfterMs = retryAfterSeconds * 1000;
          this.rateLimitResetTime = Date.now() + retryAfterMs;
          console.log(`[AutoTagQueue] Rate limit header detected: Retry-After ${retryAfterSeconds}s`);
        }
      }

      // Handle 404 (asset not found) - mark as failed and skip, don't retry
      if (statusCode === 404) {
        console.warn(`[AutoTagQueue] ⚠️  Asset(s) not found (404) - marking as failed and skipping`);
        batch.forEach(async (req) => {
          try {
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseAnonKey) {
              const response = await fetch(`${supabaseUrl}/rest/v1/assets?id=eq.${req.assetId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({ auto_tag_status: 'failed' }),
              });
              if (response.ok) {
                console.log(`[AutoTagQueue] ✅ Marked asset ${req.assetId} as failed (not found)`);
              }
            }
          } catch (err) {
            console.error('[AutoTagQueue] Failed to mark asset as failed:', err);
          }
        });
        
        const error = new Error(`Asset(s) not found: ${errorJson.assetIds || 'unknown'}`);
        batch.forEach(req => req.onError?.(error));
        return; // Don't retry 404 errors
      }

      // Handle rate limits separately - skip immediate retry, schedule background retry
      if (statusCode === 429 || errorCode === 'RATE_LIMIT' || errorText.includes('rate limit') || errorText.includes('Rate limit')) {
        console.log(`[AutoTagQueue] ⚠️  Rate limit detected - marking as failed and scheduling background retry`);
        
        // 1. Mark assets as failed in database
        batch.forEach(async (req) => {
          try {
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseAnonKey) {
              const updateResponse = await fetch(`${supabaseUrl}/rest/v1/assets?id=eq.${req.assetId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({ auto_tag_status: 'failed' }),
              });
              if (!updateResponse.ok) {
                console.error(`[AutoTagQueue] Failed to update asset ${req.assetId} status:`, await updateResponse.text());
              }
            }
          } catch (err) {
            console.error('[AutoTagQueue] Failed to update asset status:', err);
          }
        });
        
        // 2. Call onError immediately so photos appear
        batch.forEach(req => {
          req.onError?.(new Error('Rate limit - auto-tagging will retry in background'));
        });
        
        // 2b. Call onRetryStart immediately to show retry banner
        batch.forEach(req => {
          req.onRetryStart?.(req.assetId);
        });
        
        // 3. Schedule background retry
        setTimeout(() => {
          console.log(`[AutoTagQueue] 🔄 Background retry: re-queuing ${batch.length} assets`);
          
          // Update status to pending and notify callbacks
          batch.forEach(async (req) => {
            // Update database status to pending
            try {
              const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
              const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
              if (supabaseUrl && supabaseAnonKey) {
                await fetch(`${supabaseUrl}/rest/v1/assets?id=eq.${req.assetId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'apikey': supabaseAnonKey,
                  },
                  body: JSON.stringify({ auto_tag_status: 'pending' }),
                });
              }
            } catch (err) {
              console.error('[AutoTagQueue] Failed to update asset status to pending:', err);
            }
          });
          
          // Re-queue for processing
          batch.forEach(req => {
            // Notify callback so UI can show retry banner
            req.onRetryStart?.(req.assetId);
            this.enqueue({
              ...req,
              retryCount: 0, // Reset retry count for background retry
            });
          });
        }, this.backgroundRetryDelay);
        
        // Set rate limit reset time
        const retryDelay = retryAfterMs || 120000;
        this.rateLimitResetTime = Date.now() + retryDelay;
        return; // Don't retry immediately
      }

      // Check if this is a retryable error (non-rate-limit errors)
      const isRetryable = 
        statusCode === 502 || // Bad Gateway
        statusCode === 503 || // Service Unavailable
        statusCode === 504 || // Gateway Timeout
        errorCode === 'WORKER_LIMIT' || // Resource limit
        errorCode === 'FUNCTION_INVOCATION_TIMEOUT'; // Timeout

      if (isRetryable && retryCount < this.maxRetries) {
        // Ensure status stays as pending for retries
        batch.forEach(async (req) => {
          try {
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseAnonKey) {
              await fetch(`${supabaseUrl}/rest/v1/assets?id=eq.${req.assetId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({ auto_tag_status: 'pending' }),
              });
            }
          } catch (err) {
            console.error('[AutoTagQueue] Failed to update asset status to pending:', err);
          }
        });
        
        // Use Retry-After header if available, otherwise use exponential backoff
        let retryDelay: number;
        if (retryAfterMs) {
          retryDelay = retryAfterMs;
          console.log(`[AutoTagQueue] Using Retry-After header: ${retryDelay}ms`);
        } else {
          retryDelay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];
        }
        
        console.warn(
          `[AutoTagQueue] ⚠️  Retryable error (${statusCode}/${errorCode}) for batch of ${batch.length} assets. ` +
          `Retrying in ${Math.ceil(retryDelay / 1000)}s... (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        
        // Re-queue all requests in the batch with incremented retry count
        // Don't call onError - we're retrying, so status stays pending
        setTimeout(() => {
          batch.forEach(req => {
            // Notify callback that retry is starting
            req.onRetryStart?.(req.assetId);
            this.enqueue({
              ...req,
              retryCount: retryCount + 1,
            });
          });
        }, retryDelay);
        return; // Don't call onError - we're retrying
      }

      // Non-retryable error or max retries exceeded - mark as failed
      console.error(`[AutoTagQueue] ❌ Batch failed after ${retryCount + 1} attempts - marking as failed`);
      batch.forEach(async (req) => {
        try {
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          if (supabaseUrl && supabaseAnonKey) {
            const response = await fetch(`${supabaseUrl}/rest/v1/assets?id=eq.${req.assetId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey,
              },
              body: JSON.stringify({ auto_tag_status: 'failed' }),
            });
            if (!response.ok) {
              console.error(`[AutoTagQueue] Failed to mark asset ${req.assetId} as failed:`, await response.text());
            } else {
              console.log(`[AutoTagQueue] ✅ Marked asset ${req.assetId} as failed`);
            }
          }
        } catch (err) {
          console.error('[AutoTagQueue] Failed to update asset status to failed:', err);
        }
      });

      const error = new Error(
        `Batch auto-tagging failed after ${retryCount + 1} attempts: ${statusCode} - ${errorJson.message || errorText}`
      );
      console.error(`[AutoTagQueue] ❌ Batch failed after ${retryCount + 1} attempts:`, error);
      batch.forEach(req => req.onError?.(error));

    } catch (networkError: any) {
      // Network errors are retryable
      if (retryCount < this.maxRetries) {
        // Ensure status stays as pending for retries
        batch.forEach(async (req) => {
          try {
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseAnonKey) {
              await fetch(`${supabaseUrl}/rest/v1/assets?id=eq.${req.assetId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({ auto_tag_status: 'pending' }),
              });
            }
          } catch (err) {
            console.error('[AutoTagQueue] Failed to update asset status to pending:', err);
          }
        });
        
        const retryDelay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];
        console.warn(
          `[AutoTagQueue] ⚠️  Network error for batch of ${batch.length} assets. ` +
          `Retrying in ${Math.ceil(retryDelay / 1000)}s... (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        
        // Re-queue all requests in the batch with incremented retry count
        // Don't call onError - we're retrying, so status stays pending
        setTimeout(() => {
          batch.forEach(req => {
            // Notify callback that retry is starting
            req.onRetryStart?.(req.assetId);
            this.enqueue({
              ...req,
              retryCount: retryCount + 1,
            });
          });
        }, retryDelay);
        return; // Don't call onError - we're retrying
      }

      // Max retries exceeded - mark as failed
      console.error(`[AutoTagQueue] ❌ Network error after ${retryCount + 1} attempts - marking as failed`);
      batch.forEach(async (req) => {
        try {
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          if (supabaseUrl && supabaseAnonKey) {
            const response = await fetch(`${supabaseUrl}/rest/v1/assets?id=eq.${req.assetId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey,
              },
              body: JSON.stringify({ auto_tag_status: 'failed' }),
            });
            if (!response.ok) {
              console.error(`[AutoTagQueue] Failed to mark asset ${req.assetId} as failed:`, await response.text());
            } else {
              console.log(`[AutoTagQueue] ✅ Marked asset ${req.assetId} as failed`);
            }
          }
        } catch (err) {
          console.error('[AutoTagQueue] Failed to update asset status to failed:', err);
        }
      });

      const error = new Error(`Network error after ${retryCount + 1} attempts: ${networkError.message}`);
      console.error(`[AutoTagQueue] ❌ Network error after ${retryCount + 1} attempts:`, error);
      batch.forEach(req => req.onError?.(error));
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.rateLimitResetTime = null;
    this.lastBatchTime = 0;
  }
}

// Singleton instance
export const autoTagQueue = new AutoTagQueue();

/**
 * Convenience function to queue an auto-tagging request
 */
export function queueAutoTag(
  assetId: string,
  imageUrl: string,
  callbacks?: {
    onSuccess?: (result: { assetId: string; tags: string[] }) => void;
    onError?: (error: Error) => void;
    onRetryStart?: (assetId: string) => void;
  }
): void {
  autoTagQueue.enqueue({
    assetId,
    imageUrl,
    onSuccess: callbacks?.onSuccess,
    onError: callbacks?.onError,
    onRetryStart: callbacks?.onRetryStart,
  });
}

/**
 * Bulk queue multiple assets for auto-tagging in a single batch
 * This is more efficient than queuing individually for bulk operations (15+ images)
 * All images will be sent to OpenAI in ONE API call
 */
export function queueBulkAutoTag(
  requests: Array<{
    assetId: string;
    imageUrl: string;
    onSuccess?: (result: { assetId: string; tags: string[] }) => void;
    onError?: (error: Error) => void;
    onRetryStart?: (assetId: string) => void;
  }>
): void {
  if (requests.length === 0) return;
  
  console.log(`[AutoTagQueue] 📦 Bulk enqueuing ${requests.length} assets for SINGLE batch processing`);
  console.log(`[AutoTagQueue] This will send all ${requests.length} images to OpenAI in ONE API call`);
  
  // Clear any existing queue to ensure we start fresh for bulk operations
  // This prevents mixing with any existing queued items
  const queue = autoTagQueue as any;
  const wasProcessing = queue.processing;
  const existingQueueLength = queue.queue.length;
  
  if (existingQueueLength > 0) {
    console.log(`[AutoTagQueue] ⚠️  Queue already has ${existingQueueLength} items - clearing for bulk operation`);
    queue.queue = [];
  }
  
  // Add all requests to queue without triggering individual processing
  // We'll process them all together as a bulk batch
  requests.forEach(req => {
    queue.queue.push({
      assetId: req.assetId,
      imageUrl: req.imageUrl,
      onSuccess: req.onSuccess,
      onError: req.onError,
      onRetryStart: req.onRetryStart,
      retryCount: 0,
    });
  });
  
  console.log(`[AutoTagQueue] Queue now has ${queue.queue.length} items (all bulk items)`);
  
  // Check if this qualifies for Batch API (20+ images)
  const willUseBatchAPI = requests.length >= queue.bulkThreshold;
  if (willUseBatchAPI) {
    console.log(`[AutoTagQueue] ✅ BULK OPERATION: ${requests.length} >= ${queue.bulkThreshold} images - will use OpenAI Batch API (50% cost savings)`);
  } else {
    console.log(`[AutoTagQueue] 📦 Normal batch: ${requests.length} < ${queue.bulkThreshold} images - will use synchronous API`);
  }
  
  // Trigger bulk batch processing immediately
  // This will send all queued items in a single batch to OpenAI
  if (!wasProcessing) {
    console.log(`[AutoTagQueue] 🚀 Triggering bulk batch processing for ${requests.length} assets (isBulkOperation=true)`);
    queue.processBatch(true);
  } else {
    console.log(`[AutoTagQueue] ⚠️  Already processing, waiting for current batch to complete...`);
    // Wait for current processing to finish, then process bulk batch
    const checkInterval = setInterval(() => {
      if (!queue.processing) {
        clearInterval(checkInterval);
        console.log(`[AutoTagQueue] ✅ Previous batch complete, now processing bulk batch of ${requests.length} assets`);
        queue.processBatch(true);
      }
    }, 100);
    
    // Safety timeout - if processing takes too long, force it
    setTimeout(() => {
      clearInterval(checkInterval);
      if (queue.processing) {
        console.log(`[AutoTagQueue] ⚠️  Processing timeout, forcing bulk batch processing`);
        queue.processing = false; // Reset processing flag
        queue.processBatch(true);
      }
    }, 30000); // 30 second timeout
  }
}
