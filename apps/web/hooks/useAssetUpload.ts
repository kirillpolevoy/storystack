'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadAsset, UploadProgress } from '@/utils/upload'
import { Asset } from '@/types'

export function useAssetUpload() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File
      onProgress?: (progress: number) => void
    }) => {
      return uploadAsset(file, onProgress)
    },
    onSuccess: () => {
      // Invalidate assets query to refetch
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}

