/**
 * Centralized query key factory for type-safe React Query keys
 * Ensures consistent query key patterns across the application
 */

/**
 * Workspace-scoped query keys
 * All queries that depend on workspace should use these factories
 */
export const workspaceQueryKeys = {
  /**
   * Assets query key
   * @param workspaceId - Active workspace ID
   * @param searchQuery - Optional search query
   * @param filters - Optional filters
   * @param viewFilter - Optional view filter
   */
  assets: (
    workspaceId: string | null,
    searchQuery?: string,
    filters?: string[],
    viewFilter?: string
  ) => {
    const key: unknown[] = ['assets', workspaceId]
    if (searchQuery !== undefined) key.push(searchQuery)
    if (filters !== undefined) key.push(filters)
    if (viewFilter !== undefined) key.push(viewFilter)
    return key
  },

  /**
   * Tags query key
   * @param workspaceId - Active workspace ID
   */
  tags: (workspaceId: string | null) => ['tags', workspaceId] as const,

  /**
   * Available tags query key
   * @param workspaceId - Active workspace ID
   */
  availableTags: (workspaceId: string | null) =>
    ['availableTags', workspaceId] as const,

  /**
   * Available locations query key
   * @param workspaceId - Active workspace ID
   */
  availableLocations: (workspaceId: string | null) =>
    ['availableLocations', workspaceId] as const,

  /**
   * Stories query key
   * @param workspaceId - Active workspace ID
   */
  stories: (workspaceId: string | null) => ['stories', workspaceId] as const,

  /**
   * Workspace details query key
   * @param workspaceId - Active workspace ID
   */
  workspace: (workspaceId: string | null) =>
    ['workspace', workspaceId] as const,

  /**
   * Workspace members query key
   * @param workspaceId - Active workspace ID
   */
  workspaceMembers: (workspaceId: string | null) =>
    ['workspace-members', workspaceId] as const,

  /**
   * Workspace invitations query key
   * @param workspaceId - Active workspace ID
   */
  workspaceInvitations: (workspaceId: string | null) =>
    ['workspace-invitations', workspaceId] as const,
}

/**
 * Global query keys (not workspace-scoped)
 */
export const globalQueryKeys = {
  /**
   * User query key
   */
  user: () => ['user'] as const,

  /**
   * User workspaces query key
   * @param userId - User ID
   */
  workspaces: (userId: string | null) => ['workspaces', userId] as const,

  /**
   * User preferences query key
   * @param userId - User ID
   */
  userPreferences: (userId: string | null) =>
    ['user_preferences', userId] as const,
}

/**
 * Check if a query key is workspace-scoped
 */
export function isWorkspaceScopedQuery(
  queryKey: readonly unknown[]
): boolean {
  if (!queryKey || queryKey.length === 0) return false

  const workspaceScopedKeys = [
    'assets',
    'tags',
    'availableTags',
    'availableLocations',
    'stories',
    'workspace',
    'workspace-members',
    'workspace-invitations',
  ]

  return workspaceScopedKeys.includes(queryKey[0] as string)
}

/**
 * Get workspace ID from a workspace-scoped query key
 */
export function getWorkspaceIdFromQueryKey(
  queryKey: readonly unknown[]
): string | null {
  if (!isWorkspaceScopedQuery(queryKey)) return null
  return (queryKey[1] as string) || null
}

