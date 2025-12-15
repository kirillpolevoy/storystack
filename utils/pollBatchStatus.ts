/**
 * Client-side batch polling utility
 * Polls for completed OpenAI batches and processes results
 * 
 * This is a fallback/optimization when the app is open.
 * The primary polling happens server-side via pg_cron.
 */

import { supabase } from '@/lib/supabase';

const EDGE_FUNCTION_BASE_URL = process.env.EXPO_PUBLIC_EDGE_BASE_URL || '';
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 1800; // Stop after 1 hour (1800 * 2s)

interface PollingState {
  batchIds: Set<string>;
  pollInterval: NodeJS.Timeout | null;
  attemptCount: number;
}

let pollingState: PollingState = {
  batchIds: new Set(),
  pollInterval: null,
  attemptCount: 0,
};

/**
 * Start polling for pending batches
 * Call this when the app loads or when a batch is created
 */
export function startBatchPolling(): void {
  if (pollingState.pollInterval) {
    console.log('[BatchPolling] Already polling, skipping start');
    return;
  }

  console.log('[BatchPolling] 🚀 Starting batch polling (every 2 seconds)...');
  
  // Initial poll
  pollPendingBatches();
  
  // Set up interval - poll every 2 seconds
  pollingState.pollInterval = setInterval(() => {
    pollingState.attemptCount++;
    
    if (pollingState.attemptCount >= MAX_POLL_ATTEMPTS) {
      console.log('[BatchPolling] ⏹️  Max poll attempts reached, stopping');
      stopBatchPolling();
      return;
    }
    
    pollPendingBatches();
  }, POLL_INTERVAL_MS);
}

/**
 * Stop polling
 */
export function stopBatchPolling(): void {
  if (pollingState.pollInterval) {
    clearInterval(pollingState.pollInterval);
    pollingState.pollInterval = null;
    pollingState.attemptCount = 0;
    console.log('[BatchPolling] ⏹️  Stopped polling');
  }
}

/**
 * Add a batch ID to poll for
 */
export function addBatchToPoll(batchId: string): void {
  pollingState.batchIds.add(batchId);
  console.log(`[BatchPolling] ➕ Added batch ${batchId} to polling queue`);
  
  // Start polling if not already running
  if (!pollingState.pollInterval) {
    startBatchPolling();
  }
}

/**
 * Remove a batch ID from polling
 */
export function removeBatchFromPoll(batchId: string): void {
  pollingState.batchIds.delete(batchId);
  console.log(`[BatchPolling] ➖ Removed batch ${batchId} from polling queue`);
  
  // Stop polling if no batches left
  if (pollingState.batchIds.size === 0 && pollingState.pollInterval) {
    stopBatchPolling();
  }
}

/**
 * Poll for pending batches
 */
async function pollPendingBatches(): Promise<void> {
  if (!supabase) {
    console.warn('[BatchPolling] ⚠️  Supabase not initialized');
    return;
  }

  try {
    // Find assets with pending batch IDs
    const { data: assets, error } = await supabase
      .from('assets')
      .select('openai_batch_id')
      .not('openai_batch_id', 'is', null)
      .eq('auto_tag_status', 'pending')
      .limit(20);

    if (error) {
      console.error('[BatchPolling] ❌ Error fetching pending batches:', error);
      return;
    }

    if (!assets || assets.length === 0) {
      // No pending batches, stop polling
      if (pollingState.batchIds.size === 0) {
        stopBatchPolling();
      }
      return;
    }

    // Get unique batch IDs
    const batchIds = new Set(
      assets
        .map(a => a.openai_batch_id)
        .filter((id): id is string => id !== null)
    );

    console.log(`[BatchPolling] 🔍 Found ${batchIds.size} pending batches to check (polling every 2s)`);

    // Poll each batch (in parallel for faster processing)
    const pollPromises = Array.from(batchIds).map(batchId => pollBatch(batchId));
    await Promise.allSettled(pollPromises);
  } catch (error) {
    console.error('[BatchPolling] ❌ Error in pollPendingBatches:', error);
  }
}

/**
 * Poll a specific batch
 */
async function pollBatch(batchId: string): Promise<void> {
  if (!EDGE_FUNCTION_BASE_URL) {
    console.warn('[BatchPolling] ⚠️  Edge function URL not configured');
    return;
  }

  try {
    const url = `${EDGE_FUNCTION_BASE_URL}/auto_tag_asset?batch_id=${batchId}`;
    
    console.log(`[BatchPolling] 🔄 Polling batch ${batchId}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Batch not found or already processed
        removeBatchFromPoll(batchId);
        return;
      }
      
      const errorText = await response.text();
      console.error(`[BatchPolling] ❌ Error polling batch ${batchId}: ${response.status} ${errorText}`);
      return;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log(`[BatchPolling] ✅ Batch ${batchId} processed successfully`);
      removeBatchFromPoll(batchId);
      
      // Trigger a refresh of assets to show updated tags
      // You can emit an event or call a callback here
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('batchCompleted', { detail: { batchId } }));
      }
    }
  } catch (error) {
    console.error(`[BatchPolling] ❌ Error polling batch ${batchId}:`, error);
  }
}

/**
 * Initialize polling on app load
 * Call this from your app's root component or when user logs in
 */
export function initializeBatchPolling(): void {
  // Check for pending batches and start polling
  startBatchPolling();
}




