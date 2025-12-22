'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useActiveWorkspace } from './useActiveWorkspace'

export function useAvailableLocations() {
  const supabase = createClient()

  // Use reactive workspace hook instead of reading localStorage directly
  const activeWorkspaceId = useActiveWorkspace()

  return useQuery({
    queryKey: ['availableLocations', activeWorkspaceId],
    enabled: !!activeWorkspaceId, // Only run query when workspace ID is available
    staleTime: 0, // Consider data stale immediately
    gcTime: 0, // Don't cache data when workspace changes
    queryFn: async ({ queryKey }) => {
      // Extract workspace ID from query key to ensure we use the correct one
      const workspaceId = queryKey[1] as string | null
      
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return []
      }

      if (!workspaceId) {
        return []
      }

      const { data, error } = await supabase
        .from('assets')
        .select('location')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null) // Exclude soft-deleted assets
        .not('location', 'is', null)

      if (error) throw error

      // Get unique, non-null locations
      const locations = new Set<string>()
      data?.forEach((asset) => {
        if (asset.location && asset.location.trim()) {
          locations.add(asset.location.trim())
        }
      })

      return Array.from(locations).sort()
    },
  })
}

