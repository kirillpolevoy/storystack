'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { StoryLink } from '@/types'

interface CreateStoryLinkParams {
  storyId: string
  name?: string
  expiresAt?: Date | null
}

interface UpdateStoryLinkParams {
  id: string
  name?: string
  expiresAt?: Date | null
  isActive?: boolean
}

export function useStoryLinks(storyId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['story-links', storyId],
    enabled: !!storyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_links')
        .select('*')
        .eq('story_id', storyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as StoryLink[]
    },
  })
}

export function useCreateStoryLink() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      storyId,
      name = 'Share Link',
      expiresAt = null,
    }: CreateStoryLinkParams) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('story_links')
        .insert({
          story_id: storyId,
          name,
          expires_at: expiresAt?.toISOString() || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as StoryLink
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['story-links', variables.storyId] })
    },
  })
}

export function useUpdateStoryLink() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      id,
      name,
      expiresAt,
      isActive,
    }: UpdateStoryLinkParams) => {
      const updateData: Record<string, any> = {}

      if (name !== undefined) updateData.name = name
      if (expiresAt !== undefined) updateData.expires_at = expiresAt?.toISOString() || null
      if (isActive !== undefined) updateData.is_active = isActive

      const { data, error } = await supabase
        .from('story_links')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as StoryLink
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['story-links', data.story_id] })
    },
  })
}

export function useDeleteStoryLink() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ id, storyId }: { id: string; storyId: string }) => {
      const { error } = await supabase
        .from('story_links')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['story-links', variables.storyId] })
    },
  })
}

// Hook to get story data via share link (for public page)
export function useStoryViaLink(linkId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['story-via-link', linkId],
    enabled: !!linkId,
    queryFn: async () => {
      // Use the RPC function to get story data via link
      const { data, error } = await supabase.rpc('get_story_via_link', {
        p_link_id: linkId,
      })

      if (error) throw error
      if (!data) throw new Error('Story not found or link expired')

      // Parse the JSON data and map assets with public URLs
      const storyData = data as {
        story_id: string
        story_name: string
        story_description: string | null
        link_name: string
        assets: any[]
      }

      // Map assets with public URLs
      const assetsWithUrls = storyData.assets.map((asset: any) => ({
        ...asset,
        publicUrl: asset.storage_path
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl
          : null,
        previewUrl: asset.storage_path_preview
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_preview).data.publicUrl
          : asset.storage_path
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl
          : null,
        thumbUrl: asset.storage_path_thumb
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_thumb).data.publicUrl
          : null,
        thumbnailFrameUrls: asset.thumbnail_frames
          ? asset.thumbnail_frames.map((path: string) =>
              supabase.storage.from('assets').getPublicUrl(path).data.publicUrl
            )
          : [],
      }))

      return {
        ...storyData,
        assets: assetsWithUrls,
      }
    },
  })
}

// Hook to increment view count
export function useIncrementStoryLinkView() {
  const supabase = createClient()

  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.rpc('increment_story_link_view', {
        p_link_id: linkId,
      })

      if (error) {
        console.warn('Failed to increment view count:', error)
        // Don't throw - this is non-critical
      }
    },
  })
}
