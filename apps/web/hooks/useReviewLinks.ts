'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useActiveWorkspace } from './useActiveWorkspace'
import { ReviewLink } from '@/types'

interface CreateReviewLinkParams {
  name: string
  allowedTags?: string[]
  allowedAssetIds?: string[]
  expiresAt?: Date | null
  allowRating?: boolean
  allowNotes?: boolean
}

interface UpdateReviewLinkParams {
  id: string
  name?: string
  allowedTags?: string[]
  expiresAt?: Date | null
  isActive?: boolean
  allowRating?: boolean
  allowNotes?: boolean
}

export function useReviewLinks() {
  const supabase = createClient()
  const activeWorkspaceId = useActiveWorkspace()

  return useQuery({
    queryKey: ['review-links', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async () => {
      if (!activeWorkspaceId) return []

      const { data, error } = await supabase
        .from('review_links')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ReviewLink[]
    },
  })
}

export function useCreateReviewLink() {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const activeWorkspaceId = useActiveWorkspace()

  return useMutation({
    mutationFn: async ({
      name,
      allowedTags = [],
      allowedAssetIds = [],
      expiresAt = null,
      allowRating = true,
      allowNotes = true,
    }: CreateReviewLinkParams) => {
      if (!activeWorkspaceId) throw new Error('No active workspace')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('review_links')
        .insert({
          workspace_id: activeWorkspaceId,
          name,
          allowed_tags: allowedTags,
          allowed_asset_ids: allowedAssetIds,
          expires_at: expiresAt?.toISOString() || null,
          allow_rating: allowRating,
          allow_notes: allowNotes,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as ReviewLink
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-links'] })
    },
  })
}

export function useUpdateReviewLink() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      id,
      name,
      allowedTags,
      expiresAt,
      isActive,
      allowRating,
      allowNotes,
    }: UpdateReviewLinkParams) => {
      const updateData: Record<string, any> = {}

      if (name !== undefined) updateData.name = name
      if (allowedTags !== undefined) updateData.allowed_tags = allowedTags
      if (expiresAt !== undefined) updateData.expires_at = expiresAt?.toISOString() || null
      if (isActive !== undefined) updateData.is_active = isActive
      if (allowRating !== undefined) updateData.allow_rating = allowRating
      if (allowNotes !== undefined) updateData.allow_notes = allowNotes

      const { data, error } = await supabase
        .from('review_links')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as ReviewLink
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-links'] })
    },
  })
}

export function useDeleteReviewLink() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('review_links')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-links'] })
    },
  })
}

// Hook to fetch assets for a review link (used on public review page)
export function useReviewLinkAssets(linkId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['review-assets', linkId],
    enabled: !!linkId,
    queryFn: async () => {
      // Use the RPC function to get assets via review link
      const { data, error } = await supabase.rpc('get_review_link_assets', {
        link_id: linkId,
      })

      if (error) throw error

      // Map assets with public URLs
      return (data || []).map((asset: any) => ({
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
    },
  })
}

// Hook to get review link info (for public page header)
export function useReviewLinkInfo(linkId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['review-link-info', linkId],
    enabled: !!linkId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_review_link', {
        link_id: linkId,
      })

      if (error) throw error
      // RPC functions returning TABLE return an array, get first element
      const linkData = Array.isArray(data) ? data[0] : data
      if (!linkData) throw new Error('Review link not found or expired')

      return linkData as {
        id: string
        name: string
        allowed_tags: string[]
        allow_rating: boolean
        allow_notes: boolean
        workspace_name: string
      }
    },
  })
}
