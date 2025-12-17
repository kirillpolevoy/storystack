'use client'

import { useEffect, useState } from 'react'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { AlertCircle, Info } from 'lucide-react'

interface DuplicateFile {
  name: string
  index: number
  file: File
}

interface DuplicateDetectionDialogProps {
  open: boolean
  totalCount: number
  duplicateCount: number
  duplicateFiles: DuplicateFile[]
  onImportAll: () => void
  onSkipDuplicates: () => void
  onCancel: () => void
}

export function DuplicateDetectionDialog({
  open,
  totalCount,
  duplicateCount,
  duplicateFiles,
  onImportAll,
  onSkipDuplicates,
  onCancel,
}: DuplicateDetectionDialogProps) {
  const uniqueCount = totalCount - duplicateCount
  const allDuplicates = duplicateCount === totalCount
  const [previewUrls, setPreviewUrls] = useState<Map<number, string>>(new Map())

  // Generate preview URLs from File objects
  useEffect(() => {
    if (!open || duplicateFiles.length === 0) {
      // Clean up URLs when dialog closes
      setPreviewUrls((prevUrls) => {
        prevUrls.forEach((url) => URL.revokeObjectURL(url))
        return new Map()
      })
      return
    }

    const newUrls = new Map<number, string>()
    
    duplicateFiles.forEach((fileData) => {
      if (fileData.file) {
        try {
          const url = URL.createObjectURL(fileData.file)
          newUrls.set(fileData.index, url)
        } catch (error) {
          console.error('[DuplicateDetectionDialog] Failed to create object URL:', error)
        }
      }
    })

    setPreviewUrls(newUrls)

    // Cleanup function
    return () => {
      newUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [open, duplicateFiles])

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              allDuplicates ? 'bg-amber-100' : 'bg-blue-100'
            }`}>
              {allDuplicates ? (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              ) : (
                <Info className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <AlertDialogTitle className="text-lg font-semibold text-gray-900">
              {allDuplicates ? 'All Photos Are Duplicates' : 'Duplicate Photos Found'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-gray-600">
            {allDuplicates
              ? `${duplicateCount} photo${duplicateCount > 1 ? 's' : ''} already exist${duplicateCount > 1 ? '' : 's'} in your library`
              : `${duplicateCount} of ${totalCount} photo${totalCount > 1 ? 's' : ''} already exist${totalCount > 1 ? '' : 's'}`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {duplicateFiles.length > 0 && (
          <div className="my-4 space-y-2">
            <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Duplicate Photos</p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
              <div className={`grid gap-2 ${
                duplicateFiles.length === 1 
                  ? 'grid-cols-1 max-w-[120px]' 
                  : duplicateFiles.length <= 4
                  ? 'grid-cols-4'
                  : 'grid-cols-4'
              }`}>
                {duplicateFiles.map((fileData, idx) => {
                  const previewUrl = previewUrls.get(fileData.index)
                  return (
                    <div
                      key={idx}
                      className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shadow-sm"
                    >
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={fileData.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback if image fails to load
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent) {
                              parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><div class="h-8 w-8 rounded bg-gray-300"></div></div>'
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                          <div className="h-8 w-8 rounded bg-gray-300 animate-pulse" />
                        </div>
                      )}
                      {/* Overlay with filename on hover */}
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                        <p className="text-xs text-white text-center line-clamp-2 font-medium">
                          {fileData.name}
                        </p>
                      </div>
                      {/* Duplicate badge */}
                      <div className="absolute top-1.5 right-1.5 z-10">
                        <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                          <AlertCircle className="h-3 w-3 text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {allDuplicates && (
          <div className="my-4 rounded-md bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              Importing will create duplicate copies in your library
            </p>
          </div>
        )}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onCancel} className="rounded-md">
            Cancel
          </AlertDialogCancel>
          {!allDuplicates && (
            <AlertDialogAction
              onClick={onSkipDuplicates}
              className="rounded-md bg-accent hover:bg-accent/90"
            >
              Skip Duplicates ({uniqueCount} {uniqueCount === 1 ? 'photo' : 'photos'})
            </AlertDialogAction>
          )}
          <AlertDialogAction
            onClick={onImportAll}
            className={`rounded-md ${
              allDuplicates
                ? 'bg-accent hover:bg-accent/90'
                : 'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            {allDuplicates
              ? `Import ${duplicateCount} ${duplicateCount === 1 ? 'Photo' : 'Photos'}`
              : `Import All (${totalCount} ${totalCount === 1 ? 'photo' : 'photos'})`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

