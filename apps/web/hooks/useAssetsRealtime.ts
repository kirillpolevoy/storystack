'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useActiveWorkspace } from './useActiveWorkspace'
import { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Hook to subscribe to real-time asset updates
 *
 * Listens for changes to assets (tags, auto_tag_status) and invalidates
 * the React Query cache so the UI updates automatically.
 *
 * This is particularly useful for:
 * - Chunked auto-tagging (6-100 images) where tags are applied progressively
 * - Batch API completion when tags are applied after async processing
 * - Multi-device sync when assets are modified elsewhere
 */
export function useAssetsRealtime() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const activeWorkspaceId = useActiveWorkspace()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!activeWorkspaceId) {
      return
    }

    // Clean up any existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    console.log('[useAssetsRealtime] Setting up realtime subscription for workspace:', activeWorkspaceId)

    // Subscribe to asset changes for this workspace
    const channel = supabase
      .channel(`assets-${activeWorkspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets',
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        (payload) => {
          const { new: newRecord, old: oldRecord } = payload

          // Check if tags or auto_tag_status changed
          const tagsChanged = JSON.stringify(newRecord.tags) !== JSON.stringify(oldRecord.tags)
          const statusChanged = newRecord.auto_tag_status !== oldRecord.auto_tag_status

          if (tagsChanged || statusChanged) {
            console.log('[useAssetsRealtime] Asset updated:', {
              id: newRecord.id,
              tagsChanged,
              statusChanged,
              newStatus: newRecord.auto_tag_status,
              newTagsCount: newRecord.tags?.length || 0,
            })

            // Invalidate specific asset query
            queryClient.invalidateQueries({ queryKey: ['asset', newRecord.id] })

            // Invalidate assets list to refresh the grid
            // Use refetchType: 'active' to only refetch if the query is currently being used
            queryClient.invalidateQueries({
              queryKey: ['assets'],
              refetchType: 'active',
            })

            // Also invalidate available tags in case new tags were added
            if (tagsChanged) {
              queryClient.invalidateQueries({ queryKey: ['availableTags'] })
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assets',
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        (payload) => {
          console.log('[useAssetsRealtime] New asset inserted:', payload.new.id)

          // Invalidate assets list to show new asset
          queryClient.invalidateQueries({
            queryKey: ['assets'],
            refetchType: 'active',
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'assets',
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        (payload) => {
          console.log('[useAssetsRealtime] Asset deleted:', payload.old.id)

          // Invalidate assets list to remove deleted asset
          queryClient.invalidateQueries({
            queryKey: ['assets'],
            refetchType: 'active',
          })
        }
      )
      .subscribe((status) => {
        console.log('[useAssetsRealtime] Subscription status:', status)
      })

    channelRef.current = channel

    // Cleanup on unmount or workspace change
    return () => {
      console.log('[useAssetsRealtime] Cleaning up realtime subscription')
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [activeWorkspaceId, supabase, queryClient])
}
