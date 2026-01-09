'use client'

import { useCallback, useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAssetUpload } from '@/hooks/useAssetUpload'
import { Button } from '@/components/ui/button'
import { Upload, X, CheckCircle2, AlertCircle, Image as ImageIcon, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UploadProgress } from '@/utils/upload'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { computeImageHash, checkForDuplicates } from '@/utils/duplicateDetection'
import { DuplicateDetectionDialog } from './DuplicateDetectionDialog'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { addBatchToPoll, startBatchPolling } from '@/utils/pollBatchStatus'
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace'
import { useTrialGate } from '@/components/subscription/TrialGateProvider'
import { toast } from '@/components/ui/use-toast'

interface UploadZoneProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete?: (assetId: string) => void
  onBatchTaggingStart?: (assetIds: string[]) => void // Called when batch tagging starts for progress tracking
}

export function UploadZone({ open, onOpenChange, onUploadComplete, onBatchTaggingStart }: UploadZoneProps) {
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([])
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [duplicateIndices, setDuplicateIndices] = useState<number[]>([])
  const [fileHashes, setFileHashes] = useState<string[]>([])
  const [uploadedAssets, setUploadedAssets] = useState<Array<{ id: string; publicUrl: string }>>([])
  const uploadedAssetsRef = useRef<Array<{ id: string; publicUrl: string }>>([])
  const batchTaggingTriggeredRef = useRef<boolean>(false)
  const completionTrackerRef = useRef<{ count: number; total: number }>({ count: 0, total: 0 })
  const uploadMutation = useAssetUpload()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const activeWorkspaceId = useActiveWorkspace()
  const { withUploadAccess } = useTrialGate()

  // Batch trigger auto-tagging for all uploaded assets
  // This is more efficient than individual calls, especially for 20+ assets
  const triggerBatchTagging = useCallback(async (assets: Array<{ id: string; publicUrl: string }>, retryCount: number = 0): Promise<void> => {
    if (assets.length === 0) {
      console.warn('[UploadZone] ⚠️  triggerBatchTagging called with 0 assets')
      return
    }

    const maxRetries = 3
    const retryDelay = 2000 // 2 seconds between retries

    console.log(`[UploadZone] 🚀 Triggering batch auto-tagging for ${assets.length} assets${retryCount > 0 ? ` (retry ${retryCount}/${maxRetries})` : ''}`)
    console.log(`[UploadZone] Asset IDs:`, assets.map(a => a.id))
    console.log(`[UploadZone] Asset URLs:`, assets.map(a => a.publicUrl))

    if (!supabase) {
      console.error('[UploadZone] ❌ Supabase client not initialized!')
      return
    }

    try {
      // Prepare batch request
      const batchRequest = {
        assets: assets.map(asset => ({
          assetId: asset.id,
          imageUrl: asset.publicUrl,
        })),
      }

      console.log(`[UploadZone] 📤 Calling edge function 'auto_tag_asset' with batch request:`, {
        assetCount: batchRequest.assets.length,
        firstAssetId: batchRequest.assets[0]?.assetId,
        firstImageUrl: batchRequest.assets[0]?.imageUrl?.substring(0, 100) + '...',
      })

      // Notify parent to start tracking progress (only on first attempt, not retries)
      if (retryCount === 0 && onBatchTaggingStart) {
        const assetIds = assets.map(a => a.id)
        console.log(`[UploadZone] 📊 Starting progress tracking for ${assetIds.length} assets`)
        onBatchTaggingStart(assetIds)
      }

      // Call edge function with batch request
      // The edge function will use OpenAI Batch API for 20+ images (50% cost savings)
      // For <20 images, it uses synchronous API calls
      const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
        body: batchRequest,
      })

      console.log(`[UploadZone] 📥 Edge function response received:`, { data, error })

      if (error) {
        console.error('[UploadZone] ❌ Batch auto-tagging error:', error)
        console.error('[UploadZone] Error details:', JSON.stringify(error, null, 2))
        console.error('[UploadZone] Error message:', error.message || 'Unknown error')
        console.error('[UploadZone] Error context:', error.context || 'No context')
        
        // Check if it's a tag vocabulary issue
        if (error.message?.includes('No tags enabled') || error.message?.includes('tag vocabulary')) {
          console.warn('[UploadZone] ⚠️  No tags enabled for auto-tagging. Please enable tags in tag configuration.')
          return // Don't retry for this error
        }
        
        // Check if it's a 404 (assets not found) - retry with delay
        const isNotFoundError = error.message?.includes('not found') || 
                               error.message?.includes('Assets not found') ||
                               error.context?.status === 404
        
        if (isNotFoundError && retryCount < maxRetries) {
          console.warn(`[UploadZone] ⚠️  Assets not found (likely DB replication lag). Retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return triggerBatchTagging(assets, retryCount + 1)
        }
        
        // Don't throw - uploads succeeded, tagging can retry later via bulk retag
        if (isNotFoundError) {
          console.error('[UploadZone] ❌ Assets still not found after retries. They may not be committed yet.')
        }
        return
      }

      // Check if response indicates no tags enabled
      // Skip this check for Batch API (batchId/batchIds present) since tags are applied later
      const hasBatchId = data?.batchId || (data?.batchIds && data.batchIds.length > 0)
      if (!hasBatchId && data?.results && Array.isArray(data.results)) {
        const allEmpty = data.results.every((r: any) => !r.tags || r.tags.length === 0)
        if (allEmpty && data.results.length > 0) {
          console.warn('[UploadZone] ⚠️  All results have empty tags. This might indicate no tags are enabled for auto-tagging.')
          console.warn('[UploadZone] ⚠️  Please check tag configuration at /app/tags and ensure at least one tag is enabled for AI auto-tagging.')

          // Show user-visible warning via toast
          toast({
            title: 'No tags applied',
            description: 'Enable AI tags in Tag Management to automatically tag your photos.',
          })
        }
      }

      // Handle response based on type (batch API vs immediate processing)
      if (data?.batchId) {
        // Batch API: Async processing (20+ images)
        console.log(`[UploadZone] ✅ Batch API job created: ${data.batchId}`)
        console.log(`[UploadZone] Using OpenAI Batch API (async processing, 50% cost savings)`)
        
        // Add batch to polling queue immediately
        addBatchToPoll(data.batchId)
        startBatchPolling(activeWorkspaceId)
        
        console.log(`[UploadZone] ✅ Added batch ${data.batchId} to polling queue`)
        
        // Refresh UI to show pending status - multiple refreshes to ensure visibility
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        
        // Additional refresh after a delay to ensure UI updates
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['assets'] })
        }, 1000)
        
      } else if (data?.results) {
        // Immediate processing: Results already available (< 20 images)
        console.log(`[UploadZone] ✅ Immediate processing complete for ${assets.length} assets`)
        console.log(`[UploadZone] Results:`, data.results)
        
        // Results are already saved to DB by edge function
        // Refresh UI to show updated tags
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        
        // Small delay to ensure DB updates have propagated
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['assets'] })
        }, 500)
        
      } else {
        console.warn(`[UploadZone] ⚠️ Unexpected response format:`, data)
        // Still refresh UI to be safe
        queryClient.invalidateQueries({ queryKey: ['assets'] })
      }
    } catch (error) {
      console.error('[UploadZone] ❌ Exception in triggerBatchTagging:', error)
      console.error('[UploadZone] Exception details:', error instanceof Error ? error.message : String(error))
      console.error('[UploadZone] Stack trace:', error instanceof Error ? error.stack : 'N/A')
      // Don't throw - uploads succeeded, tagging can retry later
    }
  }, [supabase, queryClient, onBatchTaggingStart])

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

      // Reset batch tagging trigger flag and completion tracker for this upload session
      batchTaggingTriggeredRef.current = false
      uploadedAssetsRef.current = []
      const totalFiles = filesToUpload.length
      completionTrackerRef.current = { count: 0, total: totalFiles }
      
      console.log(`[UploadZone] Initialized completion tracker: ${completionTrackerRef.current.count}/${completionTrackerRef.current.total}`)
      
      // Helper to check if all uploads are done and trigger batch tagging
      const checkAndTriggerBatchTagging = async () => {
        completionTrackerRef.current.count++
        const currentCount = completionTrackerRef.current.count
        const total = completionTrackerRef.current.total
        console.log(`[UploadZone] Upload completed: ${currentCount}/${total}`)
        console.log(`[UploadZone] Assets collected so far: ${uploadedAssetsRef.current.length}`)
        console.log(`[UploadZone] Completion tracker state:`, { ...completionTrackerRef.current })
        
        if (currentCount === total && !batchTaggingTriggeredRef.current) {
          batchTaggingTriggeredRef.current = true // Prevent double-triggering
          
          const assetsToTag = [...uploadedAssetsRef.current] // Copy ref array
          console.log(`[UploadZone] ✅ All ${total} uploads complete!`)
          console.log(`[UploadZone] Collected ${assetsToTag.length} assets for batch tagging`)
          console.log(`[UploadZone] Asset IDs:`, assetsToTag.map(a => a.id))
          
          if (assetsToTag.length > 0) {
            // Wait for DB replication (especially important for multiple assets)
            const delay = assetsToTag.length > 1 ? Math.min(2000 + (assetsToTag.length * 200), 5000) : 500
            console.log(`[UploadZone] Waiting ${delay}ms before batch tagging (${assetsToTag.length} assets)...`)
            
            setTimeout(async () => {
              console.log(`[UploadZone] ✅ Triggering batch tagging for ${assetsToTag.length} successful uploads`)
              console.log(`[UploadZone] Asset IDs to tag:`, assetsToTag.map(a => a.id))
              
              try {
                await triggerBatchTagging(assetsToTag)
                console.log(`[UploadZone] ✅ Batch tagging call completed`)
              } catch (error) {
                console.error('[UploadZone] ❌ Batch tagging failed:', error)
                console.error('[UploadZone] Error stack:', error instanceof Error ? error.stack : 'N/A')
              }
              
              // Close dialog AFTER batch tagging is triggered
              console.log(`[UploadZone] ✅ Auto-closing dialog after batch tagging triggered`)
              onOpenChange(false)
            }, delay)
          } else {
            console.warn(`[UploadZone] ⚠️  No assets collected for batch tagging!`)
            // Close dialog even if no assets to tag
            setTimeout(() => {
              console.log(`[UploadZone] ✅ Auto-closing dialog (no assets to tag)`)
              onOpenChange(false)
            }, 500)
          }
        } else if (currentCount < total) {
          console.log(`[UploadZone] Still waiting for ${total - currentCount} more upload(s)...`)
        } else if (batchTaggingTriggeredRef.current) {
          console.log(`[UploadZone] ⚠️  Batch tagging already triggered, skipping`)
        }
      }

      // Start all uploads (following mobile app pattern - sequential collection)
      console.log(`[UploadZone] Starting ${filesToUpload.length} uploads...`)
      filesToUpload.forEach((file, index) => {
        console.log(`[UploadZone] Starting upload ${index + 1}/${filesToUpload.length}: ${file.name}`)
        const progress: UploadProgress = {
          file,
          progress: 0,
          status: 'pending',
        }
        setUploadQueue((prev) => [...prev, progress])

        // Use mutateAsync to ensure each mutation completes independently
        uploadMutation.mutateAsync(
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
          }
        )
        .then((asset) => {
          console.log(`[UploadZone] ✅ Upload success for ${file.name}:`, { assetId: asset?.id, hasPublicUrl: !!asset?.publicUrl })
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.file === file
                ? { ...item, status: 'success' as const, asset }
                : item
            )
          )
          
          // Collect uploaded asset for batch tagging (mobile app pattern) - use ref for stable reference
          if (asset?.id && asset?.publicUrl) {
            uploadedAssetsRef.current.push({ id: asset.id, publicUrl: asset.publicUrl! })
            console.log(`[UploadZone] ✅ Collected asset ${asset.id} for batch tagging. Total: ${uploadedAssetsRef.current.length}`)
            console.log(`[UploadZone] Current ref contents:`, uploadedAssetsRef.current.map(a => ({ id: a.id, url: a.publicUrl.substring(0, 50) + '...' })))
          } else {
            console.warn(`[UploadZone] ⚠️  Asset missing id or publicUrl:`, asset)
          }
          
          onUploadComplete?.(asset.id)
          
          // Remove from queue after 1.5 seconds
          setTimeout(() => {
            setUploadQueue((prev) => prev.filter((item) => item.file !== file))
          }, 1500)
          
          // Check if all uploads are done
          checkAndTriggerBatchTagging()
        })
        .catch((error: Error | unknown) => {
          console.error(`[UploadZone] ❌ Upload error for ${file.name}:`, error)
          // Provide more user-friendly error messages
          const errorMessage = error instanceof Error ? error.message : String(error)
          let friendlyMessage = errorMessage || 'Upload failed'
          
          if (errorMessage && errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
            friendlyMessage = 'File already exists'
          } else if (errorMessage && errorMessage.includes('size') || errorMessage.includes('too large')) {
            friendlyMessage = 'File is too large'
          } else if (errorMessage && errorMessage.includes('format') || errorMessage.includes('type')) {
            friendlyMessage = 'Unsupported file format'
          } else if (errorMessage && errorMessage.includes('network') || errorMessage.includes('fetch')) {
            friendlyMessage = 'Network error - please check your connection'
          } else if (errorMessage && errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
            friendlyMessage = 'Permission denied - please sign in again'
          } else if (errorMessage && errorMessage.includes('Not authenticated')) {
            friendlyMessage = 'Session expired - please sign in again'
          }
          
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.file === file
                ? { ...item, status: 'error' as const, error: friendlyMessage }
                : item
            )
          )
          
          // Still check completion even on error
          checkAndTriggerBatchTagging()
        })
      })
      
      // Fallback: Monitor upload queue state to detect completion
      // This ensures we trigger batch tagging even if some callbacks don't fire
      let queueCheckInterval: ReturnType<typeof setInterval> | null = null
      const startQueueMonitoring = () => {
        queueCheckInterval = setInterval(() => {
          // Use a callback to read current queue state without modifying it
          setUploadQueue((currentQueue) => {
            const completedCount = currentQueue.filter(item => 
              item.status === 'success' || item.status === 'error'
            ).length
            
            if (completedCount === totalFiles && !batchTaggingTriggeredRef.current) {
              console.log(`[UploadZone] 🔄 Fallback: All ${totalFiles} uploads complete (detected via queue state)`)
              console.log(`[UploadZone] Queue state:`, currentQueue.map(item => ({ 
                file: item.file.name, 
                status: item.status,
                hasAsset: !!item.asset 
              })))
              
              // Collect assets from queue state (fallback)
              const assetsFromQueue = currentQueue
                .filter(item => item.status === 'success' && item.asset?.id && item.asset?.publicUrl)
                .map(item => ({ id: item.asset!.id, publicUrl: item.asset!.publicUrl! }))
              
              if (assetsFromQueue.length > 0) {
                console.log(`[UploadZone] 🔄 Fallback: Found ${assetsFromQueue.length} assets in queue state`)
                // Merge with existing ref (avoid duplicates)
                assetsFromQueue.forEach(asset => {
                  if (!uploadedAssetsRef.current.find(a => a.id === asset.id)) {
                    uploadedAssetsRef.current.push(asset)
                  }
                })
                console.log(`[UploadZone] 🔄 Fallback: Total assets after merge: ${uploadedAssetsRef.current.length}`)
              }
              
              // Trigger batch tagging via completion tracker
              if (completionTrackerRef.current.count < completedCount) {
                completionTrackerRef.current.count = completedCount
                checkAndTriggerBatchTagging()
              }
              
              // Clear interval
              if (queueCheckInterval) {
                clearInterval(queueCheckInterval)
                queueCheckInterval = null
              }
            }
            
            return currentQueue // Don't modify queue, just read it
          })
        }, 1000) // Check every second
      }
      
      startQueueMonitoring()
      
      // Clear interval after 60 seconds (safety timeout)
      setTimeout(() => {
        if (queueCheckInterval) {
          clearInterval(queueCheckInterval)
          queueCheckInterval = null
          console.log(`[UploadZone] ⚠️  Queue state monitor timeout after 60s`)
        }
      }, 60000)
      
      // NOTE: Dialog will close in checkAndTriggerBatchTagging after all uploads complete
      // Do NOT close here - wait for all uploads to finish
    },
    [uploadMutation, onUploadComplete, onOpenChange, duplicateIndices, triggerBatchTagging]
  )

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      // Check upload access before proceeding (requires active subscription)
      const canProceed = await withUploadAccess(async () => {
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
            // Use reactive workspace ID from hook

            // Check for duplicates (scope to workspace if available)
            const duplicateIndicesResult = await checkForDuplicates(
              user.id,
              validHashes,
              activeWorkspaceId || undefined
            )

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
      })

      // If write access was denied, the trial modal will be shown
      if (!canProceed) {
        console.log('[UploadZone] Write access denied - trial modal shown')
      }
    },
    [processFiles, withUploadAccess, activeWorkspaceId]
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

  // Retry a failed upload
  const retryUpload = useCallback((file: File) => {
    // Remove the failed item from queue
    setUploadQueue((prev) => prev.filter((item) => item.file !== file))
    
    // Re-add to queue and process
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
          // Collect uploaded asset for batch tagging
          if (asset?.id && asset?.publicUrl) {
            const newAsset = { id: asset.id, publicUrl: asset.publicUrl! }
            setUploadedAssets((prev) => {
              const updated = [...prev, newAsset]
              uploadedAssetsRef.current = updated // Keep ref in sync
              console.log(`[UploadZone] Collected asset ${asset.id} for batch tagging. Total collected: ${updated.length}`)
              return updated
            })
            onUploadComplete?.(asset.id)
          }
          // Remove from queue after 1.5 seconds
          setTimeout(() => {
            setUploadQueue((prev) => {
              const updated = prev.filter((item) => item.file !== file)
              
              console.log(`[UploadZone] File ${file.name} removed from queue. Queue length: ${updated.length} (was ${prev.length})`)
              
              // If queue is now empty, all uploads are done - trigger batch tagging
              if (updated.length === 0) {
                console.log(`[UploadZone] ✅ Queue is empty! All uploads complete. Will trigger batch tagging...`)
                
                // CRITICAL: Wait longer for DB replication when multiple assets uploaded
                const assetCount = uploadedAssetsRef.current.length
                const delay = assetCount > 1 ? Math.min(2000 + (assetCount * 200), 5000) : 500
                console.log(`[UploadZone] Waiting ${delay}ms before batch tagging (${assetCount} assets)...`)
                
                setTimeout(() => {
                  // Use ref to get current assets (more reliable than state callback)
                  const assetsToTag = [...uploadedAssetsRef.current]
                  console.log(`[UploadZone] Batch tagging callback - collected assets: ${assetsToTag.length}`)
                  
                  if (assetsToTag.length === 0) {
                    console.warn(`[UploadZone] ⚠️  No assets collected for batch tagging!`)
                    setTimeout(() => onOpenChange(false), 300)
                    return
                  }
                  
                  // Clear state and ref BEFORE triggering
                  setUploadedAssets([])
                  uploadedAssetsRef.current = []
                  
                  // Trigger batch tagging with the copied assets
                  console.log(`[UploadZone] ✅ Triggering batch tagging for ${assetsToTag.length} successful uploads`)
                  triggerBatchTagging(assetsToTag).catch((error) => {
                    console.error('[UploadZone] ❌ Batch tagging failed:', error)
                    setTimeout(() => onOpenChange(false), 300)
                  })
                  
                  // Auto-close dialog
                  setTimeout(() => onOpenChange(false), 300)
                }, delay)
              }
              
              return updated
            })
          }, 1500)
        },
        onError: (error: Error) => {
          // Provide more user-friendly error messages
          let friendlyMessage = error.message
          if (error.message.includes('duplicate') || error.message.includes('already exists')) {
            friendlyMessage = 'File already exists'
          } else if (error.message.includes('size') || error.message.includes('too large')) {
            friendlyMessage = 'File is too large'
          } else if (error.message.includes('format') || error.message.includes('type')) {
            friendlyMessage = 'Unsupported file format'
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            friendlyMessage = 'Network error - please check your connection'
          } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
            friendlyMessage = 'Permission denied - please sign in again'
          } else if (error.message.includes('Not authenticated')) {
            friendlyMessage = 'Session expired - please sign in again'
          }
          
          setUploadQueue((prev) => {
            const updated = prev.map((item) =>
              item.file === file
                ? { ...item, status: 'error' as const, error: friendlyMessage }
                : item
            )
            
            // Check if all uploads are complete (all are success or error, none pending/uploading)
            // This ensures batch tagging triggers even if the last upload fails
            const allComplete = updated.length > 0 && updated.every(item => item.status === 'success' || item.status === 'error')
            
            if (allComplete) {
              // All uploads complete (some may have failed), trigger batch tagging for successful ones only
              setTimeout(() => {
                // Use ref to get current assets (more reliable than state callback)
                const assetsToTag = [...uploadedAssetsRef.current]
                
                // Clear state and ref
                setUploadedAssets([])
                uploadedAssetsRef.current = []
                
                if (assetsToTag.length > 0) {
                  const failedCount = updated.filter(item => item.status === 'error').length
                  console.log(`[UploadZone] ✅ Triggering batch tagging for ${assetsToTag.length} successful uploads (${failedCount} failed)`)
                  triggerBatchTagging(assetsToTag).catch((error) => {
                    console.error('[UploadZone] ❌ Batch tagging failed:', error)
                  })
                } else {
                  console.warn(`[UploadZone] ⚠️  No assets collected for batch tagging (all failed?)`)
                }
                
                // Auto-close dialog after batch tagging is triggered
                setTimeout(() => {
                  console.log(`[UploadZone] ✅ Auto-closing dialog after all uploads complete (with errors)`)
                  onOpenChange(false)
                }, 500)
              }, 500)
            }
            
            return updated
          })
        },
      }
    )
  }, [uploadMutation, onUploadComplete, onOpenChange, triggerBatchTagging])

  // Retry all failed uploads
  const retryAllFailed = useCallback(() => {
    const failedItems = uploadQueue.filter(item => item.status === 'error')
    failedItems.forEach(item => {
      retryUpload(item.file)
    })
  }, [uploadQueue, retryUpload])

  const handleClose = (open: boolean) => {
    if (!open) {
      // Only allow closing if no uploads are in progress
      const hasActiveUploads = uploadQueue.some(item => item.status === 'uploading' || item.status === 'pending')
      if (hasActiveUploads) {
        console.log('[UploadZone] ⚠️ Cannot close dialog - uploads in progress')
        return // Prevent closing if uploads are active
      }
      
      // Clear all state when closing
      console.log('[UploadZone] Closing dialog - clearing upload state')
      setUploadQueue([])
      setUploadedAssets([])
      uploadedAssetsRef.current = []
      batchTaggingTriggeredRef.current = false
      completionTrackerRef.current = { count: 0, total: 0 }
      setPendingFiles([])
      setDuplicateIndices([])
      setFileHashes([])
    }
    onOpenChange(open)
  }

  const handleImportAll = async () => {
    setShowDuplicateDialog(false)
    // Write access was already checked in onDrop before showing duplicate dialog
    await processFiles(pendingFiles, false)
    setPendingFiles([])
    setDuplicateIndices([])
    setFileHashes([])
  }

  const handleSkipDuplicates = async () => {
    setShowDuplicateDialog(false)
    // Write access was already checked in onDrop before showing duplicate dialog
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
            <div className="mt-4">
              {/* Summary and retry all button */}
              {uploadQueue.some(item => item.status === 'error') && (
                <div className="mb-3 flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-red-900">
                      {uploadQueue.filter(item => item.status === 'error').length} upload{uploadQueue.filter(item => item.status === 'error').length !== 1 ? 's' : ''} failed
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryAllFailed}
                    className="h-7 px-3 text-xs font-medium border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <RotateCcw className="mr-1.5 h-3 w-3" />
                    Retry All
                  </Button>
                </div>
              )}
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uploadQueue.map((item) => (
                  <div
                    key={item.file.name}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                      item.status === 'error'
                        ? 'border-red-200 bg-red-50/50'
                        : item.status === 'success'
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-gray-200 bg-white hover:shadow-sm'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        item.status === 'error'
                          ? 'bg-red-100'
                          : item.status === 'success'
                          ? 'bg-green-100'
                          : 'bg-gray-100'
                      }`}>
                        {item.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : item.status === 'error' ? (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        item.status === 'error' ? 'text-red-900' : 'text-gray-900'
                      }`}>
                        {item.file.name}
                      </p>
                      {item.status === 'uploading' && (
                        <div className="mt-1.5 space-y-1">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full bg-accent transition-all duration-300 ease-out"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500">{item.progress}%</p>
                        </div>
                      )}
                      {item.status === 'pending' && (
                        <p className="mt-1 text-xs text-gray-500">Waiting to upload...</p>
                      )}
                      {item.status === 'processing' && (
                        <p className="mt-1 text-xs text-gray-500">Processing image...</p>
                      )}
                      {item.status === 'error' && item.error && (
                        <p className="mt-1 text-xs font-medium text-red-700">{item.error}</p>
                      )}
                      {item.status === 'success' && (
                        <p className="mt-1 text-xs text-green-700">Upload complete</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.status === 'error' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            retryUpload(item.file)
                          }}
                          className="h-7 px-2 text-xs font-medium text-red-700 hover:bg-red-100 hover:text-red-900"
                          title="Retry upload"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Retry
                        </Button>
                      )}
                      {(item.status === 'pending' || item.status === 'error') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFromQueue(item.file)
                          }}
                          className="h-7 w-7 p-0 hover:bg-gray-100 text-gray-500"
                          title="Remove from queue"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
