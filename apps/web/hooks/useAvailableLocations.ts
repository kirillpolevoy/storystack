'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useAvailableLocations() {
  const supabase = createClient()

  // Get active workspace ID for query key (so it refetches when workspace changes)
  const activeWorkspaceId = typeof window !== 'undefined' 
    ? localStorage.getItem('@storystack:active_workspace_id')
    : null

  return useQuery({
    queryKey: ['availableLocations', activeWorkspaceId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return []
      }

      if (!activeWorkspaceId) {
        return []
      }

      const { data, error } = await supabase
        .from('assets')
        .select('location')
        .eq('workspace_id', activeWorkspaceId)
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

