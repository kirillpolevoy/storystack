'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook to get the active workspace ID
 * Checks localStorage first, then database (user_preferences)
 * Prioritizes user's own workspace if multiple workspaces exist
 */
export function useActiveWorkspace() {
  const supabase = createClient()
  const [localStorageWorkspaceId, setLocalStorageWorkspaceId] = useState<string | null>(null)

  // Get from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('@storystack:active_workspace_id')
      setLocalStorageWorkspaceId(stored)
    }
  }, [])

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
  })

  // Get user's workspaces
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          workspaces (
            id,
            name,
            created_by
          )
        `)
        .eq('user_id', user.id)

      if (error) {
        console.error('[useActiveWorkspace] Error fetching workspaces:', error)
        return []
      }

      return (data || []).map((wm: any) => wm.workspaces).filter(Boolean) as Array<{
        id: string
        name: string
        created_by: string
      }>
    },
    enabled: !!user?.id,
  })

  // Get active workspace from database
  const { data: dbActiveWorkspaceId } = useQuery({
    queryKey: ['user_preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null

      const { data, error } = await supabase
        .from('user_preferences')
        .select('active_workspace_id')
        .eq('user_id', user.id)
        .single()

      if (error) {
        // If no preferences exist, that's okay
        if (error.code === 'PGRST116') return null
        console.error('[useActiveWorkspace] Error fetching user preferences:', error)
        return null
      }

      return data?.active_workspace_id || null
    },
    enabled: !!user?.id,
  })

  // Determine the active workspace ID
  // Priority: localStorage > database > user's own workspace > first workspace
  const activeWorkspaceId = (() => {
    // If localStorage has a value, validate it's still a valid workspace
    if (localStorageWorkspaceId) {
      const isValid = workspaces.some((w) => w.id === localStorageWorkspaceId)
      if (isValid) {
        return localStorageWorkspaceId
      }
      // Invalid workspace in localStorage, clear it
      if (typeof window !== 'undefined') {
        localStorage.removeItem('@storystack:active_workspace_id')
      }
    }

    // Check database
    if (dbActiveWorkspaceId) {
      const isValid = workspaces.some((w) => w.id === dbActiveWorkspaceId)
      if (isValid) {
        // Sync to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('@storystack:active_workspace_id', dbActiveWorkspaceId)
        }
        return dbActiveWorkspaceId
      }
    }

    // Fallback: prioritize user's own workspace
    if (workspaces.length > 0 && user?.id) {
      const ownWorkspace = workspaces.find((w) => w.created_by === user.id)
      if (ownWorkspace) {
        // Sync to localStorage and database
        if (typeof window !== 'undefined') {
          localStorage.setItem('@storystack:active_workspace_id', ownWorkspace.id)
        }
        // Update database in background (don't await)
        supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            active_workspace_id: ownWorkspace.id,
            updated_at: new Date().toISOString(),
          })
          .then(() => {
            // Invalidate to refresh
          })
        return ownWorkspace.id
      }

      // Last resort: first workspace
      const firstWorkspace = workspaces[0]
      if (firstWorkspace) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('@storystack:active_workspace_id', firstWorkspace.id)
        }
        // Update database in background
        supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            active_workspace_id: firstWorkspace.id,
            updated_at: new Date().toISOString(),
          })
        return firstWorkspace.id
      }
    }

    return null
  })()

  return activeWorkspaceId
}

