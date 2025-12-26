'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useActiveWorkspace } from './useActiveWorkspace'

export function useAvailableTags() {
  const supabase = createClient()

  // Use reactive workspace hook instead of reading localStorage directly
  const activeWorkspaceId = useActiveWorkspace()

  return useQuery({
    queryKey: ['availableTags', activeWorkspaceId],
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

      // Get all unique tags from workspace assets
      const { data: assets, error } = await supabase
        .from('assets')
        .select('tags')
        .eq('workspace_id', workspaceId)
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

      // Also include tags from tag_config.auto_tags and custom_tags (even if they have 0 photos)
      const { data: config } = await supabase
        .from('tag_config')
        .select('auto_tags, custom_tags')
        .eq('workspace_id', workspaceId)
        .single()

      if (config?.auto_tags && Array.isArray(config.auto_tags)) {
        config.auto_tags.forEach((tag: string) => {
          if (tag && tag.trim()) {
            allTags.add(tag.trim())
          }
        })
      }
      
      if (config?.custom_tags && Array.isArray(config.custom_tags)) {
        config.custom_tags.forEach((tag: string) => {
          if (tag && tag.trim()) {
            allTags.add(tag.trim())
          }
        })
      }

      return Array.from(allTags).sort()
    },
  })
}

