'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Story } from '@/types'
import { useActiveWorkspace } from './useActiveWorkspace'

export function useStories() {
  const supabase = createClient()
  const activeWorkspaceId = useActiveWorkspace()

  return useQuery({
    queryKey: ['stories', activeWorkspaceId],
    enabled: !!activeWorkspaceId, // Only run query when workspace ID is available
    staleTime: 0, // Consider data stale immediately
    gcTime: 0, // Don't cache data when workspace changes
    refetchOnMount: 'always', // Always refetch on mount
    queryFn: async ({ queryKey }) => {
      // Extract workspace ID from query key to ensure we use the correct one
      const workspaceId = queryKey[1] as string | null
      console.log('[useStories] Fetching stories for workspace:', workspaceId, '(from queryKey)')
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      if (!workspaceId) {
        // No active workspace, return empty array
        return []
      }

      // Fetch stories with their first asset for thumbnail
      // Filter by active workspace_id to ensure users only see stories from their active workspace
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
        .eq('workspace_id', workspaceId) // Filter by active workspace
        .is('deleted_at', null) // Exclude soft-deleted stories
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('[useStories] Error fetching stories:', error)
        throw error
      }

      console.log('[useStories] Fetched', data?.length || 0, 'stories for workspace:', workspaceId)

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
  const activeWorkspaceId = useActiveWorkspace()

  return useMutation({
    mutationFn: async (name: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      if (!activeWorkspaceId) {
        throw new Error('No active workspace selected')
      }

      const { data, error } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          workspace_id: activeWorkspaceId, // Set workspace_id when creating story
          name,
          description: null,
        })
        .select()
        .single()

      if (error) throw error
      return data as Story
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', activeWorkspaceId] })
    },
  })
}

export function useUpdateStory() {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const activeWorkspaceId = useActiveWorkspace()

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
      queryClient.invalidateQueries({ queryKey: ['stories', activeWorkspaceId] })
    },
  })
}

export function useDeleteStory() {
  const activeWorkspaceId = useActiveWorkspace()
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
      queryClient.invalidateQueries({ queryKey: ['stories', activeWorkspaceId] })
    },
  })
}

