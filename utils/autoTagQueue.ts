/**
 * Auto-tagging Queue Utility
 * 
 * Handles throttling and queuing of auto-tagging requests to prevent
 * overwhelming the Edge Function with concurrent requests.
 */

type AutoTagRequest = {
  assetId: string;
  imageUrl: string;
  retryCount?: number; // Track retry attempts
  onSuccess?: (result: { assetId: string; tags: string[] }) => void;
  onError?: (error: Error) => void;
};

class AutoTagQueue {
  private queue: AutoTagRequest[] = [];
  private processing = false;
  private readonly delayBetweenRequests = 2000; // 2 seconds between requests
  private readonly maxRetries = 3;
  private readonly retryDelays = [5000, 10000, 20000]; // Exponential backoff: 5s, 10s, 20s

  /**
   * Add a request to the queue
   */
  enqueue(request: AutoTagRequest): void {
    this.queue.push(request);
    this.processQueue();
  }

  /**
   * Process the queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) break;

      await this.processRequest(request);
      
      // Wait before processing next request to avoid overwhelming the Edge Function
      if (this.queue.length > 0) {
        await this.delay(this.delayBetweenRequests);
      }
    }

    this.processing = false;
  }

  /**
   * Process a single request with retry logic
   */
  private async processRequest(request: AutoTagRequest): Promise<void> {
    const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!edgeBase || !supabaseAnonKey) {
      const error = new Error('Edge function URL or API key not configured');
      console.error('[AutoTagQueue] Configuration error:', error);
      request.onError?.(error);
      return;
    }

    const retryCount = request.retryCount || 0;

    try {
      console.log(`[AutoTagQueue] Processing auto-tagging for asset: ${request.assetId} (attempt ${retryCount + 1}/${this.maxRetries + 1})`);

      const response = await fetch(`${edgeBase}/auto_tag_asset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ assetId: request.assetId, imageUrl: request.imageUrl }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[AutoTagQueue] ✅ Success! Tags:`, result.tags);
        request.onSuccess?.(result);
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

      // Check if this is a retryable error
      const isRetryable = 
        statusCode === 502 || // Bad Gateway
        statusCode === 503 || // Service Unavailable
        statusCode === 504 || // Gateway Timeout
        errorCode === 'WORKER_LIMIT' || // Resource limit
        errorCode === 'FUNCTION_INVOCATION_TIMEOUT'; // Timeout

      if (isRetryable && retryCount < this.maxRetries) {
        const retryDelay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];
        console.warn(
          `[AutoTagQueue] ⚠️  Retryable error (${statusCode}/${errorCode}) for asset ${request.assetId}. ` +
          `Retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        
        // Re-queue the request with incremented retry count
        setTimeout(() => {
          this.enqueue({
            ...request,
            retryCount: retryCount + 1,
          });
        }, retryDelay);
        return;
      }

      // Non-retryable error or max retries exceeded
      const error = new Error(
        `Auto-tagging failed after ${retryCount + 1} attempts: ${statusCode} - ${errorJson.message || errorText}`
      );
      console.error(`[AutoTagQueue] ❌ Failed after ${retryCount + 1} attempts:`, error);
      request.onError?.(error);

    } catch (networkError: any) {
      // Network errors are retryable
      if (retryCount < this.maxRetries) {
        const retryDelay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];
        console.warn(
          `[AutoTagQueue] ⚠️  Network error for asset ${request.assetId}. ` +
          `Retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        
        // Re-queue the request with incremented retry count
        setTimeout(() => {
          this.enqueue({
            ...request,
            retryCount: retryCount + 1,
          });
        }, retryDelay);
        return;
      }

      const error = new Error(`Network error after ${retryCount + 1} attempts: ${networkError.message}`);
      console.error(`[AutoTagQueue] ❌ Network error after ${retryCount + 1} attempts:`, error);
      request.onError?.(error);
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
  }
): void {
  autoTagQueue.enqueue({
    assetId,
    imageUrl,
    onSuccess: callbacks?.onSuccess,
    onError: callbacks?.onError,
  });
}

