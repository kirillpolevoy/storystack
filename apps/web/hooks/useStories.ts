'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Story } from '@/types'

export function useStories() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      // Fetch stories with their first asset for thumbnail
      // RLS policies handle workspace membership, but we filter out soft-deleted stories
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          story_assets(
            order_index,
            assets(
              id,
              storage_path,
              storage_path_thumb,
              storage_path_preview
            )
          )
        `)
        .is('deleted_at', null) // Exclude soft-deleted stories
        .order('updated_at', { ascending: false })

      if (error) throw error

      // Process stories to get thumbnail URL for first asset
      const storiesWithThumbnails = (data || []).map((story: any) => {
        // Get first asset (lowest order_index)
        const storyAssets = story.story_assets || []
        if (storyAssets.length === 0) {
          return {
            ...story,
            thumbnailUrl: null,
            assetCount: 0,
          }
        }

        // Sort by order_index and get first asset
        const sortedAssets = storyAssets
          .filter((sa: any) => sa.assets) // Filter out null assets
          .sort((a: any, b: any) => a.order_index - b.order_index)
        const firstAsset = sortedAssets[0]?.assets

        if (!firstAsset) {
          return {
            ...story,
            thumbnailUrl: null,
            assetCount: storyAssets.length,
          }
        }

        // Generate thumbnail URL
        const thumbPath = firstAsset.storage_path_thumb || firstAsset.storage_path_preview || firstAsset.storage_path
        const thumbnailUrl = thumbPath
          ? supabase.storage.from('assets').getPublicUrl(thumbPath).data.publicUrl
          : null

        return {
          ...story,
          thumbnailUrl,
          assetCount: storyAssets.length,
        }
      })

      return storiesWithThumbnails as (Story & { thumbnailUrl: string | null; assetCount: number })[]
    },
  })
}

export function useCreateStory() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const { data, error } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          name,
          description: null,
        })
        .select()
        .single()

      if (error) throw error
      return data as Story
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

export function useUpdateStory() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ storyId, name, description }: { storyId: string; name?: string; description?: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const updates: { name?: string; description?: string | null; updated_at?: string } = {}
      if (name !== undefined) updates.name = name
      if (description !== undefined) updates.description = description
      updates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('stories')
        .update(updates)
        .eq('id', storyId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      return data as Story
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

export function useDeleteStory() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (storyId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      // Soft delete: Set deleted_at and deleted_by (RLS policy requires UPDATE, not DELETE)
      const { error } = await supabase
        .from('stories')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', storyId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

