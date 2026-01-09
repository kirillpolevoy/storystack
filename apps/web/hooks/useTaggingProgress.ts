'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useActiveWorkspace } from './useActiveWorkspace'
import { RealtimeChannel } from '@supabase/supabase-js'
import { TaggingProgress } from '@/components/library/TaggingProgressBar'

const PROGRESS_THRESHOLD = 6 // Only show progress bar for 6+ images (batch API)

/**
 * Hook to track batch tagging progress
 * Shows progress bar for large batches (6+ images)
 */
export function useTaggingProgress() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const activeWorkspaceId = useActiveWorkspace()
  const channelRef = useRef<RealtimeChannel | null>(null)

  const [progress, setProgress] = useState<TaggingProgress>({
    total: 0,
    completed: 0,
    tagged: 0,
    noTags: 0,
    assetIds: [],
  })

  const [isVisible, setIsVisible] = useState(false)

  // Start tracking a batch of assets
  const startTracking = useCallback((assetIds: string[]) => {
    if (assetIds.length < PROGRESS_THRESHOLD) {
      console.log(`[useTaggingProgress] Skipping progress bar for ${assetIds.length} images (threshold: ${PROGRESS_THRESHOLD})`)
      return
    }

    console.log(`[useTaggingProgress] Starting to track ${assetIds.length} assets`)
    setProgress({
      total: assetIds.length,
      completed: 0,
      tagged: 0,
      noTags: 0,
      assetIds,
    })
    setIsVisible(true)
  }, [])

  // Dismiss the progress bar
  const dismiss = useCallback(() => {
    setIsVisible(false)
    // Reset after animation
    setTimeout(() => {
      setProgress({
        total: 0,
        completed: 0,
        tagged: 0,
        noTags: 0,
        assetIds: [],
      })
    }, 300)
  }, [])

  // Check current status of tracked assets
  const checkProgress = useCallback(async () => {
    if (progress.assetIds.length === 0) return

    const { data: assets, error } = await supabase
      .from('assets')
      .select('id, auto_tag_status, tags')
      .in('id', progress.assetIds)

    if (error) {
      console.error('[useTaggingProgress] Error fetching assets:', error)
      return
    }

    if (!assets) return

    const completed = assets.filter(a => a.auto_tag_status === 'completed' || a.auto_tag_status === 'failed')
    const tagged = assets.filter(a => a.auto_tag_status === 'completed' && a.tags && a.tags.length > 0)
    const noTags = assets.filter(a => (a.auto_tag_status === 'completed' || a.auto_tag_status === 'failed') && (!a.tags || a.tags.length === 0))

    setProgress(prev => ({
      ...prev,
      completed: completed.length,
      tagged: tagged.length,
      noTags: noTags.length,
    }))

    // Auto-dismiss after 5 seconds when complete
    if (completed.length >= progress.assetIds.length) {
      console.log('[useTaggingProgress] All assets completed, auto-dismissing in 5s')
      setTimeout(() => {
        dismiss()
      }, 5000)
    }
  }, [progress.assetIds, supabase, dismiss])

  // Set up realtime subscription for tracked assets
  useEffect(() => {
    if (!activeWorkspaceId || progress.assetIds.length === 0) {
      return
    }

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    console.log(`[useTaggingProgress] Setting up realtime for ${progress.assetIds.length} assets`)

    // Subscribe to changes on tracked assets
    const channel = supabase
      .channel(`tagging-progress-${activeWorkspaceId}`)
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
          if (progress.assetIds.includes(newRecord.id)) {
            console.log(`[useTaggingProgress] Asset ${newRecord.id} updated:`, {
              status: newRecord.auto_tag_status,
              tagsCount: newRecord.tags?.length || 0,
            })

            // Re-check all progress
            checkProgress()

            // Also invalidate queries to refresh UI
            queryClient.invalidateQueries({ queryKey: ['assets'], refetchType: 'active' })
          }
        }
      )
      .subscribe((status) => {
        console.log('[useTaggingProgress] Subscription status:', status)
      })

    channelRef.current = channel

    // Initial check
    checkProgress()

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [activeWorkspaceId, progress.assetIds, supabase, queryClient, checkProgress])

  return {
    progress,
    isVisible,
    startTracking,
    dismiss,
  }
}
