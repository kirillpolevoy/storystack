'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useUpdateAssetTags() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      assetId,
      tags,
    }: {
      assetId: string
      tags: string[]
    }) => {
      const { data, error } = await supabase
        .from('assets')
        .update({ tags })
        .eq('id', assetId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset', variables.assetId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['availableTags'] })
    },
  })
}

