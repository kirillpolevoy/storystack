'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Asset, StoryAsset } from '@/types'

export function useStoryAssets(storyId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['storyAssets', storyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_assets')
        .select('*, assets(*)')
        .eq('story_id', storyId)
        .order('order_index', { ascending: true })

      if (error) throw error

      const assets = (data || []).map((item: any) => {
        const asset = item.assets as any
        const thumbUrl = asset.storage_path_thumb
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_thumb).data.publicUrl
          : asset.storage_path_preview
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_preview).data.publicUrl
          : supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl

        const previewUrl = asset.storage_path_preview
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_preview).data.publicUrl
          : supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl

        const publicUrl = supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl

        return {
          ...asset,
          publicUrl,
          previewUrl,
          thumbUrl,
          storyAssetId: item.id,
          order_index: item.order_index,
        } as Asset & { storyAssetId: string; order_index: number }
      })

      return assets
    },
    enabled: !!storyId,
  })
}

export function useAddStoryAsset() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      storyId,
      assetId,
    }: {
      storyId: string
      assetId: string
    }) => {
      // Get current max order_index
      const { data: existing } = await supabase
        .from('story_assets')
        .select('order_index')
        .eq('story_id', storyId)
        .order('order_index', { ascending: false })
        .limit(1)
        .single()

      const orderIndex = existing ? existing.order_index + 1 : 0

      const { data, error } = await supabase
        .from('story_assets')
        .insert({
          story_id: storyId,
          asset_id: assetId,
          order_index: orderIndex,
        })
        .select()
        .single()

      if (error) throw error
      return data as StoryAsset
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storyAssets', variables.storyId] })
    },
  })
}

export function useRemoveStoryAsset() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (storyAssetId: string) => {
      const { error } = await supabase
        .from('story_assets')
        .delete()
        .eq('id', storyAssetId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyAssets'] })
    },
  })
}

export function useAddStoryAssets() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      storyId,
      assetIds,
    }: {
      storyId: string
      assetIds: string[]
    }) => {
      // Get current max order_index
      const { data: existing } = await supabase
        .from('story_assets')
        .select('order_index')
        .eq('story_id', storyId)
        .order('order_index', { ascending: false })
        .limit(1)
        .single()

      const startOrderIndex = existing ? existing.order_index + 1 : 0

      // Prepare inserts with order_index
      const inserts = assetIds.map((assetId, index) => ({
        story_id: storyId,
        asset_id: assetId,
        order_index: startOrderIndex + index,
      }))

      // Insert all assets (unique constraint will prevent duplicates)
      const { data, error } = await supabase
        .from('story_assets')
        .insert(inserts)
        .select()

      if (error) {
        // If error is due to unique constraint, that's okay - asset already in story
        // We'll filter out duplicates and continue
        if (error.code === '23505') {
          // Try inserting one by one, skipping duplicates
          const successful: StoryAsset[] = []
          for (const insert of inserts) {
            const { data: singleData, error: singleError } = await supabase
              .from('story_assets')
              .insert(insert)
              .select()
              .single()
            
            if (!singleError && singleData) {
              successful.push(singleData as StoryAsset)
            }
            // Ignore duplicate errors
          }
          return successful
        }
        throw error
      }

      return (data || []) as StoryAsset[]
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storyAssets', variables.storyId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] }) // Invalidate to refresh story counts
    },
  })
}

export function useUpdateStoryOrder() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      storyId,
      assetIds,
    }: {
      storyId: string
      assetIds: string[]
    }) => {
      // Get all story_assets for this story
      const { data: storyAssets } = await supabase
        .from('story_assets')
        .select('id, asset_id')
        .eq('story_id', storyId)

      if (!storyAssets) return

      // Update order_index for each asset
      const updates = assetIds.map(async (assetId, index) => {
        const storyAsset = storyAssets.find((sa) => sa.asset_id === assetId)
        if (!storyAsset) return

        const { error } = await supabase
          .from('story_assets')
          .update({ order_index: index })
          .eq('id', storyAsset.id)

        if (error) throw error
      })

      await Promise.all(updates)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storyAssets', variables.storyId] })
    },
  })
}

