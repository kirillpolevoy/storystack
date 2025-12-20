'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useAvailableTags() {
  const supabase = createClient()

  // Get active workspace ID for query key (so it refetches when workspace changes)
  const activeWorkspaceId = typeof window !== 'undefined' 
    ? localStorage.getItem('@storystack:active_workspace_id')
    : null

  return useQuery({
    queryKey: ['availableTags', activeWorkspaceId],
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

      // Get all unique tags from workspace assets
      const { data: assets, error } = await supabase
        .from('assets')
        .select('tags')
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null) // Exclude soft-deleted assets
        .not('tags', 'is', null)

      if (error) throw error

      const allTags = new Set<string>()
      assets?.forEach((asset) => {
        if (Array.isArray(asset.tags)) {
          asset.tags.forEach((tag: string) => {
            if (tag && tag.trim()) {
              allTags.add(tag.trim())
            }
          })
        }
      })

      // Also include tags from tag_config.auto_tags (even if they have 0 photos)
      const { data: config } = await supabase
        .from('tag_config')
        .select('auto_tags')
        .eq('workspace_id', activeWorkspaceId)
        .single()

      if (config?.auto_tags && Array.isArray(config.auto_tags)) {
        config.auto_tags.forEach((tag: string) => {
          if (tag && tag.trim()) {
            allTags.add(tag.trim())
          }
        })
      }

      return Array.from(allTags).sort()
    },
  })
}

