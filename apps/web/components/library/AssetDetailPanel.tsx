'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
import { X, Trash2, Plus, MapPin, Sparkles, Edit2, Calendar, FileText, Loader2, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
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
  onNavigatePrevious?: () => void // Navigate to previous asset
  onNavigateNext?: () => void // Navigate to next asset
  canNavigatePrevious?: boolean // Whether previous navigation is available
  canNavigateNext?: boolean // Whether next navigation is available
  currentIndex?: number // Current asset index (0-based)
  totalCount?: number // Total number of assets
}

export function AssetDetailPanel({ 
  asset, 
  open, 
  onClose, 
  onRetagStart,
  retaggingAssetIds = new Set(),
  completedRetaggingAssetIds = new Set(),
  onNavigatePrevious,
  onNavigateNext,
  canNavigatePrevious = false,
  canNavigateNext = false,
  currentIndex,
  totalCount,
}: AssetDetailPanelProps) {
  const [tags, setTags] = useState<string[]>(asset.tags || [])
  const [newTag, setNewTag] = useState('')
  const [location, setLocation] = useState(asset.location || '')
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isRetagging, setIsRetagging] = useState(false)
  const [retagStatus, setRetagStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [localAvailableTags, setLocalAvailableTags] = useState<string[]>([])
  const lastAssetIdRef = useRef<string | null>(null)

  const { data: availableTags } = useAvailableTags()
  
  // Merge server tags with locally added tags
  const allAvailableTags = useMemo(() => {
    const serverTags = availableTags || []
    const merged = [...new Set([...serverTags, ...localAvailableTags])].sort()
    return merged
  }, [availableTags, localAvailableTags])
  const updateTagsMutation = useUpdateAssetTags()
  const updateLocationMutation = useUpdateAssetLocation()
  const deleteAssetMutation = useDeleteAsset()
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      // Only reset tags if this is a different asset OR if mutation is not in progress
      // This prevents race conditions where useEffect resets tags after a successful mutation
      const isDifferentAsset = lastAssetIdRef.current !== asset.id
      if (isDifferentAsset || (!updateTagsMutation.isPending && isDifferentAsset)) {
        setTags(asset.tags || [])
        lastAssetIdRef.current = asset.id
      }
      setLocation(asset.location || '')
      setIsEditingLocation(false)
      setRetagStatus('idle')
      setNewTag('')
      setShowTagSuggestions(false)
      
      // Add any tags from this asset that aren't in available tags to both local list and query cache
      if (asset.tags && availableTags) {
        const newTags = asset.tags.filter(tag => !availableTags.includes(tag))
        if (newTags.length > 0) {
          setLocalAvailableTags((prev) => {
            const updated = [...prev, ...newTags]
            return [...new Set(updated)].sort()
          })
          
          // Update query cache to persist these tags
          queryClient.setQueryData(['availableTags'], (oldData: string[] | undefined) => {
            if (!oldData) return [...newTags].sort()
            const merged = [...oldData, ...newTags]
            return [...new Set(merged)].sort()
          })
        }
      }
    } else {
      // Reset ref when panel closes
      lastAssetIdRef.current = null
    }
  }, [asset.id, asset.tags, open, availableTags, queryClient, updateTagsMutation.isPending])

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

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'ArrowLeft' && canNavigatePrevious && onNavigatePrevious) {
        e.preventDefault()
        onNavigatePrevious()
      } else if (e.key === 'ArrowRight' && canNavigateNext && onNavigateNext) {
        e.preventDefault()
        onNavigateNext()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, canNavigatePrevious, canNavigateNext, onNavigatePrevious, onNavigateNext, onClose])

  const handleAddTag = (tagToAdd?: string) => {
    // Use provided tag or current input value
    const tagToUse = tagToAdd || newTag.trim()
    const trimmedTag = tagToUse.trim()
    
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const updatedTags = [...tags, trimmedTag]
      setTags(updatedTags)
      updateTagsMutation.mutate({
        assetId: asset.id,
        tags: updatedTags,
      })
      
      // If this tag doesn't exist in available tags, add it to local list and update query cache
      if (!allAvailableTags.includes(trimmedTag)) {
        setLocalAvailableTags((prev) => {
          const updated = [...prev, trimmedTag]
          return [...new Set(updated)].sort()
        })
        
        // Update the query cache to persist the new tag
        queryClient.setQueryData(['availableTags'], (oldData: string[] | undefined) => {
          if (!oldData) return [trimmedTag]
          if (oldData.includes(trimmedTag)) return oldData
          return [...oldData, trimmedTag].sort()
        })
        
        // Also invalidate to refetch from server (ensures persistence across sessions)
        queryClient.invalidateQueries({ queryKey: ['availableTags'] })
        // Invalidate tags query so Tag Management page shows the new tag
        queryClient.invalidateQueries({ queryKey: ['tags'] })
      }
      
      setNewTag('')
      setShowTagSuggestions(false)
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    console.log('[AssetDetailPanel] Removing tag:', tagToRemove)
    console.log('[AssetDetailPanel] Current tags:', tags)
    
    // Use exact match (case-sensitive) to remove the tag
    const updatedTags = tags.filter((tag) => tag !== tagToRemove)
    console.log('[AssetDetailPanel] Updated tags:', updatedTags)
    
    if (updatedTags.length === tags.length) {
      console.warn('[AssetDetailPanel] Tag not found in list:', tagToRemove, 'Available tags:', tags)
      return
    }
    
    setTags(updatedTags)
    updateTagsMutation.mutate(
      {
        assetId: asset.id,
        tags: updatedTags,
      },
      {
        onSuccess: (data) => {
          console.log('[AssetDetailPanel] Tag removal successful:', data)
          // Update local state with the response from server to ensure consistency
          if (data?.tags) {
            setTags(data.tags)
          }
          // Invalidate queries to update Tag Management usage counts
          queryClient.invalidateQueries({ queryKey: ['tags'] })
          queryClient.invalidateQueries({ queryKey: ['availableTags'] })
          queryClient.invalidateQueries({ queryKey: ['assets'] })
          queryClient.invalidateQueries({ queryKey: ['asset', asset.id] })
        },
        onError: (error) => {
          console.error('[AssetDetailPanel] Tag removal failed:', error)
          // Revert to original tags on error
          setTags(asset.tags || [])
        },
      }
    )
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
        <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 shadow-sm group">
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

        {/* Tags Section - Airbnb-inspired design */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Tags</h3>
            {tags.length > 0 && (
              <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                {tags.length}
              </span>
            )}
          </div>
          
          {/* Existing Tags - Elegant, spacious design */}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all duration-150"
                >
                  <span className="text-sm font-medium text-gray-700">{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors duration-150"
                    aria-label={`Remove ${tag}`}
                    title="Remove tag"
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center">
              <p className="text-sm text-gray-400">No tags yet. Add tags to organize your assets.</p>
            </div>
          )}

          {/* Add Tag Input - Premium autocomplete experience */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => {
                    setNewTag(e.target.value)
                    setShowTagSuggestions(true)
                  }}
                  onFocus={() => {
                    // Show all available tags when input is focused
                    if (allAvailableTags && allAvailableTags.filter((tag: string) => !tags.includes(tag)).length > 0) {
                      setShowTagSuggestions(true)
                    }
                  }}
                  onBlur={() => {
                    // Delay closing to allow clicks on suggestions
                    setTimeout(() => setShowTagSuggestions(false), 200)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    } else if (e.key === 'Escape') {
                      setNewTag('')
                      setShowTagSuggestions(false)
                    }
                  }}
                  className="h-10 text-sm border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400/20 pr-10 transition-all"
                />
                {/* Tag suggestions indicator - show when there are available tags */}
                {allAvailableTags && allAvailableTags.filter((tag: string) => !tags.includes(tag)).length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showTagSuggestions ? 'rotate-180' : ''}`} />
                  </div>
                )}
              </div>
              <Button 
                onClick={() => handleAddTag()} 
                size="sm"
                className="h-10 px-4 shrink-0 font-medium"
                disabled={!newTag.trim()}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add
              </Button>
            </div>
            
            {/* Tag suggestions dropdown - Show all available tags when focused, filter when typing */}
            {showTagSuggestions && allAvailableTags && allAvailableTags.filter((tag: string) => !tags.includes(tag)).length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <div className="py-1 max-h-48 overflow-y-auto">
                  {allAvailableTags
                    .filter((tag: string) => {
                      // Filter out already added tags
                      if (tags.includes(tag)) return false
                      // If user is typing, filter by match; otherwise show all
                      if (newTag.trim()) {
                        return tag.toLowerCase().includes(newTag.toLowerCase())
                      }
                      return true
                    })
                    .slice(0, 12) // Show more tags when showing full list
                    .map((tag: string) => (
                      <button
                        key={tag}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          // Directly add the tag without setting input first
                          handleAddTag(tag)
                        }}
                        onMouseDown={(e) => {
                          // Prevent blur from closing dropdown before click
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-100 flex items-center gap-2 cursor-pointer"
                      >
                        <span className="flex-1">{tag}</span>
                        <Plus className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    ))}
                  {allAvailableTags.filter((tag: string) => !tags.includes(tag) && (!newTag.trim() || tag.toLowerCase().includes(newTag.toLowerCase()))).length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      {newTag.trim() ? 'No matching tags' : 'No tags available'}
                    </div>
                  )}
                </div>
              </div>
            )}
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
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-semibold mb-3">Asset Details</DialogTitle>
              {/* Navigation controls - Simple, clean design */}
              {(canNavigatePrevious || canNavigateNext) && (
                <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-100">
                  {canNavigatePrevious && onNavigatePrevious ? (
                    <button
                      onClick={onNavigatePrevious}
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 hover:text-gray-900"
                      aria-label="Previous asset"
                      title="Previous asset (←)"
                    >
                      <ChevronLeft className="h-5 w-5" strokeWidth={2} />
                    </button>
                  ) : (
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 opacity-40">
                      <ChevronLeft className="h-5 w-5 text-gray-400" strokeWidth={2} />
                    </div>
                  )}
                  
                  {/* Asset counter */}
                  {currentIndex !== undefined && totalCount !== undefined && (
                    <span className="text-sm font-medium text-gray-600 min-w-[3rem] text-center">
                      {currentIndex + 1} / {totalCount}
                    </span>
                  )}
                  
                  {canNavigateNext && onNavigateNext ? (
                    <button
                      onClick={onNavigateNext}
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 hover:text-gray-900"
                      aria-label="Next asset"
                      title="Next asset (→)"
                    >
                      <ChevronRight className="h-5 w-5" strokeWidth={2} />
                    </button>
                  ) : (
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 opacity-40">
                      <ChevronRight className="h-5 w-5 text-gray-400" strokeWidth={2} />
                    </div>
                  )}
                </div>
              )}
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
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg font-semibold mb-3">Asset Details</SheetTitle>
            {/* Navigation controls - Simple, clean design */}
            {(canNavigatePrevious || canNavigateNext) && (
              <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-100">
                {canNavigatePrevious && onNavigatePrevious ? (
                  <button
                    onClick={onNavigatePrevious}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 hover:text-gray-900"
                    aria-label="Previous asset"
                    title="Previous asset (←)"
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={2} />
                  </button>
                ) : (
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 opacity-40">
                    <ChevronLeft className="h-5 w-5 text-gray-400" strokeWidth={2} />
                  </div>
                )}
                
                {/* Asset counter */}
                {currentIndex !== undefined && totalCount !== undefined && (
                  <span className="text-sm font-medium text-gray-600 min-w-[3rem] text-center">
                    {currentIndex + 1} / {totalCount}
                  </span>
                )}
                
                {canNavigateNext && onNavigateNext ? (
                  <button
                    onClick={onNavigateNext}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 hover:text-gray-900"
                    aria-label="Next asset"
                    title="Next asset (→)"
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={2} />
                  </button>
                ) : (
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 opacity-40">
                    <ChevronRight className="h-5 w-5 text-gray-400" strokeWidth={2} />
                  </div>
                )}
              </div>
            )}
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
