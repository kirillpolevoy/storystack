'use client'

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
import { Upload, Image as ImageIcon, Plus, Sparkles } from 'lucide-react'
import { useDeleteAsset } from '@/hooks/useDeleteAsset'
import { useUpdateAssetTags } from '@/hooks/useUpdateAssetTags'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

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

  const assets = data?.pages.flatMap((page) => page.assets) || []

  // Apply date range filter client-side (based on date_taken, fallback to created_at)
  const filteredAssets = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return assets

    return assets.filter((asset) => {
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
    filteredAssets.forEach((asset) => {
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
    filteredAssets.forEach((asset) => {
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
    const selectedAssets = filteredAssets.filter(asset => selectedAssetIds.has(asset.id))
    const assetsWithUrls = selectedAssets.filter(asset => asset.publicUrl)

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
      // Set all assets to pending status
      const assetIds = assetsWithUrls.map(asset => asset.id)
      console.log('[LibraryPage] Updating assets to pending:', assetIds)
      
      const { data: updateData, error: updateError } = await supabase
        .from('assets')
        .update({ auto_tag_status: 'pending' })
        .in('id', assetIds)
        .select('id, auto_tag_status') // Return updated rows to verify

      if (updateError) {
        console.error('[LibraryPage] Failed to update asset status:', updateError)
        console.error('[LibraryPage] Update error details:', JSON.stringify(updateError, null, 2))
        throw new Error(`Failed to update asset status: ${updateError.message}`)
      }

      console.log('[LibraryPage] Update response:', updateData)
      console.log('[LibraryPage] Successfully set', updateData?.length || 0, 'assets to pending status')
      
      // Verify the update actually happened
      if (updateData && updateData.length > 0) {
        const allPending = updateData.every((a: any) => a.auto_tag_status === 'pending')
        console.log('[LibraryPage] All updated assets have pending status:', allPending)
        if (!allPending) {
          console.warn('[LibraryPage] ⚠️ Some assets were not set to pending:', updateData)
        }
      } else {
        console.warn('[LibraryPage] ⚠️ No assets were updated!')
      }
      
      // Immediately verify by fetching the assets
      const { data: verifyData, error: verifyError } = await supabase
        .from('assets')
        .select('id, auto_tag_status')
        .in('id', assetIds)
      
      if (verifyError) {
        console.error('[LibraryPage] Failed to verify update:', verifyError)
      } else {
        console.log('[LibraryPage] Verification query result:', verifyData)
        const pendingCount = verifyData?.filter((a: any) => a.auto_tag_status === 'pending').length || 0
        console.log('[LibraryPage] Verified pending count:', pendingCount, 'out of', assetIds.length)
      }

      // Track which assets are being retagged
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
        setRetaggingAssetIds(new Set())
        throw error
      }

      console.log('[LibraryPage] Bulk retag response:', data)

      // Force immediate refetch to show pending status
      // Invalidate first, then refetch
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      
      // Refetch after a short delay to ensure DB update has propagated
      setTimeout(async () => {
        console.log('[LibraryPage] Refetching assets to show pending status...')
        
        // Refetch all asset queries
        const refetchResult = await queryClient.refetchQueries({ queryKey: ['assets'] })
        console.log('[LibraryPage] queryClient.refetchQueries result:', refetchResult)
        
        // Also trigger refetch on the useAssets hook
        if (refetch) {
          const result = await refetch()
          console.log('[LibraryPage] useAssets refetch completed')
          console.log('[LibraryPage] useAssets refetch data:', result.data)
          
          // Check the actual data structure
          if (result.data?.pages) {
            const allAssets = result.data.pages.flatMap((p: any) => p.assets || [])
            const pending = allAssets.filter((a: any) => a.auto_tag_status === 'pending')
            console.log('[LibraryPage] After useAssets refetch - Total assets:', allAssets.length, 'Pending:', pending.length)
            if (pending.length > 0) {
              console.log('[LibraryPage] Pending asset IDs:', pending.map((a: any) => a.id))
              console.log('[LibraryPage] Pending asset statuses:', pending.map((a: any) => ({ id: a.id, status: a.auto_tag_status })))
            } else {
              console.warn('[LibraryPage] ⚠️ No pending assets found after refetch!')
              // Check what statuses we do have
              const statuses = allAssets.map((a: any) => ({ id: a.id, status: a.auto_tag_status }))
              console.log('[LibraryPage] All asset statuses:', statuses)
            }
          }
        }
        
        // Also check query cache directly
        const queryData = queryClient.getQueriesData({ queryKey: ['assets'] })
        console.log('[LibraryPage] Found', queryData.length, 'asset queries in cache')
        queryData.forEach(([key, data]: any, index) => {
          if (data?.pages) {
            const allAssets = data.pages.flatMap((p: any) => p.assets || [])
            const pending = allAssets.filter((a: any) => a.auto_tag_status === 'pending')
            console.log(`[LibraryPage] Query ${index} - Total:`, allAssets.length, 'Pending:', pending.length)
            if (pending.length > 0) {
              console.log(`[LibraryPage] Query ${index} - Pending IDs:`, pending.map((a: any) => a.id))
            }
          }
        })
      }, 500)

      // Show success message
      console.log(`[LibraryPage] Successfully started retagging for ${assetsWithUrls.length} assets`)

      // Don't clear selection immediately - let user see the pending status
    } catch (error) {
      console.error('[LibraryPage] Failed to bulk retag:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to start bulk retagging: ${errorMessage}`)
      setRetaggingAssetIds(new Set())
    }
  }, [pendingBulkRetagAssets, supabase, queryClient, refetch])
  
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

  const handleBulkDelete = useCallback(async () => {
    if (!confirm(`Delete ${selectedAssetIds.size} assets? This cannot be undone.`)) {
      return
    }

    await Promise.all(
      Array.from(selectedAssetIds).map((id) => deleteAsset.mutateAsync(id))
    )

    handleClearSelection()
  }, [selectedAssetIds, deleteAsset, handleClearSelection])

  const handleAddToStory = useCallback((asset: Asset) => {
    setSelectedAssetIds(new Set([asset.id]))
    setShowAddToStoryModal(true)
  }, [])

  const handleEditTags = useCallback((asset: Asset) => {
    setSelectedAsset(asset)
  }, [])

  const handleAddToStorySuccess = useCallback(() => {
    handleClearSelection()
  }, [handleClearSelection])

  const isEmpty = !isLoading && filteredAssets.length === 0

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                Library
              </h1>
              <p className="text-sm text-gray-500 font-medium">
                {filteredAssets.length} {filteredAssets.length === 1 ? 'asset' : 'assets'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleBulkAddToStory}
                disabled={selectedAssetIds.size === 0}
                className="h-10 px-5 text-sm font-semibold"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add to Story
              </Button>
              <Button
                onClick={() => setShowUploadDialog(true)}
                variant="outline"
                className="h-10 px-5 text-sm font-semibold"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>

          {/* View Tabs */}
          <Tabs value={viewFilter} onValueChange={(v) => setViewFilter(v as AssetViewFilter)} className="pb-4">
            <TabsList>
              <TabsTrigger value="all">All Assets</TabsTrigger>
              <TabsTrigger value="in-stories">Used in Stories</TabsTrigger>
              <TabsTrigger value="not-in-stories">Not in Stories</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-8 py-4">
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
                onClick={() => window.location.reload()}
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
            <div className="text-center max-w-sm">
              <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {viewFilter === 'in-stories'
                  ? 'No assets in stories'
                  : viewFilter === 'not-in-stories'
                  ? 'All assets are in stories'
                  : 'Your library is empty'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {viewFilter === 'all'
                  ? 'Upload your first asset to start building your content library'
                  : 'Try a different view or upload new assets'}
              </p>
              {viewFilter === 'all' && (
                <Button
                  onClick={() => setShowUploadZone(true)}
                  className="h-9"
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
    </div>
  )
}
