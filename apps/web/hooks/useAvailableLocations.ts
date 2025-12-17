'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useAvailableLocations() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['availableLocations'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return []
      }

      const { data, error } = await supabase
        .from('assets')
        .select('location')
        .eq('user_id', user.id)
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

