'use client'

import { useEffect, useState } from 'react'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { AlertCircle, Info, X } from 'lucide-react'

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
      <AlertDialogContent 
        className="max-w-2xl w-full max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden"
        highZIndex={true}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 z-20 rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <AlertDialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              allDuplicates ? 'bg-amber-100' : 'bg-blue-100'
            }`}>
              {allDuplicates ? (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              ) : (
                <Info className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle className="text-lg font-semibold text-gray-900 mb-1">
                {allDuplicates ? 'All Photos Are Duplicates' : 'Duplicate Photos Found'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600">
                {allDuplicates
                  ? `${duplicateCount} photo${duplicateCount > 1 ? 's' : ''} already exist${duplicateCount > 1 ? '' : 's'} in your library`
                  : `${duplicateCount} of ${totalCount} photo${totalCount > 1 ? 's' : ''} already exist${totalCount > 1 ? '' : 's'}`}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {duplicateFiles.length > 0 && (
          <div className="px-6 pb-4 space-y-3 flex-1 min-h-0 flex flex-col">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Duplicate Photos</p>
            <div className="flex-1 min-h-[200px] rounded-lg border border-gray-200 bg-gray-50 p-3 overflow-hidden">
              <div className="overflow-x-auto overflow-y-hidden h-full">
                <div className="flex gap-3 pb-2 h-full items-center">
                  {duplicateFiles.map((fileData, idx) => {
                    const previewUrl = previewUrls.get(fileData.index)
                    return (
                      <div
                        key={idx}
                        className="group relative flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm"
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
                          <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm border-2 border-white">
                            <AlertCircle className="h-3 w-3 text-white fill-white" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {allDuplicates && (
          <div className="mx-6 mb-4 rounded-md bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              Importing will create duplicate copies in your library
            </p>
          </div>
        )}

        <div className="px-6 pb-6 pt-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex flex-row items-center justify-between gap-2">
            <AlertDialogCancel 
              onClick={onCancel} 
              className="rounded-md border-gray-300 hover:bg-gray-50 text-gray-700 bg-white"
            >
              Cancel
            </AlertDialogCancel>
            <div className="flex gap-2">
              {!allDuplicates && (
                <AlertDialogAction
                  onClick={onSkipDuplicates}
                  className="rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
                >
                  Skip Duplicates ({uniqueCount} {uniqueCount === 1 ? 'photo' : 'photos'})
                </AlertDialogAction>
              )}
              <AlertDialogAction
                onClick={onImportAll}
                className={`rounded-md text-white font-medium shadow-sm ${
                  allDuplicates
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {allDuplicates
                  ? `Import ${duplicateCount} ${duplicateCount === 1 ? 'Photo' : 'Photos'}`
                  : `Import All (${totalCount} ${totalCount === 1 ? 'photo' : 'photos'})`}
              </AlertDialogAction>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

