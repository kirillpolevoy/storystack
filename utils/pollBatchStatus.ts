/**
 * Client-side batch polling utility
 * Polls for completed OpenAI batches and processes results
 * 
 * This is a fallback/optimization when the app is open.
 * The primary polling happens server-side via pg_cron.
 */

import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EDGE_FUNCTION_BASE_URL = process.env.EXPO_PUBLIC_EDGE_BASE_URL || '';
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 1800; // Stop after 1 hour (1800 * 2s)

interface PollingState {
  batchIds: Set<string>;
  pollInterval: NodeJS.Timeout | null;
  attemptCount: number;
  onBatchCompleteCallbacks: Set<() => void | Promise<void>>;
}

let pollingState: PollingState = {
  batchIds: new Set(),
  pollInterval: null,
  attemptCount: 0,
  onBatchCompleteCallbacks: new Set(),
};

/**
 * Register a callback to be called when a batch completes
 * Useful for refreshing UI immediately when batches finish
 * Callback receives batchId as parameter for tracking purposes
 */
export function onBatchComplete(callback: (batchId?: string) => void | Promise<void>): () => void {
  pollingState.onBatchCompleteCallbacks.add(callback);
  console.log(`[BatchPolling] ➕ Registered batch completion callback (total: ${pollingState.onBatchCompleteCallbacks.size})`);
  
  // Return unsubscribe function
  return () => {
    pollingState.onBatchCompleteCallbacks.delete(callback);
    console.log(`[BatchPolling] ➖ Unregistered batch completion callback (remaining: ${pollingState.onBatchCompleteCallbacks.size})`);
  };
}

/**
 * Start polling for pending batches
 * Call this when the app loads or when a batch is created
 */
export function startBatchPolling(): void {
  if (pollingState.pollInterval) {
    console.log('[BatchPolling] ⚠️  Already polling, skipping start');
    console.log(`[BatchPolling] ⚠️  Currently tracking ${pollingState.batchIds.size} batch(es)`);
    return;
  }

  console.log('[BatchPolling] 🚀🚀🚀 STARTING BATCH POLLING 🚀🚀🚀');
  console.log(`[BatchPolling] 🚀 Poll interval: ${POLL_INTERVAL_MS}ms (every ${POLL_INTERVAL_MS / 1000}s)`);
  console.log(`[BatchPolling] 🚀 Currently tracking ${pollingState.batchIds.size} batch(es)`);
  console.log(`[BatchPolling] 🚀 Max attempts: ${MAX_POLL_ATTEMPTS} (will stop after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s)`);
  
  // Reset attempt count when starting
  pollingState.attemptCount = 0;
  
  // Initial poll immediately
  console.log('[BatchPolling] 🚀 Running initial poll...');
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
  
  console.log('[BatchPolling] ✅✅✅ POLLING INTERVAL SET UP SUCCESSFULLY ✅✅✅');
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
    // Get active workspace ID from AsyncStorage (mobile app pattern)
    let activeWorkspaceId: string | null = null;
    try {
      activeWorkspaceId = await AsyncStorage.getItem('@storystack:active_workspace_id');
    } catch (storageError) {
      console.warn('[BatchPolling] Could not get active workspace from storage:', storageError);
    }

    // If we have manually tracked batches, continue polling even without workspace
    // (workspace might not be set yet, but batches will be added when workspace is available)
    if (!activeWorkspaceId) {
      if (pollingState.batchIds.size > 0) {
        // We have manually tracked batches, continue polling (workspace will be set soon)
        console.log(`[BatchPolling] ⏸️  No active workspace, but ${pollingState.batchIds.size} manually tracked batch(es) - will continue polling`);
        // Poll the manually tracked batches (they don't need workspace filtering)
        const pollPromises = Array.from(pollingState.batchIds).map(batchId => pollBatch(batchId));
        await Promise.allSettled(pollPromises);
        return;
      }
      // No workspace and no manually tracked batches - skip polling
      console.log('[BatchPolling] ⏸️  No active workspace and no manually tracked batches, skipping batch polling');
      return;
    }

    // Find assets with pending batch IDs from the active workspace
    // Only select openai_batch_id to avoid blob resolution issues
    const { data: assets, error } = await supabase
      .from('assets')
      .select('openai_batch_id')
      .eq('workspace_id', activeWorkspaceId)
      .is('deleted_at', null) // Exclude soft-deleted assets
      .not('openai_batch_id', 'is', null)
      .eq('auto_tag_status', 'pending')
      .limit(20);

    if (error) {
      // Don't log blob resolution errors - they're likely RLS/permission issues
      // Only log if it's not a blob-related error
      if (!error.message?.includes('blob') && !error.details?.includes('blob')) {
        console.error('[BatchPolling] ❌ Error fetching pending batches:', error);
      }
      return;
    }

    if (!assets || assets.length === 0) {
      // No pending batches in database, but continue polling if we have manually tracked batches
      if (pollingState.batchIds.size === 0) {
        // No batches anywhere - but don't stop polling immediately
        // Keep polling for a bit in case batches are added soon (like during import)
        // Only stop after 30 seconds (15 attempts) of no batches
        if (pollingState.attemptCount > 15) {
          console.log('[BatchPolling] ⏹️  No batches found after 30 seconds, stopping polling');
          stopBatchPolling();
        } else {
          console.log(`[BatchPolling] ⏸️  No batches found yet (attempt ${pollingState.attemptCount}/15), will continue polling...`);
        }
      } else {
        // We have manually tracked batches, continue polling
        console.log(`[BatchPolling] No batches in DB, but ${pollingState.batchIds.size} manually tracked batch(es) - continuing to poll`);
      }
      return;
    }

    // Get unique batch IDs from database
    const batchIdsFromDb = new Set(
      assets
        .map(a => a.openai_batch_id)
        .filter((id): id is string => id !== null)
    );

    // Merge with manually added batch IDs
    const allBatchIds = new Set([...pollingState.batchIds, ...batchIdsFromDb]);

    // Add database batches to polling state (so they persist across polls)
    batchIdsFromDb.forEach(batchId => pollingState.batchIds.add(batchId));

    if (allBatchIds.size === 0) {
      // No pending batches anywhere
      if (pollingState.batchIds.size === 0) {
        stopBatchPolling();
      }
      return;
    }

    console.log(`[BatchPolling] 🔍 Found ${allBatchIds.size} pending batches to check (${batchIdsFromDb.size} from DB, ${pollingState.batchIds.size} total tracked)`);

    // Poll each batch (in parallel for faster processing)
    const pollPromises = Array.from(allBatchIds).map(batchId => pollBatch(batchId));
    await Promise.allSettled(pollPromises);
  } catch (error) {
    // Don't log blob resolution errors - they're likely RLS/permission issues
    if (!(error instanceof Error && (error.message?.includes('blob') || error.message?.includes('Unable to resolve')))) {
      console.error('[BatchPolling] ❌ Error in pollPendingBatches:', error);
    }
  }
}

/**
 * Poll a specific batch
 */
async function pollBatch(batchId: string): Promise<void> {
  if (!supabase) {
    console.warn('[BatchPolling] ⚠️  Supabase not initialized');
    return;
  }

  try {
    // Get session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[BatchPolling] ❌ Error getting session:', sessionError);
      return;
    }
    
    if (!session) {
      console.warn('[BatchPolling] ⚠️  No session found, cannot poll batch');
      return;
    }
    
    if (!session.access_token) {
      console.error('[BatchPolling] ❌ Session exists but access_token is missing');
      return;
    }

    console.log(`[BatchPolling] 🔄 Polling batch ${batchId}...`);
    
    // Construct edge function URL - prefer EXPO_PUBLIC_EDGE_BASE_URL if available, otherwise construct from Supabase URL
    let edgeFunctionUrl: string;
    
    if (EDGE_FUNCTION_BASE_URL) {
      // Use configured edge base URL (should include /functions/v1 if needed)
      // Remove trailing slash and ensure we have the function name
      const baseUrl = EDGE_FUNCTION_BASE_URL.replace(/\/$/, '');
      edgeFunctionUrl = `${baseUrl}${baseUrl.includes('/auto_tag_asset') ? '' : '/auto_tag_asset'}?batch_id=${encodeURIComponent(batchId)}`;
      console.log(`[BatchPolling] ✅ Using EXPO_PUBLIC_EDGE_BASE_URL`);
      console.log(`[BatchPolling] ✅ Base URL: ${baseUrl}`);
      console.log(`[BatchPolling] ✅ Full URL: ${edgeFunctionUrl}`);
    } else {
      // Fallback: construct from Supabase URL
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        console.error('[BatchPolling] ❌ EXPO_PUBLIC_SUPABASE_URL not configured and EXPO_PUBLIC_EDGE_BASE_URL not set');
        return;
      }
      
      console.log(`[BatchPolling] ⚠️  EXPO_PUBLIC_EDGE_BASE_URL not set, constructing from Supabase URL`);
      console.log(`[BatchPolling] ⚠️  Supabase URL: ${supabaseUrl}`);
      
      // Extract project reference and construct edge function URL
      // Format: https://[project-ref].functions.supabase.co/functions/v1/auto_tag_asset?batch_id=...
      const projectRefMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
      if (!projectRefMatch) {
        console.error('[BatchPolling] ❌ Could not extract project reference from Supabase URL');
        console.error('[BatchPolling] ❌ Expected format: https://[project-ref].supabase.co');
        return;
      }
      
      const projectRef = projectRefMatch[1];
      console.log(`[BatchPolling] ✅ Extracted project ref: ${projectRef}`);
      edgeFunctionUrl = `https://${projectRef}.functions.supabase.co/functions/v1/auto_tag_asset?batch_id=${encodeURIComponent(batchId)}`;
      console.log(`[BatchPolling] ✅ Constructed edge function URL: ${edgeFunctionUrl}`);
    }
    
    // Get Supabase anon key
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
      console.error('[BatchPolling] ❌ EXPO_PUBLIC_SUPABASE_ANON_KEY not configured');
      return;
    }
    
    console.log(`[BatchPolling] 📡 Making GET request to: ${edgeFunctionUrl}`);
    console.log(`[BatchPolling] 📡 Headers: Authorization=Bearer ${session.access_token.substring(0, 20)}..., apikey=${supabaseAnonKey.substring(0, 20)}...`);
    
    // Use fetch with auth headers from the session we already retrieved
    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
    });
    
    console.log(`[BatchPolling] 📥 Response status: ${response.status} ${response.statusText}`);
    console.log(`[BatchPolling] 📥 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BatchPolling] ❌ Error polling batch ${batchId}: ${response.status} ${response.statusText}`);
      console.error(`[BatchPolling] ❌ Error response body:`, errorText);
      
      if (response.status === 404) {
        // Batch not found or already processed
        console.log(`[BatchPolling] Batch ${batchId} not found (404) - removing from queue`);
        removeBatchFromPoll(batchId);
        return;
      }
      
      return;
    }

    const result = await response.json();
    console.log(`[BatchPolling] 📥 Response body:`, JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log(`[BatchPolling] ✅ Batch ${batchId} processed successfully`);
      removeBatchFromPoll(batchId);
      
      // Trigger callbacks to refresh UI immediately
      console.log(`[BatchPolling] 🔔 Notifying ${pollingState.onBatchCompleteCallbacks.size} callback(s) of batch completion`);
      pollingState.onBatchCompleteCallbacks.forEach(async (callback) => {
        try {
          // Pass batchId to callback so it can track which batch triggered the refresh
          await callback(batchId);
        } catch (error) {
          console.error(`[BatchPolling] ❌ Error in batch completion callback:`, error);
        }
      });
      
      console.log(`[BatchPolling] ✅ Batch ${batchId} completed - callbacks notified`);
    } else {
      console.warn(`[BatchPolling] ⚠️  Batch ${batchId} polling returned success=false:`, result);
    }
  } catch (error) {
    console.error(`[BatchPolling] ❌ Exception polling batch ${batchId}:`, error);
    console.error(`[BatchPolling] ❌ Error details:`, error instanceof Error ? error.stack : String(error));
  }
}

/**
 * Initialize polling on app load
 * Call this from your app's root component or when user logs in
 */
export function initializeBatchPolling(): void {
  console.log('[BatchPolling] 🔧 initializeBatchPolling called');
  console.log('[BatchPolling] 🔧 Calling startBatchPolling...');
  // Check for pending batches and start polling
  startBatchPolling();
  console.log('[BatchPolling] 🔧 initializeBatchPolling completed');
}




