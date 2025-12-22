'use client'

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace'
import { cancelWorkspaceQueries } from '@/utils/workspaceQueries'
import { createClient } from '@/lib/supabase/client'
import { notifyWorkspaceChange } from '@/plugins/workspaceQueryPlugin'

interface Workspace {
  id: string
  name: string
  created_by: string
}

interface WorkspaceContextValue {
  activeWorkspaceId: string | null
  isLoading: boolean
  isSwitching: boolean
  error: Error | null
  switchWorkspace: (workspaceId: string) => Promise<void>
  workspaces: Workspace[]
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const activeWorkspaceId = useActiveWorkspace()
  const [isSwitching, setIsSwitching] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  // Fetch user's workspaces
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
  })

  const { data: fetchedWorkspaces = [] } = useQuery({
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
        console.error('[WorkspaceContext] Error fetching workspaces:', error)
        return []
      }

      return (data || []).map((wm: any) => wm.workspaces).filter(Boolean) as Workspace[]
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    setWorkspaces(fetchedWorkspaces)
  }, [fetchedWorkspaces])

  // Notify plugin of workspace changes
  useEffect(() => {
    notifyWorkspaceChange(activeWorkspaceId)
  }, [activeWorkspaceId])

  /**
   * Centralized workspace switching handler
   * Coordinates all workspace change operations
   * 
   * Strategy:
   * 1. Update localStorage immediately (synchronous, triggers useActiveWorkspace)
   * 2. Dispatch event to notify all listeners
   * 3. Sync to database in background (fire and forget)
   * 4. Query invalidation is handled by useActiveWorkspace hook
   */
  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (workspaceId === activeWorkspaceId) {
        console.log('[WorkspaceContext] Already on workspace:', workspaceId)
        return
      }

      setIsSwitching(true)
      setError(null)

      try {
        const oldWorkspaceId = activeWorkspaceId

        // 1. Cancel in-flight queries for old workspace
        if (oldWorkspaceId) {
          cancelWorkspaceQueries(queryClient, oldWorkspaceId)
        }

        // 2. Update localStorage IMMEDIATELY (synchronous, triggers useActiveWorkspace hook)
        localStorage.setItem('@storystack:active_workspace_id', workspaceId)

        // 3. Dispatch custom event to notify all hooks (useActiveWorkspace will pick this up)
        window.dispatchEvent(new Event('workspace-changed'))

        // 4. Sync to database in background (fire and forget - optimistic update already applied)
        if (user?.id) {
          // Use async IIFE for fire-and-forget database sync
          ;(async () => {
            try {
              const { error } = await supabase
                .from('user_preferences')
                .upsert({
                  user_id: user.id,
                  active_workspace_id: workspaceId,
                  updated_at: new Date().toISOString(),
                })
              
              if (error) {
                console.error('[WorkspaceContext] Error syncing workspace to database:', error)
                // Don't throw - localStorage update is sufficient
              }
            } catch (err) {
              console.error('[WorkspaceContext] Unexpected error syncing workspace to database:', err)
              // Don't throw - localStorage update is sufficient
            }
          })()
        }

        // 5. Query invalidation is handled by useActiveWorkspace hook when it detects the change
        // No need to do it here - that would be redundant and could cause race conditions

        console.log('[WorkspaceContext] Successfully switched to workspace:', workspaceId)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to switch workspace')
        console.error('[WorkspaceContext] Error switching workspace:', error)
        setError(error)

        // Revert localStorage on error
        if (activeWorkspaceId) {
          localStorage.setItem('@storystack:active_workspace_id', activeWorkspaceId)
          window.dispatchEvent(new Event('workspace-changed'))
        }

        throw error
      } finally {
        setIsSwitching(false)
      }
    },
    [activeWorkspaceId, queryClient, user?.id, supabase]
  )

  const isLoading = false // Workspace ID is always available from hook

  const value: WorkspaceContextValue = {
    activeWorkspaceId,
    isLoading,
    isSwitching,
    error,
    switchWorkspace,
    workspaces,
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

/**
 * Hook to access workspace context
 */
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}

