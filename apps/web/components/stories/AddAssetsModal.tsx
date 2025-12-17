'use client'

import { useState, useMemo, useCallback, useRef, useEffect, KeyboardEvent } from 'react'
import { useAssets } from '@/hooks/useAssets'
import { useAvailableTags } from '@/hooks/useAvailableTags'
import { useAvailableLocations } from '@/hooks/useAvailableLocations'
import { Asset } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AssetTile } from '@/components/library/AssetTile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, Check, MapPin, Tag } from 'lucide-react'
import { SearchBar } from '@/components/library/SearchBar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAddStoryAssets } from '@/hooks/useStoryAssets'

const LOCATION_PREFIX = '__LOCATION__'
const NO_TAGS_FILTER = '__NO_TAGS__'

interface AddAssetsModalProps {
  open: boolean
  onClose: () => void
  storyId: string
  currentStoryAssetIds: string[] // Assets already in this story
}

// Helper to parse filename from storage_path
function parseFilename(storagePath: string): string {
  const parts = storagePath.split('/')
  const filename = parts[parts.length - 1] || storagePath
  // Remove extension if present
  return filename.replace(/\.[^/.]+$/, '')
}

// Helper to check if search matches asset
function matchesSearch(asset: Asset, searchQuery: string): boolean {
  if (!searchQuery.trim()) return true
  
  const query = searchQuery.toLowerCase().trim()
  
  // Check tags
  if (asset.tags?.some(tag => tag.toLowerCase().includes(query))) {
    return true
  }
  
  // Check location
  if (asset.location?.toLowerCase().includes(query)) {
    return true
  }
  
  // Check filename (client-side parse)
  const filename = parseFilename(asset.storage_path)
  if (filename.toLowerCase().includes(query)) {
    return true
  }
  
  // Check storage_path (server-side ILIKE already handles this, but check here too)
  if (asset.storage_path.toLowerCase().includes(query)) {
    return true
  }
  
  return false
}

export function AddAssetsModal({
  open,
  onClose,
  storyId,
  currentStoryAssetIds,
}: AddAssetsModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  
  const { data: tagsData } = useAvailableTags()
  const availableTags = tagsData || []
  
  const { data: locationsData } = useAvailableLocations()
  const availableLocations = locationsData || []
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAssets(searchQuery, selectedFilters)
  
  const addAssets = useAddStoryAssets()
  
  const allAssets = data?.pages.flatMap((page) => page.assets) || []
  
  // Filter out assets already in this story
  // Note: useAssets already does server-side ILIKE on storage_path, so we don't need to filter again
  // But we keep matchesSearch for additional client-side filename parsing if needed
  const availableAssets = useMemo(() => {
    return allAssets.filter((asset) => !currentStoryAssetIds.includes(asset.id))
  }, [allAssets, currentStoryAssetIds])
  
  // Calculate tag and location counts for search bar
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    availableAssets.forEach((asset) => {
      (asset.tags ?? []).forEach((tag) => {
        if (tag) {
          counts.set(tag, (counts.get(tag) || 0) + 1)
        }
      })
    })
    return counts
  }, [availableAssets])
  
  const locationCounts = useMemo(() => {
    const counts = new Map<string, number>()
    availableAssets.forEach((asset) => {
      if (asset.location && asset.location.trim()) {
        const location = asset.location.trim()
        counts.set(location, (counts.get(location) || 0) + 1)
      }
    })
    return counts
  }, [availableAssets])
  
  const toggleFilter = useCallback((filter: string) => {
    setSelectedFilters((prev) => 
      prev.includes(filter) 
        ? prev.filter((f) => f !== filter) 
        : [...prev, filter]
    )
  }, [])
  
  const handleAssetSelect = useCallback((assetId: string, index: number, event: React.MouseEvent) => {
    // Ensure assetId is a string for consistent comparison
    const assetIdString = String(assetId)
    // Skip if asset is already in story
    if (currentStoryAssetIds.includes(assetIdString)) {
      return
    }
    
    const isShiftClick = event.shiftKey
    const isModifierClick = event.metaKey || event.ctrlKey
    
    if (isShiftClick && lastSelectedIndex !== null && lastSelectedIndex >= 0) {
      // Range selection: select all images from lastSelectedIndex to current index
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      
      // Range selection: select all images from lastSelectedIndex to current index
      // Ensure we're working with valid indices
      if (start >= 0 && end < availableAssets.length) {
        const rangeIds = availableAssets
          .slice(start, end + 1)
          .map(a => String(a.id)) // Ensure IDs are strings for consistent comparison
          .filter(id => !currentStoryAssetIds.includes(String(id))) // Filter out assets already in story
        
        setSelectedAssetIds((prev) => {
          // Create a new Set to ensure React detects the change
          const next = new Set(prev)
          // Add all IDs in the range
          rangeIds.forEach(id => {
            next.add(id)
          })
          return next
        })
      }
      // Update lastSelectedIndex to the current index for future range selections
      setLastSelectedIndex(index)
    } else if (isModifierClick) {
      // Toggle single selection
      setSelectedAssetIds((prev) => {
        const next = new Set(prev)
        if (next.has(assetIdString)) {
          next.delete(assetIdString)
        } else {
          next.add(assetIdString)
        }
        return next
      })
      setLastSelectedIndex(index)
    } else {
      // Single selection (toggle)
      setSelectedAssetIds((prev) => {
        const next = new Set(prev)
        if (next.has(assetIdString)) {
          next.delete(assetIdString)
        } else {
          next.add(assetIdString)
        }
        return next
      })
      setLastSelectedIndex(index)
    }
  }, [currentStoryAssetIds, lastSelectedIndex, availableAssets])
  
  const handleSelectAll = useCallback(() => {
    const allIds = new Set(availableAssets.map(a => a.id))
    setSelectedAssetIds(allIds)
  }, [availableAssets])
  
  const handleClearSelection = useCallback(() => {
    setSelectedAssetIds(new Set())
    setLastSelectedIndex(null)
  }, [])
  
  const handleAddAssets = useCallback(async () => {
    if (selectedAssetIds.size === 0) return
    
    const assetIdsArray = Array.from(selectedAssetIds)
    await addAssets.mutateAsync({
      storyId,
      assetIds: assetIdsArray,
    })
    
    // Clear selection and close
    setSelectedAssetIds(new Set())
    setLastSelectedIndex(null)
    onClose()
  }, [selectedAssetIds, storyId, addAssets, onClose])
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on "/"
      if (e.key === '/' && e.target !== document.activeElement?.closest('input')) {
        e.preventDefault()
        // Focus will be handled by SearchBar component
      }
      
      // Enter to add selected
      if (e.key === 'Enter' && selectedAssetIds.size > 0 && !e.shiftKey) {
        e.preventDefault()
        handleAddAssets()
      }
      
      // Escape to close
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown as any)
    return () => window.removeEventListener('keydown', handleKeyDown as any)
  }, [open, selectedAssetIds.size, handleAddAssets, onClose])
  
  const selectedCount = selectedAssetIds.size
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-5xl flex flex-col p-6">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl">Add Assets to Story</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          {/* Search and Filters */}
          <div className="flex-shrink-0">
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedFilters={selectedFilters}
              onToggleFilter={toggleFilter}
              availableTags={availableTags}
              availableLocations={availableLocations}
              tagCounts={tagCounts}
              locationCounts={locationCounts}
            />
          </div>
          
          {/* Bulk Actions Bar */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-accent/10 border border-accent/20 rounded-md">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {selectedCount} {selectedCount === 1 ? 'asset' : 'assets'} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-7 px-2 text-xs"
                >
                  Clear
                </Button>
              </div>
              <Button
                onClick={handleAddAssets}
                disabled={addAssets.isPending}
                className="h-8 px-4 text-sm"
              >
                {addAssets.isPending ? 'Adding...' : `Add ${selectedCount}`}
              </Button>
            </div>
          )}
          
          {/* Asset Grid */}
          <div 
            ref={gridRef}
            className="flex-1 overflow-y-auto -mx-1 px-1"
          >
            {availableAssets.length === 0 ? (
              <div className="flex h-full items-center justify-center py-12">
                <div className="text-center">
                  <p className="text-sm text-gray-500">No assets found</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
                {availableAssets.map((asset, index) => {
                  // Ensure consistent ID comparison (convert to string)
                  const assetIdString = String(asset.id)
                  const isSelected = selectedAssetIds.has(assetIdString)
                  const isInCurrentStory = currentStoryAssetIds.includes(asset.id)
                  
                  return (
                    <div
                      key={asset.id}
                      className={`relative group ${
                        isInCurrentStory ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      onClick={(e) => handleAssetSelect(String(asset.id), index, e)}
                    >
                      {/* Checkbox overlay - positioned at top-left, above all AssetTile overlays */}
                      <div 
                        className="absolute top-2 left-2 z-[100] pointer-events-auto"
                        style={{ zIndex: 100 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAssetSelect(asset.id, index, e)
                        }}
                      >
                        <div
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all shadow-lg ${
                            isSelected
                              ? 'bg-accent border-accent'
                              : 'bg-white/95 border-gray-300 group-hover:border-accent'
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-white font-bold" />
                          )}
                        </div>
                      </div>
                      
                      <div className={`${isSelected ? 'ring-2 ring-accent' : ''} aspect-square`}>
                        <AssetTile asset={asset} onClick={() => {}} />
                      </div>
                      
                      {/* Story membership badge - component handles null check internally */}
                      <StoryMembershipBadge
                        asset={asset}
                        currentStoryId={storyId}
                      />
                      
                      {/* Added badge for assets in current story */}
                      {isInCurrentStory && (
                        <div className="absolute top-1 right-1 z-10">
                          <div className="px-1.5 py-0.5 bg-gray-900 text-white text-[10px] font-medium rounded">
                            Added
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          {/* Load More */}
          {hasNextPage && (
            <div className="flex-shrink-0 text-center py-3">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="h-8 px-4 text-sm"
              >
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Story Membership Badge Component
function StoryMembershipBadge({
  asset,
  currentStoryId,
}: {
  asset: Asset
  currentStoryId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Early return if no story count
  if (!asset.story_count || asset.story_count === 0) {
    return null
  }
  
  // Filter out current story from the list
  const otherStories = asset.story_names?.filter((_, idx) => 
    asset.story_ids?.[idx] !== currentStoryId
  ) || []
  const otherStoryCount = otherStories.length
  
  // Don't render if no other stories (only in current story)
  if (otherStoryCount === 0) {
    return null
  }
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="absolute bottom-1 left-1 z-10 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-medium rounded backdrop-blur-sm hover:bg-black/90 transition-colors whitespace-nowrap"
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(!isOpen)
          }}
        >
          {otherStoryCount} {otherStoryCount === 1 ? 'story' : 'stories'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-900 mb-2">In stories:</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {otherStories.map((storyName, idx) => (
              <div key={idx} className="text-sm text-gray-700 py-1">
                {storyName}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

