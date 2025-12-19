'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Asset } from '@/types'

export function useAssetDetail(assetId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['asset', assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single()

      if (error) throw error

      const asset = data as Asset

      // Map with URLs
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
      } as Asset
    },
    enabled: !!assetId,
  })
}


