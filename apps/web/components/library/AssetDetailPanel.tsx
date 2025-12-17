'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Asset } from '@/types'
import { useUpdateAssetTags } from '@/hooks/useUpdateAssetTags'
import { useUpdateAssetLocation } from '@/hooks/useUpdateAssetLocation'
import { useDeleteAsset } from '@/hooks/useDeleteAsset'
import { useAvailableTags } from '@/hooks/useAvailableTags'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Trash2, Plus, MapPin, Sparkles, Edit2, Calendar, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import dayjs from 'dayjs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface AssetDetailPanelProps {
  asset: Asset
  open: boolean
  onClose: () => void
  onRetagStart?: (assetId: string) => void // Callback to notify parent when retagging starts
  retaggingAssetIds?: Set<string> // Assets currently being retagged (from parent)
  completedRetaggingAssetIds?: Set<string> // Assets that just completed retagging (from parent)
}

export function AssetDetailPanel({ 
  asset, 
  open, 
  onClose, 
  onRetagStart,
  retaggingAssetIds = new Set(),
  completedRetaggingAssetIds = new Set(),
}: AssetDetailPanelProps) {
  const [tags, setTags] = useState<string[]>(asset.tags || [])
  const [newTag, setNewTag] = useState('')
  const [location, setLocation] = useState(asset.location || '')
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isRetagging, setIsRetagging] = useState(false)
  const [retagStatus, setRetagStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')

  const { data: availableTags } = useAvailableTags()
  const updateTagsMutation = useUpdateAssetTags()
  const updateLocationMutation = useUpdateAssetLocation()
  const deleteAssetMutation = useDeleteAsset()
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      setTags(asset.tags || [])
      setLocation(asset.location || '')
      setIsEditingLocation(false)
      setRetagStatus('idle')
    }
  }, [asset, open])

  // Update tags when asset completes retagging (parent polling handles status updates)
  useEffect(() => {
    if (!open) return
    
    // When asset completes retagging, update tags
    const isAssetCompleted = completedRetaggingAssetIds.has(asset.id)
    if (isAssetCompleted && asset.tags) {
      setTags(asset.tags)
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', asset.id] })
    }
  }, [open, completedRetaggingAssetIds, asset.tags, asset.id, queryClient])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleAddTag = () => {
    const trimmedTag = newTag.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const updatedTags = [...tags, trimmedTag]
      setTags(updatedTags)
      updateTagsMutation.mutate({
        assetId: asset.id,
        tags: updatedTags,
      })
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter((tag) => tag !== tagToRemove)
    setTags(updatedTags)
    updateTagsMutation.mutate({
      assetId: asset.id,
      tags: updatedTags,
    })
  }

  const handleUpdateLocation = () => {
    updateLocationMutation.mutate(
      {
        assetId: asset.id,
        location: location.trim() || null,
      },
      {
        onSuccess: () => {
          setIsEditingLocation(false)
        },
      }
    )
  }

  const handleRetag = async () => {
    if (!asset.publicUrl) {
      console.error('[AssetDetailPanel] No public URL available for asset')
      alert('Error: No image URL available for retagging')
      return
    }

    setIsRetagging(true)
    try {
      console.log('[AssetDetailPanel] Starting retag for asset:', asset.id)
      
      // Set status to pending first
      const { error: updateError } = await supabase
        .from('assets')
        .update({ auto_tag_status: 'pending' })
        .eq('id', asset.id)

      if (updateError) {
        console.error('[AssetDetailPanel] Failed to set pending status:', updateError)
        throw new Error(`Failed to update status: ${updateError.message}`)
      }

      console.log('[AssetDetailPanel] Status set to pending, calling edge function...')

      // Get session to verify authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      console.log('[AssetDetailPanel] Invoking auto_tag_asset:', {
        assetId: asset.id,
        imageUrl: asset.publicUrl?.substring(0, 100),
      })

      // Use Supabase client's built-in function invocation
      // This handles CORS and authentication automatically
      const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
        body: {
          assetId: asset.id,
          imageUrl: asset.publicUrl,
        },
      })

      if (error) {
        console.error('[AssetDetailPanel] Edge function error:', error)
        
        // Provide more helpful error messages
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          throw new Error(
            `Network error: Unable to reach edge function. ` +
            `Please verify:\n` +
            `1. The edge function "auto_tag_asset" is deployed in your Supabase project\n` +
            `2. Your Supabase project URL is correct: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n` +
            `3. Check Supabase Dashboard → Edge Functions to confirm deployment`
          )
        }
        
        throw new Error(`Edge function failed: ${error.message || JSON.stringify(error)}`)
      }

      console.log('[AssetDetailPanel] Edge function response:', data)

      // Notify parent to track this asset (same as bulk retagging)
      onRetagStart?.(asset.id)

      // Set pending state - polling will handle completion
      setIsRetagging(false)
      setRetagStatus('pending')
      
      // Polling useEffect will handle status updates and query invalidation
    } catch (error) {
      console.error('[AssetDetailPanel] Failed to retag asset:', error)
      setIsRetagging(false)
      setRetagStatus('error')
    }
  }

  const handleDelete = () => {
    deleteAssetMutation.mutate(asset.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        onClose()
      },
    })
  }

  const imageUrl = asset.previewUrl || asset.publicUrl || ''
  // Use original_filename if available, otherwise fall back to storage_path filename
  const filename = asset.original_filename || asset.storage_path?.split('/').pop() || 'Unknown'
  const dateToDisplay = asset.date_taken || asset.created_at
  
  // Use same logic as AssetTile: check both database status AND tracked retagging state
  const isAssetRetagging = retaggingAssetIds.has(asset.id) || asset.auto_tag_status === 'pending' || retagStatus === 'pending'
  const isAssetCompleted = completedRetaggingAssetIds.has(asset.id)
  const isAutoTaggingPending = isAssetRetagging

  const content = (
    <div className="space-y-6">
      {/* Hero Image - Takes prominent space */}
      {imageUrl && (
        <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 shadow-sm">
          <Image
            src={imageUrl}
            alt={asset.tags[0] || 'Asset'}
            fill
            className="object-contain p-2 z-0"
            sizes="(max-width: 768px) 100vw, 420px"
            priority
            unoptimized
          />
          
          {/* Success Indicator - shows briefly after tagging completes (matches AssetTile) */}
          {isAssetCompleted && !isAssetRetagging && (
            <div className="absolute inset-0 z-10 bg-green-50/80 flex items-center justify-center backdrop-blur-[2px]">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 text-green-700 text-[10px] font-medium rounded-md shadow-card">
                <CheckCircle2 className="h-3 w-3" />
                <span>Tagged</span>
              </div>
            </div>
          )}
          
          {/* Tagging Status Indicator - matches AssetTile styling */}
          {isAssetRetagging && (
            <div className="absolute inset-0 z-10 bg-accent/10 flex items-center justify-center backdrop-blur-[2px]">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-accent/20 text-accent text-[10px] font-medium rounded-md shadow-card">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Tagging...</span>
              </div>
            </div>
          )}
          
          {/* Error Overlay - shows when tagging fails */}
          {!isAssetRetagging && !isAssetCompleted && (asset.auto_tag_status === 'failed' || retagStatus === 'error') && (
            <div className="absolute inset-0 z-10 bg-red-50/80 flex items-center justify-center backdrop-blur-[2px]">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-700 text-[10px] font-medium rounded-md shadow-card">
                <AlertCircle className="h-3 w-3" />
                <span>Tagging failed</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="space-y-6">
        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetag}
            disabled={isRetagging || isAssetRetagging}
            className="flex-1 h-9 text-xs font-medium"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Rerun AI Tagging
          </Button>
        </div>

        {/* Tags Section - Most Important, Prominent */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Tags</h3>
            {tags.length > 0 && (
              <span className="text-xs text-gray-500">{tags.length}</span>
            )}
          </div>
          
          {/* Existing Tags */}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="group gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-900 border border-amber-200/50 hover:from-amber-100 hover:to-amber-150 hover:border-amber-300/50 transition-all"
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="opacity-0 group-hover:opacity-100 hover:bg-amber-200/50 rounded-md p-0.5 transition-all"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic py-2">No tags yet</p>
          )}

          {/* Add Tag Input */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Add tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              list="available-tags"
              className="flex-1 h-9 text-sm border-gray-200 focus:border-accent focus:ring-accent/20"
            />
            <datalist id="available-tags">
              {availableTags
                ?.filter((tag) => !tags.includes(tag))
                .map((tag) => (
                  <option key={tag} value={tag} />
                ))}
            </datalist>
            <Button 
              onClick={handleAddTag} 
              size="icon" 
              className="h-9 w-9 shrink-0"
              disabled={!newTag.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Metadata Section - Grouped, Subtle */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Details
          </h3>

          {/* Location - Editable, Prominent */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                Location
              </label>
              {!isEditingLocation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingLocation(true)}
                  className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>
            {isEditingLocation ? (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter location..."
                  className="flex-1 h-9 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateLocation()
                    } else if (e.key === 'Escape') {
                      setLocation(asset.location || '')
                      setIsEditingLocation(false)
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleUpdateLocation}
                  className="h-9 px-3"
                  disabled={updateLocationMutation.isPending}
                >
                  {updateLocationMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocation(asset.location || '')
                    setIsEditingLocation(false)
                  }}
                  className="h-9 px-3"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-900 font-medium">
                {location || <span className="text-gray-400 font-normal italic">No location set</span>}
              </p>
            )}
          </div>

          {/* Date Taken */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              Date Taken
            </label>
            <p className="text-sm text-gray-900 font-medium">
              {dayjs(dateToDisplay).format('MMMM D, YYYY [at] h:mm A')}
            </p>
          </div>

          {/* Filename - Less Prominent */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              Filename
            </label>
            <p className="text-sm text-gray-600 font-mono break-all">{filename}</p>
          </div>
        </div>

        {/* Destructive Action - Separated, Subtle */}
        <div className="pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteAssetMutation.isPending}
            className="h-9 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 border-red-200/50"
          >
            {deleteAssetMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Asset
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <>
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent className="max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-lg font-semibold">Asset Details</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                Delete this asset?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600 pt-1">
                This will permanently delete the asset and all associated files. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2 sm:gap-2 sm:justify-end">
              <AlertDialogCancel className="mt-0 sm:mt-0">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
                disabled={deleteAssetMutation.isPending}
              >
                {deleteAssetMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[420px] p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-lg font-semibold">Asset Details</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                Delete this asset?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600 pt-1">
                This will permanently delete the asset and all associated files. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2 sm:gap-2 sm:justify-end">
              <AlertDialogCancel className="mt-0 sm:mt-0">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
                disabled={deleteAssetMutation.isPending}
              >
                {deleteAssetMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
  )
}
