'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useUpdateAssetLocation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      assetId,
      location,
    }: {
      assetId: string
      location: string | null
    }) => {
      const { data, error } = await supabase
        .from('assets')
        .update({ location })
        .eq('id', assetId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset', variables.assetId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['availableLocations'] })
    },
  })
}


