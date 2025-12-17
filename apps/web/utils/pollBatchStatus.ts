/**
 * Client-side batch polling utility for web app
 * Polls for completed OpenAI batches and processes results
 * 
 * This polls the edge function directly to check batch status
 */

import { createClient } from '@/lib/supabase/client'

const POLL_INTERVAL_MS = 10000 // Poll every 10 seconds (less aggressive than mobile)
const MAX_POLL_ATTEMPTS = 360 // Stop after 1 hour (360 * 10s = 3600s)

interface PollingState {
  batchIds: Set<string>
  pollInterval: ReturnType<typeof setInterval> | null
  attemptCount: number
}

let pollingState: PollingState = {
  batchIds: new Set(),
  pollInterval: null,
  attemptCount: 0,
}

/**
 * Get edge function URL from Supabase project URL
 */
function getEdgeFunctionUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    console.warn('[BatchPolling] ⚠️  NEXT_PUBLIC_SUPABASE_URL not configured')
    return ''
  }
  
  // Extract project reference from Supabase URL
  // Format: https://[project-ref].supabase.co
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
  if (!match) {
    console.warn('[BatchPolling] ⚠️  Could not extract project reference from Supabase URL')
    return ''
  }
  
  const projectRef = match[1]
  return `https://${projectRef}.functions.supabase.co`
}

/**
 * Start polling for pending batches
 * Call this when the app loads or when a batch is created
 */
export function startBatchPolling(): void {
  if (pollingState.pollInterval) {
    console.log('[BatchPolling] Already polling, skipping start')
    return
  }

  console.log('[BatchPolling] 🚀 Starting batch polling (every 10 seconds)...')
  
  // Initial poll
  pollPendingBatches()
  
  // Set up interval - poll every 10 seconds
  pollingState.pollInterval = setInterval(() => {
    pollingState.attemptCount++
    
    if (pollingState.attemptCount >= MAX_POLL_ATTEMPTS) {
      console.log('[BatchPolling] ⏹️  Max poll attempts reached, stopping')
      stopBatchPolling()
      return
    }
    
    pollPendingBatches()
  }, POLL_INTERVAL_MS)
}

/**
 * Stop polling
 */
export function stopBatchPolling(): void {
  if (pollingState.pollInterval) {
    clearInterval(pollingState.pollInterval)
    pollingState.pollInterval = null
    pollingState.attemptCount = 0
    console.log('[BatchPolling] ⏹️  Stopped polling')
  }
}

/**
 * Add a batch ID to poll for
 */
export function addBatchToPoll(batchId: string): void {
  pollingState.batchIds.add(batchId)
  console.log(`[BatchPolling] ➕ Added batch ${batchId} to polling queue`)
  
  // Start polling if not already running
  if (!pollingState.pollInterval) {
    startBatchPolling()
  }
}

/**
 * Remove a batch ID from polling
 */
export function removeBatchFromPoll(batchId: string): void {
  pollingState.batchIds.delete(batchId)
  console.log(`[BatchPolling] ➖ Removed batch ${batchId} from polling queue`)
  
  // Stop polling if no batches left
  if (pollingState.batchIds.size === 0 && pollingState.pollInterval) {
    stopBatchPolling()
  }
}

/**
 * Poll for pending batches
 */
async function pollPendingBatches(): Promise<void> {
  const supabase = createClient()
  if (!supabase) {
    console.warn('[BatchPolling] ⚠️  Supabase not initialized')
    return
  }

  try {
    // Find assets with pending batch IDs
    const { data: assets, error } = await supabase
      .from('assets')
      .select('openai_batch_id')
      .not('openai_batch_id', 'is', null)
      .eq('auto_tag_status', 'pending')
      .limit(20)

    if (error) {
      console.error('[BatchPolling] ❌ Error fetching pending batches:', error)
      return
    }

    if (!assets || assets.length === 0) {
      // No pending batches, stop polling
      if (pollingState.batchIds.size === 0) {
        stopBatchPolling()
      }
      return
    }

    // Get unique batch IDs
    const batchIds = new Set(
      assets
        .map(a => a.openai_batch_id)
        .filter((id): id is string => id !== null)
    )

    console.log(`[BatchPolling] 🔍 Found ${batchIds.size} pending batches to check (polling every 10s)`)

    // Poll each batch (in parallel for faster processing)
    const pollPromises = Array.from(batchIds).map(batchId => pollBatch(batchId))
    await Promise.allSettled(pollPromises)
  } catch (error) {
    console.error('[BatchPolling] ❌ Error in pollPendingBatches:', error)
  }
}

/**
 * Poll a specific batch
 */
async function pollBatch(batchId: string): Promise<void> {
  const edgeFunctionUrl = getEdgeFunctionUrl()
  if (!edgeFunctionUrl) {
    console.warn('[BatchPolling] ⚠️  Edge function URL not configured')
    return
  }

  try {
    const supabase = createClient()
    if (!supabase) {
      console.warn('[BatchPolling] ⚠️  Supabase not initialized')
      return
    }

    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.warn('[BatchPolling] ⚠️  No session found')
      return
    }

    const url = `${edgeFunctionUrl}/auto_tag_asset?batch_id=${batchId}`
    
    console.log(`[BatchPolling] 🔄 Polling batch ${batchId}...`)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        // Batch not found or already processed
        removeBatchFromPoll(batchId)
        return
      }
      
      const errorText = await response.text()
      console.error(`[BatchPolling] ❌ Error polling batch ${batchId}: ${response.status} ${errorText}`)
      return
    }

    const result = await response.json()
    
    if (result.success) {
      console.log(`[BatchPolling] ✅ Batch ${batchId} processed successfully`)
      removeBatchFromPoll(batchId)
      
      // Trigger a refresh of assets to show updated tags
      // Dispatch custom event that components can listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('batchCompleted', { detail: { batchId } }))
      }
    } else if (result.error) {
      // Edge function returned an error
      console.error(`[BatchPolling] ❌ Batch ${batchId} processing failed:`, result.error)
      // Don't remove from poll - might be transient error, will retry on next poll
      // But log it for debugging
    } else {
      // Unexpected response format
      console.warn(`[BatchPolling] ⚠️ Unexpected response format for batch ${batchId}:`, result)
    }
  } catch (error) {
    console.error(`[BatchPolling] ❌ Error polling batch ${batchId}:`, error)
    // Don't remove from poll on network/parsing errors - will retry on next poll
  }
}

/**
 * Initialize polling on app load
 * Call this from your app's root component or when user logs in
 */
export function initializeBatchPolling(): void {
  // Check for pending batches and start polling
  startBatchPolling()
}

