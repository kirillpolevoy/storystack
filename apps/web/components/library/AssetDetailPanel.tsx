'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Asset } from '@/types'
import { useUpdateAssetTags } from '@/hooks/useUpdateAssetTags'
import { useUpdateAssetLocation } from '@/hooks/useUpdateAssetLocation'
import { useDeleteAsset } from '@/hooks/useDeleteAsset'
import { useAvailableTags } from '@/hooks/useAvailableTags'
import { useAvailableLocations } from '@/hooks/useAvailableLocations'
import { useAssetDetail } from '@/hooks/useAssetDetail'
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
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [localAvailableTags, setLocalAvailableTags] = useState<string[]>([])
  const [imageError, setImageError] = useState(false)
  const [imageSrc, setImageSrc] = useState<string>('')
  const lastAssetIdRef = useRef<string | null>(null)

  const { data: availableTags } = useAvailableTags()
  const { data: availableLocations } = useAvailableLocations()
  
  // Fetch fresh asset data when panel is open - enables auto-refresh
  const { data: freshAssetData, refetch: refetchAsset } = useAssetDetail(asset.id)
  
  // Use fresh asset data if available, otherwise fall back to prop
  const currentAsset = useMemo(() => {
    return freshAssetData || asset
  }, [freshAssetData, asset])
  
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

  // Auto-refresh: Poll for asset updates when panel is open
  useEffect(() => {
    if (!open) return

    // Initial fetch
    refetchAsset()

    // Poll every 2 seconds for updates (tags, location, auto_tag_status, etc.)
    const pollInterval = setInterval(() => {
      refetchAsset()
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [open, asset.id, refetchAsset])

  useEffect(() => {
    if (open) {
      // Use currentAsset (which includes fresh data) instead of asset prop
      const assetToUse = currentAsset
      
      // Only reset tags if this is a different asset OR if mutation is not in progress
      // This prevents race conditions where useEffect resets tags after a successful mutation
      const isDifferentAsset = lastAssetIdRef.current !== assetToUse.id
      if (isDifferentAsset || (!updateTagsMutation.isPending && isDifferentAsset)) {
        setTags(assetToUse.tags || [])
        lastAssetIdRef.current = assetToUse.id
      }
      setLocation(assetToUse.location || '')
      setIsEditingLocation(false)
      setRetagStatus('idle')
      setNewTag('')
      setShowTagSuggestions(false)
      setShowLocationSuggestions(false)
      
      // Add any tags from this asset that aren't in available tags to both local list and query cache
      if (assetToUse.tags && availableTags) {
        const newTags = assetToUse.tags.filter(tag => !availableTags.includes(tag))
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
  }, [currentAsset.id, currentAsset.tags, currentAsset.location, open, availableTags, queryClient, updateTagsMutation.isPending])

  // Update tags when asset completes retagging (parent polling handles status updates)
  useEffect(() => {
    if (!open) return
    
    // When asset completes retagging, update tags from fresh data
    const isAssetCompleted = completedRetaggingAssetIds.has(currentAsset.id)
    if (isAssetCompleted && currentAsset.tags) {
      setTags(currentAsset.tags)
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', currentAsset.id] })
    }
  }, [open, completedRetaggingAssetIds, currentAsset.tags, currentAsset.id, queryClient])

  useEffect(() => {
    if (typeof window === 'undefined') return
    
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

    if (typeof window === 'undefined') return
    
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
        assetId: currentAsset.id,
        tags: updatedTags,
      }, {
        onSuccess: () => {
          // Refresh asset data after successful tag update
          refetchAsset()
        }
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
        assetId: currentAsset.id,
        tags: updatedTags,
      },
      {
        onSuccess: (data) => {
          console.log('[AssetDetailPanel] Tag removal successful:', data)
          // Update local state with the response from server to ensure consistency
          if (data?.tags) {
            setTags(data.tags)
          }
          // Refresh asset data after successful tag update
          refetchAsset()
          // Invalidate queries to update Tag Management usage counts
          queryClient.invalidateQueries({ queryKey: ['tags'] })
          queryClient.invalidateQueries({ queryKey: ['availableTags'] })
          queryClient.invalidateQueries({ queryKey: ['assets'] })
          queryClient.invalidateQueries({ queryKey: ['asset', currentAsset.id] })
        },
        onError: (error) => {
          console.error('[AssetDetailPanel] Tag removal failed:', error)
          // Revert to original tags on error
          setTags(currentAsset.tags || [])
        },
      }
    )
  }

  const handleUpdateLocation = () => {
    updateLocationMutation.mutate(
      {
        assetId: currentAsset.id,
        location: location.trim() || null,
      },
      {
        onSuccess: () => {
          setIsEditingLocation(false)
          // Refresh asset data after successful location update
          refetchAsset()
        },
      }
    )
  }

  const handleRetag = async () => {
    if (!currentAsset.publicUrl) {
      console.error('[AssetDetailPanel] No public URL available for asset')
      alert('Error: No image URL available for retagging')
      return
    }

    setIsRetagging(true)
    try {
      console.log('[AssetDetailPanel] Starting retag for asset:', currentAsset.id)
      
      // Set status to pending first
      const { error: updateError } = await supabase
        .from('assets')
        .update({ auto_tag_status: 'pending' })
        .eq('id', currentAsset.id)

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
        assetId: currentAsset.id,
        imageUrl: currentAsset.publicUrl?.substring(0, 100),
      })

      // Use Supabase client's built-in function invocation
      // This handles CORS and authentication automatically
      const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
        body: {
          assetId: currentAsset.id,
          imageUrl: currentAsset.publicUrl,
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
      onRetagStart?.(currentAsset.id)

      // Set pending state - polling will handle completion
      setIsRetagging(false)
      setRetagStatus('pending')
      
      // Refresh asset data immediately to show pending status
      refetchAsset()
      
      // Polling useEffect will handle status updates and query invalidation
    } catch (error) {
      console.error('[AssetDetailPanel] Failed to retag asset:', error)
      setIsRetagging(false)
      setRetagStatus('error')
    }
  }

  const handleDelete = () => {
    deleteAssetMutation.mutate(currentAsset.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        onClose()
      },
    })
  }

  const imageUrl = currentAsset.previewUrl || currentAsset.publicUrl || ''
  
  // Initialize image source with error handling
  useEffect(() => {
    if (imageUrl) {
      setImageSrc(imageUrl)
      setImageError(false)
    }
  }, [imageUrl])
  // Use original_filename if available, otherwise fall back to storage_path filename
  const filename = currentAsset.original_filename || currentAsset.storage_path?.split('/').pop() || 'Unknown'
  const dateToDisplay = currentAsset.date_taken || currentAsset.created_at
  
  // Use same logic as AssetTile: check both database status AND tracked retagging state
  const isAssetRetagging = retaggingAssetIds.has(currentAsset.id) || currentAsset.auto_tag_status === 'pending' || retagStatus === 'pending'
  const isAssetCompleted = completedRetaggingAssetIds.has(currentAsset.id)
  const isAutoTaggingPending = isAssetRetagging

  const content = (
    <div className="space-y-5">
      {/* Hero Image - Compact but prominent */}
          {imageSrc && !imageError ? (
        <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 shadow-sm group">
          <img
            src={imageSrc}
            alt={currentAsset.tags?.[0] || 'Asset'}
            className="absolute inset-0 w-full h-full object-contain p-2 z-0 transition-opacity duration-300"
            onError={() => {
              // Try fallback URLs in order
              if (imageSrc === currentAsset.previewUrl && currentAsset.publicUrl) {
                setImageSrc(currentAsset.publicUrl)
              } else if (imageSrc === currentAsset.publicUrl && currentAsset.thumbUrl) {
                setImageSrc(currentAsset.thumbUrl)
              } else {
                // All URLs failed
                setImageError(true)
              }
            }}
            loading="eager"
          />
          
          {/* Success Indicator - shows briefly after tagging completes (matches AssetTile) */}
          {isAssetCompleted && !isAssetRetagging && (
            <div className="absolute inset-0 z-10 bg-green-50/90 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 text-green-700 text-[10px] font-medium rounded-md shadow-sm">
                <CheckCircle2 className="h-3 w-3" />
                <span>Tagged</span>
              </div>
            </div>
          )}
          
          {/* Tagging Status Indicator - matches AssetTile styling */}
          {isAssetRetagging && (
            <div className="absolute inset-0 z-10 bg-accent/10 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-accent/20 text-accent text-[10px] font-medium rounded-md shadow-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Tagging...</span>
              </div>
            </div>
          )}
          
          {/* Error Overlay - shows when tagging fails */}
          {!isAssetRetagging && !isAssetCompleted && (currentAsset.auto_tag_status === 'failed' || retagStatus === 'error') && (
            <div className="absolute inset-0 z-10 bg-red-50/90 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-700 text-[10px] font-medium rounded-md shadow-sm">
                <AlertCircle className="h-3 w-3" />
                <span>Tagging failed</span>
              </div>
            </div>
          )}
        </div>
      ) : imageError ? (
        <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 shadow-sm flex items-center justify-center">
          <div className="text-center p-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-gray-500 mt-2">Image unavailable</p>
          </div>
        </div>
      ) : null}

      {/* Content */}
      <div className="space-y-5">
        {/* Quick Actions Bar - Compact */}
        <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetag}
            disabled={isRetagging || isAssetRetagging}
            className="flex-1 h-9 text-xs font-medium border-gray-200 hover:bg-gray-50 transition-all duration-150"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Rerun AI Tagging
          </Button>
        </div>

        {/* Tags Section - Tight, efficient design */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Tags</h3>
            {tags.length > 0 && (
              <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                {tags.length}
              </span>
            )}
          </div>
          
          {/* Existing Tags - Compact design */}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all duration-150"
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
            <div className="py-3 text-center rounded-lg bg-gray-50/50 border border-gray-100">
              <p className="text-sm text-gray-400">No tags yet. Add tags to organize your assets.</p>
            </div>
          )}

          {/* Add Tag Input - Compact autocomplete */}
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
                  className="h-9 text-sm border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400/20 pr-9 transition-all duration-150"
                />
                {/* Tag suggestions indicator - show when there are available tags */}
                {allAvailableTags && allAvailableTags.filter((tag: string) => !tags.includes(tag)).length > 0 && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 ${showTagSuggestions ? 'rotate-180' : ''}`} />
                  </div>
                )}
              </div>
              <Button 
                onClick={() => handleAddTag()} 
                size="sm"
                className="h-9 px-3 shrink-0 font-medium bg-accent hover:bg-accent/90 transition-all duration-150"
                disabled={!newTag.trim()}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
            
            {/* Tag suggestions dropdown - Compact design */}
            {showTagSuggestions && allAvailableTags && allAvailableTags.filter((tag: string) => !tags.includes(tag)).length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
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
                    .slice(0, 10) // Show fewer suggestions
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
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-100 flex items-center gap-2 cursor-pointer group"
                      >
                        <span className="flex-1 font-medium">{tag}</span>
                        <Plus className="h-3.5 w-3.5 text-gray-400 group-hover:text-accent transition-colors duration-100" />
                      </button>
                    ))}
                  {allAvailableTags.filter((tag: string) => !tags.includes(tag) && (!newTag.trim() || tag.toLowerCase().includes(newTag.toLowerCase()))).length === 0 && (
                    <div className="px-3 py-3 text-sm text-gray-500 text-center">
                      {newTag.trim() ? 'No matching tags' : 'No tags available'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Section - Premium structured design */}
        <div className="space-y-0 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Details
          </h3>

          <div className="space-y-0 divide-y divide-gray-100">
            {/* Location - Premium row design */}
            <div className="py-3 first:pt-0">
              {isEditingLocation ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="relative">
                    <Input
                      type="text"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value)
                        setShowLocationSuggestions(true)
                      }}
                      placeholder="Enter location..."
                      className="h-9 text-sm border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400/20 pr-9 transition-all duration-150"
                      onFocus={() => {
                        if (availableLocations && availableLocations.length > 0) {
                          setShowLocationSuggestions(true)
                        }
                      }}
                      onBlur={() => {
                        // Delay closing to allow clicks on suggestions
                        setTimeout(() => setShowLocationSuggestions(false), 200)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleUpdateLocation()
                        } else if (e.key === 'Escape') {
                          setLocation(currentAsset.location || '')
                          setIsEditingLocation(false)
                          setShowLocationSuggestions(false)
                        }
                      }}
                      autoFocus
                    />
                    {/* Location suggestions indicator */}
                    {availableLocations && availableLocations.length > 0 && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 ${showLocationSuggestions ? 'rotate-180' : ''}`} />
                      </div>
                    )}
                    
                    {/* Location suggestions dropdown */}
                    {showLocationSuggestions && availableLocations && availableLocations.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="py-1 max-h-48 overflow-y-auto">
                          {availableLocations
                            .filter((loc: string) => {
                              if (!location.trim()) return true
                              return loc.toLowerCase().includes(location.toLowerCase())
                            })
                            .slice(0, 8)
                            .map((loc: string) => (
                              <button
                                key={loc}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  // Set the exact location value from the suggestion
                                  const exactLocation = loc
                                  setLocation(exactLocation)
                                  setShowLocationSuggestions(false)
                                  // Save immediately with the exact value
                                  updateLocationMutation.mutate(
                                    {
                                      assetId: currentAsset.id,
                                      location: exactLocation.trim() || null,
                                    },
                                    {
                                      onSuccess: () => {
                                        setIsEditingLocation(false)
                                        // Refresh asset data after successful location update
                                        refetchAsset()
                                      },
                                    }
                                  )
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-100 flex items-center gap-2 cursor-pointer group"
                              >
                                <MapPin className="h-3.5 w-3.5 text-gray-400 group-hover:text-accent transition-colors duration-100" />
                                <span className="flex-1 font-medium">{loc}</span>
                              </button>
                            ))}
                          {availableLocations.filter((loc: string) => 
                            !location.trim() || loc.toLowerCase().includes(location.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-3 text-sm text-gray-500 text-center">
                              No matching locations
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleUpdateLocation}
                      className="h-8 px-3 text-xs font-medium bg-accent hover:bg-accent/90 transition-all duration-150"
                      disabled={updateLocationMutation.isPending}
                    >
                      {updateLocationMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLocation(currentAsset.location || '')
                        setIsEditingLocation(false)
                        setShowLocationSuggestions(false)
                      }}
                      className="h-8 px-3 text-xs border-gray-200 hover:bg-gray-50 transition-all duration-150"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => setIsEditingLocation(true)}
                  className="group flex items-start justify-between cursor-pointer -mx-1 px-1 py-0.5 rounded-md hover:bg-gray-50/50 transition-colors duration-150"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-500 mb-1">Location</div>
                      <p className={`text-sm font-semibold text-gray-900 transition-colors duration-150 ${
                        location ? '' : 'text-gray-400 italic font-normal'
                      }`}>
                        {location || 'No location set'}
                      </p>
                    </div>
                  </div>
                  <Edit2 className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 mt-1" />
                </div>
              )}
            </div>

            {/* Date Taken - Premium row design */}
            <div className="py-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-500 mb-1">Date Taken</div>
                  <p className="text-sm font-semibold text-gray-900">
                    {dayjs(dateToDisplay).format('MMMM D, YYYY [at] h:mm A')}
                  </p>
                </div>
              </div>
            </div>

            {/* Filename - Premium row design */}
            <div className="py-3">
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-500 mb-1">Filename</div>
                  <p className="text-sm font-medium text-gray-700 font-mono break-all">{filename}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Destructive Action - Compact, separated */}
        <div className="pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteAssetMutation.isPending}
            className="w-full h-9 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 border-red-200/50 transition-all duration-150"
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
      <Sheet open={open} onOpenChange={onClose} modal={false}>
        <SheetContent 
          className="w-full overflow-y-auto sm:max-w-[420px] p-6" 
          showOverlay={true}
          overlayVariant="subtle"
        >
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
