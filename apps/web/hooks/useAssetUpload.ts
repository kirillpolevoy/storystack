'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadFile, UploadProgress } from '@/utils/upload'
import { Asset } from '@/types'
import { useActiveWorkspace } from './useActiveWorkspace'

export function useAssetUpload() {
  const queryClient = useQueryClient()
  const activeWorkspaceId = useActiveWorkspace()

  return useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File
      onProgress?: (progress: number) => void
    }) => {
      // uploadFile automatically routes to uploadAsset or uploadVideoAsset
      return uploadFile(file, onProgress, activeWorkspaceId)
    },
    onSuccess: () => {
      // Invalidate assets query to refetch
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}




