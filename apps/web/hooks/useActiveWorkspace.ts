'use client'

import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cancelWorkspaceQueries, invalidateWorkspaceQueries, removeWorkspaceQueries } from '@/utils/workspaceQueries'

/**
 * Hook to get the active workspace ID
 * Reads directly from localStorage for immediate reactivity
 * Syncs to database in background but doesn't block UI
 * Reactively updates when localStorage changes (workspace switch)
 */
export function useActiveWorkspace() {
  const queryClient = useQueryClient()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const prevWorkspaceIdRef = useRef<string | null>(null)

  // Read from localStorage synchronously on mount and when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateWorkspaceId = () => {
      const stored = localStorage.getItem('@storystack:active_workspace_id')
      const newWorkspaceId = stored || null
      
      // Only update if actually changed
      if (newWorkspaceId !== workspaceId) {
        setWorkspaceId(newWorkspaceId)
      }
    }

    // Initial read
    updateWorkspaceId()

    // Listen for storage events (workspace changes in other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === '@storystack:active_workspace_id') {
        updateWorkspaceId()
      }
    }

    // Listen for custom event (workspace changes in same tab)
    const handleWorkspaceChange = () => {
      updateWorkspaceId()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('workspace-changed', handleWorkspaceChange)

    // Poll localStorage periodically as a fallback (in case events don't fire)
    const interval = setInterval(updateWorkspaceId, 100)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('workspace-changed', handleWorkspaceChange)
      clearInterval(interval)
    }
  }, [workspaceId])

  // Handle query invalidation when workspace ID changes
  useEffect(() => {
    const currentWorkspaceId = workspaceId
    const previousWorkspaceId = prevWorkspaceIdRef.current

    // Only trigger if workspace ID actually changed (not initial mount)
    if (currentWorkspaceId !== previousWorkspaceId && previousWorkspaceId !== null) {
      console.log('[useActiveWorkspace] Workspace ID changed from', previousWorkspaceId, 'to', currentWorkspaceId)
      
      // Cancel in-flight queries for old workspace
      cancelWorkspaceQueries(queryClient, previousWorkspaceId)
      
      // Remove old workspace queries from cache to prevent stale data
      removeWorkspaceQueries(queryClient, previousWorkspaceId)
      
      // Invalidate all workspace queries to ensure fresh data
      invalidateWorkspaceQueries(queryClient)
      
      console.log('[useActiveWorkspace] Removed and invalidated queries for old workspace:', previousWorkspaceId)
      console.log('[useActiveWorkspace] React Query will create new queries with workspace ID:', currentWorkspaceId)
    }

    // Update ref for next comparison
    prevWorkspaceIdRef.current = currentWorkspaceId
  }, [workspaceId, queryClient])

  return workspaceId
}
