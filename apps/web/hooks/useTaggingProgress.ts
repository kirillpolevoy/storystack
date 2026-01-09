'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useActiveWorkspace } from './useActiveWorkspace'
import { RealtimeChannel } from '@supabase/supabase-js'
import { TaggingProgress } from '@/components/library/TaggingProgressBar'

const PROGRESS_THRESHOLD = 6 // Only show progress bar for 6+ images (batch API)
const POLL_INTERVAL_MS = 3000 // Poll every 3 seconds as fallback

/**
 * Hook to track batch tagging progress
 * Shows progress bar for large batches (6+ images)
 * Uses both realtime subscription AND polling for reliability
 */
export function useTaggingProgress() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const activeWorkspaceId = useActiveWorkspace()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const assetIdsRef = useRef<string[]>([])
  const isCompleteRef = useRef(false)
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [progress, setProgress] = useState<TaggingProgress>({
    total: 0,
    completed: 0,
    tagged: 0,
    noTags: 0,
    assetIds: [],
  })

  const [isVisible, setIsVisible] = useState(false)

  // Check current status of tracked assets
  const checkProgress = useCallback(async () => {
    const currentAssetIds = assetIdsRef.current
    if (currentAssetIds.length === 0) return

    console.log(`[useTaggingProgress] Checking progress for ${currentAssetIds.length} assets...`)

    const { data: assets, error } = await supabase
      .from('assets')
      .select('id, auto_tag_status, tags')
      .in('id', currentAssetIds)

    if (error) {
      console.error('[useTaggingProgress] Error fetching assets:', error)
      return
    }

    if (!assets) return

    const completedAssets = assets.filter(a => a.auto_tag_status === 'completed' || a.auto_tag_status === 'failed')
    const taggedAssets = assets.filter(a => a.auto_tag_status === 'completed' && a.tags && a.tags.length > 0)
    const noTagsAssets = assets.filter(a => (a.auto_tag_status === 'completed' || a.auto_tag_status === 'failed') && (!a.tags || a.tags.length === 0))

    const newCompleted = completedAssets.length
    const newTagged = taggedAssets.length
    const newNoTags = noTagsAssets.length

    console.log(`[useTaggingProgress] Progress: ${newCompleted}/${currentAssetIds.length} (${newTagged} tagged, ${newNoTags} no tags)`)

    setProgress(prev => ({
      ...prev,
      completed: newCompleted,
      tagged: newTagged,
      noTags: newNoTags,
    }))

    // Invalidate queries to refresh UI grid
    queryClient.invalidateQueries({ queryKey: ['assets'], refetchType: 'active' })

    // Check if complete
    if (newCompleted >= currentAssetIds.length && !isCompleteRef.current) {
      isCompleteRef.current = true
      console.log('[useTaggingProgress] All assets completed!')

      // Stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }

      // Auto-dismiss after 5 seconds
      dismissTimeoutRef.current = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => {
          setProgress({
            total: 0,
            completed: 0,
            tagged: 0,
            noTags: 0,
            assetIds: [],
          })
          assetIdsRef.current = []
          isCompleteRef.current = false
        }, 300)
      }, 5000)
    }
  }, [supabase, queryClient])

  // Start tracking a batch of assets
  const startTracking = useCallback((assetIds: string[]) => {
    if (assetIds.length < PROGRESS_THRESHOLD) {
      console.log(`[useTaggingProgress] Skipping progress bar for ${assetIds.length} images (threshold: ${PROGRESS_THRESHOLD})`)
      return
    }

    console.log(`[useTaggingProgress] Starting to track ${assetIds.length} assets`)

    // Clear any existing dismiss timeout
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current)
      dismissTimeoutRef.current = null
    }

    // Store in ref for stable access
    assetIdsRef.current = assetIds
    isCompleteRef.current = false

    setProgress({
      total: assetIds.length,
      completed: 0,
      tagged: 0,
      noTags: 0,
      assetIds,
    })
    setIsVisible(true)

    // Start polling immediately
    checkProgress()

    // Set up polling interval as primary method (realtime can be unreliable)
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }
    pollIntervalRef.current = setInterval(() => {
      if (!isCompleteRef.current) {
        checkProgress()
      }
    }, POLL_INTERVAL_MS)
  }, [checkProgress])

  // Dismiss the progress bar
  const dismiss = useCallback(() => {
    // Clear dismiss timeout
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current)
      dismissTimeoutRef.current = null
    }

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    setIsVisible(false)
    setTimeout(() => {
      setProgress({
        total: 0,
        completed: 0,
        tagged: 0,
        noTags: 0,
        assetIds: [],
      })
      assetIdsRef.current = []
      isCompleteRef.current = false
    }, 300)
  }, [])

  // Set up realtime subscription as bonus (polling is primary)
  useEffect(() => {
    if (!activeWorkspaceId || assetIdsRef.current.length === 0) {
      return
    }

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    console.log(`[useTaggingProgress] Setting up realtime subscription for workspace ${activeWorkspaceId}`)

    // Subscribe to changes on tracked assets
    const channel = supabase
      .channel(`tagging-progress-${activeWorkspaceId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets',
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        (payload) => {
          const { new: newRecord } = payload

          // Check if this is one of our tracked assets
          if (assetIdsRef.current.includes(newRecord.id)) {
            console.log(`[useTaggingProgress] Realtime: Asset ${newRecord.id} updated`)
            checkProgress()
          }
        }
      )
      .subscribe((status) => {
        console.log('[useTaggingProgress] Realtime subscription status:', status)
      })

    channelRef.current = channel

    // Cleanup
    return () => {
      if (channelRef.current) {
        console.log('[useTaggingProgress] Cleaning up realtime subscription')
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [activeWorkspaceId, supabase, checkProgress])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current)
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [supabase])

  return {
    progress,
    isVisible,
    startTracking,
    dismiss,
  }
}
