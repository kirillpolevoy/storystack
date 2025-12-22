/**
 * Utilities for managing workspace-scoped React Query queries
 */

import { QueryClient } from '@tanstack/react-query'
import { isWorkspaceScopedQuery, getWorkspaceIdFromQueryKey } from './queryKeys'

/**
 * Invalidate all workspace-scoped queries
 * Optionally filter by specific workspace ID
 */
export function invalidateWorkspaceQueries(
  queryClient: QueryClient,
  workspaceId?: string | null
): void {
  queryClient.invalidateQueries({
    predicate: (query) => {
      if (!isWorkspaceScopedQuery(query.queryKey)) return false

      if (workspaceId !== undefined && workspaceId !== null) {
        // Invalidate queries for specific workspace
        return getWorkspaceIdFromQueryKey(query.queryKey) === workspaceId
      }

      // Invalidate all workspace-scoped queries
      return true
    },
  })
}

/**
 * Cancel all in-flight workspace-scoped queries
 * Optionally filter by specific workspace ID
 */
export function cancelWorkspaceQueries(
  queryClient: QueryClient,
  workspaceId?: string | null
): void {
  queryClient.cancelQueries({
    predicate: (query) => {
      if (!isWorkspaceScopedQuery(query.queryKey)) return false

      if (workspaceId !== undefined && workspaceId !== null) {
        return getWorkspaceIdFromQueryKey(query.queryKey) === workspaceId
      }

      return true
    },
  })
}

/**
 * Remove all workspace-scoped queries from cache
 * Optionally filter by specific workspace ID
 * Use with caution - this will cause UI flicker
 */
export function removeWorkspaceQueries(
  queryClient: QueryClient,
  workspaceId?: string | null
): void {
  queryClient.removeQueries({
    predicate: (query) => {
      if (!isWorkspaceScopedQuery(query.queryKey)) return false

      if (workspaceId !== undefined && workspaceId !== null) {
        return getWorkspaceIdFromQueryKey(query.queryKey) === workspaceId
      }

      return true
    },
  })
}

/**
 * Refetch all workspace-scoped queries
 * Optionally filter by specific workspace ID
 */
export function refetchWorkspaceQueries(
  queryClient: QueryClient,
  workspaceId?: string | null
): Promise<void> {
  return queryClient.refetchQueries({
    predicate: (query) => {
      if (!isWorkspaceScopedQuery(query.queryKey)) return false

      if (workspaceId !== undefined && workspaceId !== null) {
        return getWorkspaceIdFromQueryKey(query.queryKey) === workspaceId
      }

      return true
    },
  }).then(() => undefined)
}

