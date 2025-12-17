'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useAvailableTags() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['availableTags'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return []
      }

      // Get all unique tags from user's assets
      const { data: assets, error } = await supabase
        .from('assets')
        .select('tags')
        .eq('user_id', user.id)
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
        .eq('user_id', user.id)
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

