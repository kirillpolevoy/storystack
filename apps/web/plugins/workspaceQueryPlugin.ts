/**
 * React Query plugin for workspace-scoped queries
 * Automatically manages query lifecycle based on workspace changes
 */

import { QueryClient } from '@tanstack/react-query'
import { isWorkspaceScopedQuery, getWorkspaceIdFromQueryKey } from '@/utils/queryKeys'

let currentWorkspaceId: string | null = null
let queryClientInstance: QueryClient | null = null

/**
 * Initialize the workspace query plugin
 * Call this once when setting up your QueryClient
 */
export function initializeWorkspaceQueryPlugin(queryClient: QueryClient): void {
  queryClientInstance = queryClient
  console.log('[WorkspaceQueryPlugin] Initialized')
}

/**
 * Notify plugin of workspace change
 * Call this when workspace changes
 */
export function notifyWorkspaceChange(newWorkspaceId: string | null): void {
  if (!queryClientInstance) {
    console.warn('[WorkspaceQueryPlugin] QueryClient not initialized')
    return
  }

  const oldWorkspaceId = currentWorkspaceId

  if (oldWorkspaceId === newWorkspaceId) {
    return // No change
  }

  console.log('[WorkspaceQueryPlugin] Workspace changed:', oldWorkspaceId, '->', newWorkspaceId)

  // Cancel in-flight queries for old workspace
  if (oldWorkspaceId) {
    queryClientInstance.cancelQueries({
      predicate: (query) => {
        if (!isWorkspaceScopedQuery(query.queryKey)) return false
        return getWorkspaceIdFromQueryKey(query.queryKey) === oldWorkspaceId
      },
    })
  }

  // Invalidate queries for old workspace
  if (oldWorkspaceId) {
    queryClientInstance.invalidateQueries({
      predicate: (query) => {
        if (!isWorkspaceScopedQuery(query.queryKey)) return false
        return getWorkspaceIdFromQueryKey(query.queryKey) === oldWorkspaceId
      },
    })
  }

  // Invalidate all workspace queries to ensure fresh data
  queryClientInstance.invalidateQueries({
    predicate: (query) => isWorkspaceScopedQuery(query.queryKey),
  })

  currentWorkspaceId = newWorkspaceId
}

/**
 * Get current workspace ID from plugin
 */
export function getCurrentWorkspaceId(): string | null {
  return currentWorkspaceId
}

/**
 * Check if a query should be enabled based on workspace
 */
export function shouldEnableQuery(queryKey: readonly unknown[]): boolean {
  if (!isWorkspaceScopedQuery(queryKey)) {
    return true // Non-workspace queries are always enabled
  }

  const queryWorkspaceId = getWorkspaceIdFromQueryKey(queryKey)
  return queryWorkspaceId === currentWorkspaceId
}

