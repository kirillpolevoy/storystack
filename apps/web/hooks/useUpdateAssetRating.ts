'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { AssetRating } from '@/types'

interface UpdateRatingParams {
  assetId: string
  rating: AssetRating | null
  note?: string | null
}

export function useUpdateAssetRating() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ assetId, rating, note }: UpdateRatingParams) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('assets')
        .update({
          rating,
          rating_note: note ?? null,
          rated_at: rating ? new Date().toISOString() : null,
          rated_by: rating ? user?.id : null,
        })
        .eq('id', assetId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}

// Hook for updating rating via review link (anonymous access)
export function useUpdateAssetRatingViaReviewLink() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      linkId,
      assetId,
      rating,
      note,
    }: {
      linkId: string
      assetId: string
      rating: AssetRating | null
      note?: string | null
    }) => {
      // Call the RPC function that handles anonymous rating updates
      const { data, error } = await supabase.rpc('update_asset_rating_via_review_link', {
        p_link_id: linkId,
        p_asset_id: assetId,
        p_rating: rating,
        p_rating_note: note ?? null,
      })

      if (error) throw error
      if (!data) throw new Error('Failed to update rating')
      return data
    },
    onSuccess: (_, variables) => {
      // Invalidate the review assets query
      queryClient.invalidateQueries({ queryKey: ['review-assets', variables.linkId] })
    },
  })
}
