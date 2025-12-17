'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAssetUpload } from '@/hooks/useAssetUpload'
import { Button } from '@/components/ui/button'
import { Upload, X, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { UploadProgress } from '@/utils/upload'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { computeImageHash, checkForDuplicates } from '@/utils/duplicateDetection'
import { DuplicateDetectionDialog } from './DuplicateDetectionDialog'
import { createClient } from '@/lib/supabase/client'

interface UploadZoneProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete?: (assetId: string) => void
}

export function UploadZone({ open, onOpenChange, onUploadComplete }: UploadZoneProps) {
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([])
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [duplicateIndices, setDuplicateIndices] = useState<number[]>([])
  const [fileHashes, setFileHashes] = useState<string[]>([])
  const uploadMutation = useAssetUpload()

  const processFiles = useCallback(
    async (files: File[], skipDuplicates: boolean = false) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        console.error('[UploadZone] User not authenticated')
        return
      }

      // Process files that should be uploaded
      const filesToUpload = skipDuplicates
        ? files.filter((_, index) => !duplicateIndices.includes(index))
        : files

      filesToUpload.forEach((file) => {
        const progress: UploadProgress = {
          file,
          progress: 0,
          status: 'pending',
        }
        setUploadQueue((prev) => [...prev, progress])

        uploadMutation.mutate(
          {
            file,
            onProgress: (progressValue) => {
              setUploadQueue((prev) =>
                prev.map((item) =>
                  item.file === file
                    ? { ...item, progress: progressValue, status: 'uploading' as const }
                    : item
                )
              )
            },
          },
          {
            onSuccess: (asset) => {
              setUploadQueue((prev) =>
                prev.map((item) =>
                  item.file === file
                    ? { ...item, status: 'success' as const, asset }
                    : item
                )
              )
              // Notify parent that upload completed (for tagging feedback)
              if (asset?.id) {
                onUploadComplete?.(asset.id)
              }
              // Remove from queue after 1.5 seconds
              setTimeout(() => {
                setUploadQueue((prev) => prev.filter((item) => item.file !== file))
                // Auto-close dialog if all uploads complete and queue is empty
                setTimeout(() => {
                  setUploadQueue((prev) => {
                    if (prev.length === 0) {
                      setTimeout(() => onOpenChange(false), 300)
                    }
                    return prev
                  })
                }, 100)
              }, 1500)
            },
            onError: (error: Error) => {
              setUploadQueue((prev) =>
                prev.map((item) =>
                  item.file === file
                    ? { ...item, status: 'error' as const, error: error.message }
                    : item
                )
              )
            },
          }
        )
      })
    },
    [uploadMutation, onUploadComplete, onOpenChange, duplicateIndices]
  )

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        console.error('[UploadZone] User not authenticated')
        return
      }

      // Compute hashes for all files
      try {
        const hashes = await Promise.all(
          acceptedFiles.map((file) => computeImageHash(file).catch(() => ''))
        )

        // Filter out empty hashes (failed computations)
        const validHashes = hashes.filter((hash) => hash !== '')

        if (validHashes.length > 0) {
          // Check for duplicates
          const duplicateIndicesResult = await checkForDuplicates(user.id, validHashes)

          if (duplicateIndicesResult.length > 0) {
            // Map back to original file indices (accounting for failed hash computations)
            const mappedDuplicateIndices: number[] = []
            let validHashIndex = 0
            hashes.forEach((hash, fileIndex) => {
              if (hash !== '') {
                if (duplicateIndicesResult.includes(validHashIndex)) {
                  mappedDuplicateIndices.push(fileIndex)
                }
                validHashIndex++
              }
            })

            // Store state for duplicate dialog
            setPendingFiles(acceptedFiles)
            setDuplicateIndices(mappedDuplicateIndices)
            setFileHashes(hashes)
            setShowDuplicateDialog(true)
            return
          }
        }

        // No duplicates found, proceed with upload
        await processFiles(acceptedFiles, false)
      } catch (error) {
        console.error('[UploadZone] Error checking duplicates:', error)
        // On error, proceed with upload (fail open)
        await processFiles(acceptedFiles, false)
      }
    },
    [processFiles]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
    },
    multiple: true,
    noClick: false,
  })

  const removeFromQueue = (file: File) => {
    setUploadQueue((prev) => prev.filter((item) => item.file !== file))
  }

  const handleClose = () => {
    // Only allow closing if no uploads are in progress
    const hasActiveUploads = uploadQueue.some(item => item.status === 'uploading' || item.status === 'pending')
    if (!hasActiveUploads) {
      setUploadQueue([])
      setPendingFiles([])
      setDuplicateIndices([])
      setFileHashes([])
      onOpenChange(false)
    }
  }

  const handleImportAll = async () => {
    setShowDuplicateDialog(false)
    await processFiles(pendingFiles, false)
    setPendingFiles([])
    setDuplicateIndices([])
    setFileHashes([])
  }

  const handleSkipDuplicates = async () => {
    setShowDuplicateDialog(false)
    await processFiles(pendingFiles, true)
    setPendingFiles([])
    setDuplicateIndices([])
    setFileHashes([])
  }

  const handleCancelDuplicate = () => {
    setShowDuplicateDialog(false)
    setPendingFiles([])
    setDuplicateIndices([])
    setFileHashes([])
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-lg font-semibold text-gray-900">Upload Images</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Drag and drop images here or click to browse
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {/* Dropzone - Premium, minimal design */}
          <div
            {...getRootProps()}
            className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-all duration-200 ${
              isDragActive
                ? 'border-accent bg-accent/5 scale-[1.02] shadow-lg'
                : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className={`mb-4 transition-all duration-200 ${
                isDragActive ? 'scale-110' : ''
              }`}>
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
                  isDragActive 
                    ? 'bg-accent/10' 
                    : 'bg-gray-100'
                }`}>
                  <Upload className={`h-6 w-6 transition-colors ${
                    isDragActive ? 'text-accent' : 'text-gray-400'
                  }`} />
                </div>
              </div>
              <p className={`text-sm font-medium mb-1 transition-colors ${
                isDragActive ? 'text-accent' : 'text-gray-900'
              }`}>
                {isDragActive ? 'Drop files to upload' : 'Drag images here'}
              </p>
              <p className="text-xs text-gray-500">
                or click to select files
              </p>
            </div>
          </div>

          {/* Upload Queue - Compact, premium list */}
          {uploadQueue.length > 0 && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {uploadQueue.map((item) => (
                <div
                  key={item.file.name}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-all hover:shadow-sm"
                >
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.file.name}</p>
                    {item.status === 'uploading' && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full bg-accent transition-all duration-300 ease-out"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                    {item.status === 'error' && item.error && (
                      <p className="mt-1 text-xs text-red-600">{item.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status === 'success' && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    {(item.status === 'pending' || item.status === 'error') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFromQueue(item.file)
                        }}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Duplicate Detection Dialog */}
      <DuplicateDetectionDialog
        open={showDuplicateDialog}
        totalCount={pendingFiles.length}
        duplicateCount={duplicateIndices.length}
        duplicateFiles={duplicateIndices.map((index) => ({
          name: pendingFiles[index]?.name || `File ${index + 1}`,
          index,
          file: pendingFiles[index],
        }))}
        onImportAll={handleImportAll}
        onSkipDuplicates={handleSkipDuplicates}
        onCancel={handleCancelDuplicate}
      />
    </Dialog>
  )
}
