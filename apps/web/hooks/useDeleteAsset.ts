'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useDeleteAsset() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (assetId: string) => {
      // First get the asset to get storage paths
      const { data: asset, error: fetchError } = await supabase
        .from('assets')
        .select('storage_path, storage_path_preview, storage_path_thumb')
        .eq('id', assetId)
        .single()

      if (fetchError) throw fetchError

      // Delete storage files
      const pathsToDelete = [
        asset.storage_path,
        asset.storage_path_preview,
        asset.storage_path_thumb,
      ].filter(Boolean) as string[]

      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('assets')
          .remove(pathsToDelete)

        if (storageError) {
          console.error('Error deleting storage files:', storageError)
          // Continue with DB deletion even if storage deletion fails
        }
      }

      // Soft delete DB record (set deleted_at timestamp)
      // RLS policy only allows UPDATE, not DELETE
      const { error: deleteError } = await supabase
        .from('assets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', assetId)

      if (deleteError) {
        console.error('[useDeleteAsset] Error soft-deleting asset:', deleteError)
        throw deleteError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['availableTags'] })
    },
  })
}




