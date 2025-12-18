'use client'

// Force dynamic rendering to avoid SSR issues with window object
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useAssets, AssetViewFilter } from '@/hooks/useAssets'
import { useAvailableTags } from '@/hooks/useAvailableTags'
import { useAvailableLocations } from '@/hooks/useAvailableLocations'
import { AssetGrid } from '@/components/library/AssetGrid'
import { UploadZone } from '@/components/library/UploadZone'
import { FilterBar } from '@/components/library/FilterBar'
import { BulkActionBar } from '@/components/library/BulkActionBar'
import { AddToStoryModal } from '@/components/library/AddToStoryModal'
import { BulkAddTagsModal } from '@/components/library/BulkAddTagsModal'
import { AssetDetailPanel } from '@/components/library/AssetDetailPanel'
import { Asset } from '@/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Upload, Image as ImageIcon, Plus, Sparkles, Trash2, CheckCircle2, Undo2 } from 'lucide-react'
import { useDeleteAsset } from '@/hooks/useDeleteAsset'
import { useUpdateAssetTags } from '@/hooks/useUpdateAssetTags'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { initializeBatchPolling, stopBatchPolling, addBatchToPoll, startBatchPolling } from '@/utils/pollBatchStatus'

export default function LibraryPage() {
  const [viewFilter, setViewFilter] = useState<AssetViewFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set())
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showAddToStoryModal, setShowAddToStoryModal] = useState(false)
  const [showAddTagsModal, setShowAddTagsModal] = useState(false)
  const [assetToEditTags, setAssetToEditTags] = useState<Asset | null>(null)
  const [retaggingAssetIds, setRetaggingAssetIds] = useState<Set<string>>(new Set())
  const [showBulkRetagConfirm, setShowBulkRetagConfirm] = useState(false)
  const [pendingBulkRetagAssets, setPendingBulkRetagAssets] = useState<Asset[]>([])
  const [completedRetaggingAssetIds, setCompletedRetaggingAssetIds] = useState<Set<string>>(new Set())
  
  // Premium delete flow state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 })
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false)
  const [deletedAssetsCount, setDeletedAssetsCount] = useState(0)
  const [deletedAssetsForUndo, setDeletedAssetsForUndo] = useState<Asset[]>([])

  const { data: tagsData } = useAvailableTags()
  const availableTags = tagsData || []

  const { data: locationsData } = useAvailableLocations()
  const availableLocations = locationsData || []

  // Convert filters to the format useAssets expects
  const selectedFilters = useMemo(() => {
    const filters: string[] = []
    selectedTags.forEach((tag) => filters.push(tag))
    if (selectedLocation) {
      filters.push(`__LOCATION__${selectedLocation}`)
    }
    return filters
  }, [selectedTags, selectedLocation])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useAssets(searchQuery, selectedFilters, viewFilter)

  // Log errors for debugging but don't crash the page
  if (isError && error) {
    console.error('[LibraryPage] Error loading assets:', error)
  }

  const assets = data?.pages.flatMap((page: { assets: Asset[] }) => page.assets) || []

  // Apply date range filter client-side (based on date_taken, fallback to created_at)
  const filteredAssets = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return assets

    return assets.filter((asset: Asset) => {
      // Use date_taken if available, otherwise fall back to created_at
      const dateToUse = asset.date_taken || asset.created_at
      const assetDate = new Date(dateToUse)
      
      if (dateRange.from && assetDate < dateRange.from) return false
      if (dateRange.to) {
        const toDate = new Date(dateRange.to)
        toDate.setHours(23, 59, 59, 999)
        if (assetDate > toDate) return false
      }
      return true
    })
  }, [assets, dateRange])

  // Calculate tag and location counts
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    filteredAssets.forEach((asset: Asset) => {
      (asset.tags ?? []).forEach((tag) => {
        if (tag) {
          counts.set(tag, (counts.get(tag) || 0) + 1)
        }
      })
    })
    return counts
  }, [filteredAssets])

  const locationCounts = useMemo(() => {
    const counts = new Map<string, number>()
    filteredAssets.forEach((asset: Asset) => {
      if (asset.location && asset.location.trim()) {
        const location = asset.location.trim()
        counts.set(location, (counts.get(location) || 0) + 1)
      }
    })
    return counts
  }, [filteredAssets])

  const deleteAsset = useDeleteAsset()
  const updateTags = useUpdateAssetTags()
  const queryClient = useQueryClient()
  const supabase = createClient()

  const handleAssetSelect = useCallback((assetId: string, selected: boolean) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(assetId)
      } else {
        next.delete(assetId)
      }
      return next
    })
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedAssetIds(new Set())
  }, [])

  const handleBulkAddToStory = useCallback(() => {
    setShowAddToStoryModal(true)
  }, [])

  const handleBulkAddTags = useCallback(() => {
    setShowAddTagsModal(true)
  }, [])

  const handleBulkRetagWithAI = useCallback(() => {
    if (selectedAssetIds.size === 0) return

    // Get selected assets with their public URLs
    const selectedAssets = filteredAssets.filter((asset: Asset) => selectedAssetIds.has(asset.id))
    const assetsWithUrls = selectedAssets.filter((asset: Asset) => asset.publicUrl)

    if (assetsWithUrls.length === 0) {
      alert('No assets with valid URLs found')
      return
    }

    // Show confirmation dialog
    setPendingBulkRetagAssets(assetsWithUrls)
    setShowBulkRetagConfirm(true)
  }, [selectedAssetIds, filteredAssets])

  const confirmBulkRetagWithAI = useCallback(async () => {
    const assetsWithUrls = pendingBulkRetagAssets
    setShowBulkRetagConfirm(false)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert('Not authenticated')
      return
    }

    try {
      const assetIds = assetsWithUrls.map(asset => asset.id)
      console.log('[LibraryPage] Starting bulk retag for', assetIds.length, 'assets')

      // Track which assets are being retagged (for UI feedback)
      setRetaggingAssetIds(new Set(assetIds))

      // Prepare batch request
      const batchRequest = {
        assets: assetsWithUrls.map(asset => ({
          assetId: asset.id,
          imageUrl: asset.publicUrl!,
        })),
      }

      console.log('[LibraryPage] Starting bulk retag for', assetsWithUrls.length, 'assets')
      console.log('[LibraryPage] Batch request:', JSON.stringify(batchRequest, null, 2))

      // Call edge function with batch request
      const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
        body: batchRequest,
      })

      if (error) {
        console.error('[LibraryPage] Bulk retag error:', error)
        console.error('[LibraryPage] Error details:', JSON.stringify(error, null, 2))
        // Clear retagging state on error
        setRetaggingAssetIds(new Set())
        throw error
      }

      console.log('[LibraryPage] Bulk retag response:', data)

      // Check if this is a batch API response (async) or immediate processing (sync)
      if (data?.batchId) {
        // Batch API: Async processing - add to polling queue
        console.log('[LibraryPage] ✅ Batch API job created:', data.batchId)
        console.log('[LibraryPage] Batch will be processed asynchronously')
        
        // Add batch to polling queue immediately
        addBatchToPoll(data.batchId)
        
        // Ensure polling is running
        startBatchPolling()
        
        console.log('[LibraryPage] ✅ Added batch to polling queue')
        
        // Refresh UI to show pending status (edge function sets status to pending)
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        setTimeout(() => refetch(), 500)
        
      } else if (data?.results) {
        // Immediate processing: Results already available
        console.log('[LibraryPage] ✅ Immediate processing complete')
        console.log('[LibraryPage] Results:', data.results)
        
        // Check if all results are empty (indicates no tags enabled)
        const allEmpty = Array.isArray(data.results) && data.results.every((r: any) => !r.tags || r.tags.length === 0)
        if (allEmpty && data.results.length > 0) {
          console.warn('[LibraryPage] ⚠️  All results have empty tags - no tags may be enabled for auto-tagging')
          console.warn('[LibraryPage] ⚠️  Please check tag configuration at /app/tags and ensure at least one tag is enabled for AI')
          alert('Auto-tagging completed but no tags were applied. Please check your tag configuration and ensure at least one tag is enabled for AI auto-tagging.')
        }
        
        // Results are already saved to DB by edge function
        // Refresh UI to show updated tags (even if empty)
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        setTimeout(() => refetch(), 500)
        
      } else {
        console.warn('[LibraryPage] ⚠️ Unexpected response format:', data)
        // Still refresh to be safe
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        setTimeout(() => refetch(), 500)
      }

      console.log(`[LibraryPage] ✅ Successfully started retagging for ${assetsWithUrls.length} assets`)

      // Don't clear selection immediately - let user see the pending status
    } catch (error) {
      console.error('[LibraryPage] Failed to bulk retag:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to start bulk retagging: ${errorMessage}`)
      setRetaggingAssetIds(new Set())
    }
  }, [pendingBulkRetagAssets, supabase, queryClient, refetch])
  
  // Initialize batch polling on mount
  useEffect(() => {
    console.log('[LibraryPage] Initializing batch polling...')
    initializeBatchPolling()

    // Listen for batch completion events
    const handleBatchCompleted = (event: CustomEvent) => {
      console.log('[LibraryPage] Batch completed event received:', event.detail)
      // Refresh assets to show updated tags
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      refetch()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('batchCompleted', handleBatchCompleted as EventListener)
    }

    return () => {
      console.log('[LibraryPage] Cleaning up batch polling...')
      stopBatchPolling()
      if (typeof window !== 'undefined') {
        window.removeEventListener('batchCompleted', handleBatchCompleted as EventListener)
      }
    }
  }, [queryClient, refetch])

  // Poll for retagging status updates
  useEffect(() => {
    if (retaggingAssetIds.size === 0) return

    const pollInterval = setInterval(async () => {
      const assetIdsArray = Array.from(retaggingAssetIds)
      
      const { data: assets, error } = await supabase
        .from('assets')
        .select('id, auto_tag_status')
        .in('id', assetIdsArray)

      if (error) {
        console.error('[LibraryPage] Error polling retag status:', error)
        return
      }

      if (assets) {
        // Check which assets are currently being tracked as retagging
        const currentlyRetagging = Array.from(retaggingAssetIds)
        
        // Find assets that were retagging and are now completed
        const completedIds = assets
          .filter(asset => currentlyRetagging.includes(asset.id) && (asset.auto_tag_status === 'completed' || asset.auto_tag_status === 'failed'))
          .map(asset => asset.id)
        
        const successfullyCompletedIds = assets
          .filter(asset => currentlyRetagging.includes(asset.id) && asset.auto_tag_status === 'completed')
          .map(asset => asset.id)

        if (completedIds.length > 0) {
          console.log('[LibraryPage] Polling - Found completed assets:', completedIds.length, 'Successfully:', successfullyCompletedIds.length)
          
          // Show success indicator for successfully completed assets
          if (successfullyCompletedIds.length > 0) {
            console.log('[LibraryPage] Polling - Showing success indicator for:', successfullyCompletedIds)
            setCompletedRetaggingAssetIds((prev) => {
              const next = new Set(prev)
              successfullyCompletedIds.forEach(id => next.add(id))
              console.log('[LibraryPage] Polling - Completed retagging IDs now:', Array.from(next))
              return next
            })
            
            // Clear success indicators after 3 seconds
            setTimeout(() => {
              setCompletedRetaggingAssetIds((prev) => {
                const next = new Set(prev)
                successfullyCompletedIds.forEach(id => next.delete(id))
                console.log('[LibraryPage] Polling - Cleared success indicators')
                return next
              })
            }, 3000)
          }
          
          setRetaggingAssetIds((prev) => {
            const next = new Set(prev)
            completedIds.forEach(id => next.delete(id))
            return next
          })

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['assets'] })
          
          // If all are done, clear selection
          const remaining = new Set(Array.from(retaggingAssetIds))
          completedIds.forEach(id => remaining.delete(id))
          if (remaining.size === 0) {
            handleClearSelection()
          }
        }
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [retaggingAssetIds, supabase, queryClient, handleClearSelection])

  const handleBulkDelete = useCallback(() => {
    if (selectedAssetIds.size === 0) return
    setShowDeleteConfirmation(true)
  }, [selectedAssetIds.size])

  const confirmBulkDelete = useCallback(async () => {
    if (selectedAssetIds.size === 0) return
    
    setShowDeleteConfirmation(false)
    setIsDeleting(true)
    
    const assetIdsArray = Array.from(selectedAssetIds)
    const assetsToDelete = filteredAssets.filter((asset: Asset) => selectedAssetIds.has(asset.id))
    const count = assetIdsArray.length
    
    setDeleteProgress({ current: 0, total: count })
    
    try {
      // Optimistic update: Remove from UI immediately
      queryClient.setQueryData(['assets'], (oldData: any) => {
        if (!oldData?.pages) return oldData
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            assets: page.assets.filter((asset: Asset) => !selectedAssetIds.has(asset.id)),
            totalCount: Math.max(0, (page.totalCount || page.assets.length) - count),
          })),
        }
      })
      
      // Clear selection immediately for smooth UX
      handleClearSelection()
      
      // Delete assets with progress tracking
      let completed = 0
      const deletePromises = assetIdsArray.map(async (id, index) => {
        try {
          await deleteAsset.mutateAsync(id)
          completed++
          setDeleteProgress({ current: completed, total: count })
        } catch (error) {
          console.error(`[LibraryPage] Failed to delete asset ${id}:`, error)
          throw error
        }
      })
      
      await Promise.all(deletePromises)
      
      // Store for undo (clear after 5 seconds)
      setDeletedAssetsForUndo(assetsToDelete)
      setTimeout(() => {
        setDeletedAssetsForUndo([])
      }, 5000)
      
      // Show success notification
      setDeletedAssetsCount(count)
      setShowDeleteSuccess(true)
      
      // Auto-dismiss success notification after 3 seconds
      setTimeout(() => {
        setShowDeleteSuccess(false)
      }, 3000)
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      
    } catch (error) {
      console.error('[LibraryPage] Bulk delete failed:', error)
      
      // Rollback optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      
      alert('Failed to delete some assets. Please try again.')
    } finally {
      setIsDeleting(false)
      setDeleteProgress({ current: 0, total: 0 })
    }
  }, [selectedAssetIds, filteredAssets, deleteAsset, handleClearSelection, queryClient])

  const handleUndoDelete = useCallback(async () => {
    if (deletedAssetsForUndo.length === 0) return
    
    try {
      // Restore assets optimistically
      queryClient.setQueryData(['assets'], (oldData: any) => {
        if (!oldData?.pages) return oldData
        
        const restoredAssets = deletedAssetsForUndo
        return {
          ...oldData,
          pages: oldData.pages.map((page: any, index: number) => {
            if (index === 0) {
              return {
                ...page,
                assets: [...restoredAssets, ...page.assets],
                totalCount: (page.totalCount || page.assets.length) + restoredAssets.length,
              }
            }
            return page
          }),
        }
      })
      
      setDeletedAssetsForUndo([])
      setShowDeleteSuccess(false)
      
      // Refresh to sync with server
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      await refetch()
      
      alert('Assets restored. Note: Files may need to be re-uploaded if they were already deleted from storage.')
    } catch (error) {
      console.error('[LibraryPage] Undo failed:', error)
      alert('Unable to restore deleted assets.')
    }
  }, [deletedAssetsForUndo, queryClient, refetch])

  const handleAddToStory = useCallback((asset: Asset) => {
    setSelectedAssetIds(new Set([asset.id]))
    setShowAddToStoryModal(true)
  }, [])

  const handleEditTags = useCallback((asset: Asset) => {
    setSelectedAsset(asset)
  }, [])

  // Navigation functions for asset detail panel
  // Navigate through all assets matching current filters (search/tags/location/viewFilter), not date-filtered subset
  const handleNavigatePrevious = useCallback(() => {
    if (!selectedAsset) return
    const currentIndex = assets.findIndex((a: Asset) => a.id === selectedAsset.id)
    if (currentIndex > 0) {
      setSelectedAsset(assets[currentIndex - 1])
    }
  }, [selectedAsset, assets])

  const handleNavigateNext = useCallback(() => {
    if (!selectedAsset) return
    const currentIndex = assets.findIndex((a: Asset) => a.id === selectedAsset.id)
    if (currentIndex < assets.length - 1) {
      setSelectedAsset(assets[currentIndex + 1])
    }
  }, [selectedAsset, assets])

  const canNavigatePrevious = useMemo(() => {
    if (!selectedAsset) return false
    const currentIndex = assets.findIndex((a: Asset) => a.id === selectedAsset.id)
    return currentIndex > 0
  }, [selectedAsset, assets])

  const canNavigateNext = useMemo(() => {
    if (!selectedAsset) return false
    const currentIndex = assets.findIndex((a: Asset) => a.id === selectedAsset.id)
    return currentIndex < assets.length - 1
  }, [selectedAsset, assets])

  const currentAssetIndex = useMemo(() => {
    if (!selectedAsset) return undefined
    return assets.findIndex((a: Asset) => a.id === selectedAsset.id)
  }, [selectedAsset, assets])

  const handleAddToStorySuccess = useCallback(() => {
    handleClearSelection()
  }, [handleClearSelection])

  const isEmpty = !isLoading && filteredAssets.length === 0

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header - Reduced height, two-row structure */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-8 pt-4">
          {/* Row 1: Title + Actions */}
          <div className="flex items-center justify-between pb-4">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Library
            </h1>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleBulkAddToStory}
                disabled={selectedAssetIds.size === 0}
                className="h-9 px-4 text-sm font-semibold bg-accent hover:bg-accent/90 shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add to Story
              </Button>
              <Button
                onClick={() => setShowUploadDialog(true)}
                variant="outline"
                className="h-9 px-4 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>

          {/* Row 2: Tabs + Count */}
          <div className="flex items-center justify-between pb-3">
            <Tabs value={viewFilter} onValueChange={(v) => setViewFilter(v as AssetViewFilter)}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-sm px-4">
                  All Assets
                </TabsTrigger>
                <TabsTrigger value="in-stories" className="text-sm px-4">
                  Used in Stories
                </TabsTrigger>
                <TabsTrigger value="not-in-stories" className="text-sm px-4">
                  Not in Stories
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-sm text-gray-500 font-medium">
              {(() => {
                // Use backend count, adjusted for date filter if active
                const backendCount = data?.pages[0]?.totalCount || 0
                if (dateRange.from || dateRange.to) {
                  // Date filter is client-side, so count filtered assets
                  return filteredAssets.length
                }
                return backendCount
              })()} {(() => {
                const backendCount = data?.pages[0]?.totalCount || 0
                if (dateRange.from || dateRange.to) {
                  return filteredAssets.length === 1 ? 'asset' : 'assets'
                }
                return backendCount === 1 ? 'asset' : 'assets'
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* Contained Control Surface */}
      <div className="border-b border-gray-200 bg-gray-50/50">
        <div className="px-8 py-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            selectedLocation={selectedLocation}
            onLocationChange={setSelectedLocation}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            availableTags={availableTags}
            availableLocations={availableLocations}
            tagCounts={tagCounts}
            locationCounts={locationCounts}
          />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-white relative">
        {isError ? (
          <div className="flex h-full items-center justify-center px-8">
            <div className="text-center max-w-sm">
              <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Error loading assets
              </h3>
              <p className="text-sm text-gray-500 mb-2">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
              <Button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload()
                  }
                }}
                variant="outline"
                className="h-9"
              >
                Retry
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading assets...</p>
            </div>
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center px-8">
            <div className="text-center max-w-md">
              <div className="h-16 w-16 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {viewFilter === 'in-stories'
                  ? 'No assets in stories'
                  : viewFilter === 'not-in-stories'
                  ? 'All assets are in stories'
                  : searchQuery || selectedTags.length > 0 || selectedLocation || dateRange.from || dateRange.to
                  ? 'No assets match your filters'
                  : 'Your library is empty'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {viewFilter === 'all'
                  ? searchQuery || selectedTags.length > 0 || selectedLocation || dateRange.from || dateRange.to
                    ? 'Try adjusting your search or filters to find what you\'re looking for'
                    : 'Upload your first asset to start building your content library'
                  : 'Try a different view or upload new assets'}
              </p>
              {viewFilter === 'all' && !searchQuery && selectedTags.length === 0 && !selectedLocation && !dateRange.from && !dateRange.to && (
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  className="h-10 px-5 font-semibold bg-accent hover:bg-accent/90 shadow-sm"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload assets
                </Button>
              )}
            </div>
          </div>
        ) : (
          <AssetGrid
            assets={filteredAssets}
            onAssetClick={setSelectedAsset}
            hasNextPage={hasNextPage || false}
            fetchNextPage={() => fetchNextPage()}
            selectedAssetIds={selectedAssetIds}
            onAssetSelect={handleAssetSelect}
            onAddToStory={handleAddToStory}
            onEditTags={handleEditTags}
            retaggingAssetIds={retaggingAssetIds}
            completedRetaggingAssetIds={completedRetaggingAssetIds}
          />
        )}
        {isFetchingNextPage && (
          <div className="p-4 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-gray-500">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"></div>
              Loading more...
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedAssetIds.size}
        onAddToStory={handleBulkAddToStory}
        onAddTags={handleBulkAddTags}
        onRetagWithAI={handleBulkRetagWithAI}
        onDelete={handleBulkDelete}
        onClearSelection={handleClearSelection}
      />

      {/* Modals */}
      {showAddToStoryModal && (
        <AddToStoryModal
          open={showAddToStoryModal}
          onClose={() => {
            setShowAddToStoryModal(false)
            handleClearSelection()
          }}
          selectedAssetIds={Array.from(selectedAssetIds)}
          onSuccess={handleAddToStorySuccess}
        />
      )}

      {showAddTagsModal && (
        <BulkAddTagsModal
          open={showAddTagsModal}
          onClose={() => {
            setShowAddTagsModal(false)
            handleClearSelection()
          }}
          selectedAssetIds={Array.from(selectedAssetIds)}
          onSuccess={handleClearSelection}
        />
      )}

      {/* Bulk Retag Confirmation Dialog */}
      <AlertDialog open={showBulkRetagConfirm} onOpenChange={setShowBulkRetagConfirm}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                  Retag {pendingBulkRetagAssets.length} {pendingBulkRetagAssets.length === 1 ? 'asset' : 'assets'} with AI?
                </AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="text-sm text-gray-600 mt-2">
              AI will analyze each image and automatically add relevant tags. This may take a few moments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkRetagWithAI}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Start Retagging
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          open={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onRetagStart={(assetId) => {
            // Track single retag the same way as bulk retag
            setRetaggingAssetIds((prev) => new Set(prev).add(assetId))
          }}
          retaggingAssetIds={retaggingAssetIds}
          completedRetaggingAssetIds={completedRetaggingAssetIds}
          onNavigatePrevious={handleNavigatePrevious}
          onNavigateNext={handleNavigateNext}
          canNavigatePrevious={canNavigatePrevious}
          canNavigateNext={canNavigateNext}
          currentIndex={currentAssetIndex}
          totalCount={assets.length}
        />
      )}

      {/* Upload Dialog */}
      <UploadZone
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUploadComplete={(assetId) => {
          // Track newly uploaded assets for tagging feedback
          // Assets are uploaded with auto_tag_status: 'pending', so they'll show the tagging indicator
          if (assetId) {
            setRetaggingAssetIds((prev) => new Set(prev).add(assetId))
          }
        }}
      />

      {/* Premium Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="mb-2 text-center text-2xl font-semibold text-gray-900">
                Delete {selectedAssetIds.size} {selectedAssetIds.size === 1 ? 'asset' : 'assets'}?
              </h3>
              <p className="text-center text-sm leading-relaxed text-gray-600">
                This action cannot be undone. The selected assets will be permanently deleted.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => setShowDeleteConfirmation(false)}
                variant="outline"
                className="flex-1 border-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmBulkDelete}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Progress Overlay */}
      {isDeleting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex flex-col items-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-red-600" />
              <h3 className="mb-2 text-center text-lg font-semibold text-gray-900">
                Deleting Assets...
              </h3>
              <p className="text-center text-sm text-gray-600">
                {deleteProgress.current} of {deleteProgress.total}
              </p>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-red-600 transition-all duration-300"
                style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Premium Success Toast Notification */}
      {showDeleteSuccess && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 animate-in slide-in-from-top-5 fade-in-0">
          <div className="mx-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {deletedAssetsCount} {deletedAssetsCount === 1 ? 'asset' : 'assets'} deleted
              </p>
              {deletedAssetsForUndo.length > 0 && (
                <p className="mt-0.5 text-xs text-gray-600">
                  Tap undo to restore
                </p>
              )}
            </div>
            {deletedAssetsForUndo.length > 0 && (
              <Button
                onClick={handleUndoDelete}
                variant="outline"
                size="sm"
                className="ml-2 border-gray-200 bg-gray-50 hover:bg-gray-100"
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                Undo
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
