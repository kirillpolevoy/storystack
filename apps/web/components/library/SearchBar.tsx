'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Search, X, MapPin, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'

const LOCATION_PREFIX = '__LOCATION__'
const NO_TAGS_FILTER = '__NO_TAGS__'

interface SearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedFilters: string[] // Unified tags and locations with prefix
  onToggleFilter: (filter: string) => void
  availableTags: string[]
  availableLocations: string[]
  tagCounts?: Map<string, number>
  locationCounts?: Map<string, number>
}

// Helper to check if a value is a location filter
const isLocationFilter = (value: string): boolean => {
  return typeof value === 'string' && value.startsWith(LOCATION_PREFIX)
}

// Extract location name from location filter
const getLocationName = (locationFilter: string): string => {
  return locationFilter.replace(LOCATION_PREFIX, '')
}

// Create location filter identifier
const createLocationFilter = (location: string): string => {
  return `${LOCATION_PREFIX}${location}`
}

export function SearchBar({
  searchQuery,
  onSearchChange,
  selectedFilters,
  onToggleFilter,
  availableTags,
  availableLocations,
  tagCounts = new Map(),
  locationCounts = new Map(),
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Unified tag and location list: show all when empty, filtered when typing
  const displayItems = useMemo(() => {
    const selectedSet = new Set(selectedFilters || [])
    const isNoTagsSelected = selectedSet.has(NO_TAGS_FILTER)
    
    // Build list of regular tags (excluding NO_TAGS_FILTER and location filters)
    const regularTags = (availableTags || []).filter((tag) => 
      tag !== NO_TAGS_FILTER && 
      !selectedSet.has(tag) &&
      !isLocationFilter(tag)
    )

    // Build list of locations (excluding already selected ones)
    const regularLocations = (availableLocations || [])
      .filter((location) => location && location.trim())
      .filter((location) => !selectedSet.has(createLocationFilter(location)))
      .map((location) => ({
        type: 'location' as const,
        value: createLocationFilter(location),
        displayName: location,
        count: locationCounts?.get(location) || 0,
      }))

    // Build list of tags
    const tagItems = regularTags.map((tag) => ({
      type: 'tag' as const,
      value: tag,
      displayName: tag,
      count: tagCounts?.get(tag) || 0,
    }))

    // If user is typing, filter and sort by relevance
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase().trim()
      
      // Filter tags
      const filteredTags = tagItems.filter((item) => {
        return item.displayName.toLowerCase().includes(query)
      }).sort((a, b) => {
        const aLower = a.displayName.toLowerCase()
        const bLower = b.displayName.toLowerCase()
        
        if (aLower === query) return -1
        if (bLower === query) return 1
        
        if (aLower.startsWith(query)) return -1
        if (bLower.startsWith(query)) return 1
        
        return a.displayName.localeCompare(b.displayName)
      })

      // Filter locations
      const filteredLocations = regularLocations.filter((item) => {
        return item.displayName.toLowerCase().includes(query)
      }).sort((a, b) => {
        const aLower = a.displayName.toLowerCase()
        const bLower = b.displayName.toLowerCase()
        
        if (aLower === query) return -1
        if (bLower === query) return 1
        
        if (aLower.startsWith(query)) return -1
        if (bLower.startsWith(query)) return 1
        
        return a.displayName.localeCompare(b.displayName)
      })

      const results: Array<{ type: 'tag' | 'location' | 'no-tags'; value: string; displayName: string; count: number }> = []
      
      // Add "No Tags" option if it matches search query and not already selected
      if (!isNoTagsSelected && 'no tags'.includes(query)) {
        results.push({ type: 'no-tags', value: NO_TAGS_FILTER, displayName: 'No Tags', count: 0 })
      }
      
      // Add locations first (they're more specific), then tags
      results.push(...filteredLocations, ...filteredTags)
      
      return results
    }

    // If empty, show all items sorted by usage (most popular first)
    // Locations first, then tags
    const sortedLocations = regularLocations.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count // Higher count first
      }
      return a.displayName.localeCompare(b.displayName) // Alphabetical tiebreaker
    })

    const sortedTags = tagItems.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count // Higher count first
      }
      return a.displayName.localeCompare(b.displayName) // Alphabetical tiebreaker
    })

    const results: Array<{ type: 'tag' | 'location' | 'no-tags'; value: string; displayName: string; count: number }> = []
    
    // Add "No Tags" option at the beginning if enabled and not selected
    if (!isNoTagsSelected) {
      const noTagsCount = Array.from(tagCounts.values()).reduce((sum, count) => sum + count, 0)
      const totalAssets = noTagsCount + (availableTags.length === 0 ? 0 : availableTags.reduce((sum, tag) => sum + (tagCounts.get(tag) || 0), 0))
      const assetsWithTags = availableTags.reduce((sum, tag) => sum + (tagCounts.get(tag) || 0), 0)
      const noTagsAssetCount = totalAssets - assetsWithTags
      results.push({ type: 'no-tags', value: NO_TAGS_FILTER, displayName: 'No Tags', count: noTagsAssetCount })
    }
    
    // Add locations first, then tags
    results.push(...sortedLocations, ...sortedTags)
    
    return results
  }, [debouncedQuery, availableTags, availableLocations, selectedFilters, tagCounts, locationCounts])

  const handleFilterSelect = useCallback((filterValue: string) => {
    onToggleFilter(filterValue)
    onSearchChange('')
    setIsFocused(false)
    inputRef.current?.blur()
  }, [onToggleFilter, onSearchChange])

  const handleRemoveFilter = useCallback((filterValue: string) => {
    onToggleFilter(filterValue)
  }, [onToggleFilter])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false)
      }
    }

    if (isFocused) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isFocused])

  const showDropdown = isFocused && displayItems.length > 0
  const selectedFiltersSet = useMemo(() => new Set(selectedFilters || []), [selectedFilters])

  return (
    <div className="space-y-3 relative z-0">
      <div className="relative max-w-md">
        <Search className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors ${
          isFocused ? 'text-accent' : 'text-gray-400'
        }`} />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search tags and locations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className="pl-8 pr-8 h-9 text-sm"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md hover:bg-gray-100"
            onClick={() => {
              onSearchChange('')
              inputRef.current?.focus()
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setIsFocused(false)}
            style={{ pointerEvents: 'auto' }}
          />
          <div
            ref={dropdownRef}
            className="absolute z-[101] mt-2 w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-lg max-h-80 overflow-hidden"
            style={{ position: 'absolute' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {displayItems.length} {displayItems.length === 1 ? 'result' : 'results'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFocused(false)}
                className="h-8 px-3 text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                Done
              </Button>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto">
              {displayItems.map((item, index) => {
                const isSelected = selectedFiltersSet.has(item.value)
                const isLocation = item.type === 'location'
                const isNoTags = item.type === 'no-tags'

                return (
                  <button
                    key={`${item.value}-${index}`}
                    onClick={() => handleFilterSelect(item.value)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                      isSelected 
                        ? 'bg-accent/5 border-l-2 border-l-accent' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isLocation && (
                          <MapPin className="h-4.5 w-4.5 text-muted-foreground flex-shrink-0" />
                        )}
                        {isNoTags && (
                          <X className="h-4.5 w-4.5 text-muted-foreground flex-shrink-0" />
                        )}
                        {!isLocation && !isNoTags && (
                          <Tag className="h-4.5 w-4.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.displayName}
                          </p>
                          {item.count > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {item.count} {item.count === 1 ? 'photo' : 'photos'}
                            </p>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="ml-3 flex-shrink-0">
                          <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Selected Filters Chips */}
      {selectedFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedFilters.map((filter) => {
            if (!filter) return null
            const isNoTagsFilter = filter === NO_TAGS_FILTER
            const isLocation = isLocationFilter(filter)
            const displayName = isNoTagsFilter 
              ? 'No Tags' 
              : isLocation 
              ? getLocationName(filter)
              : filter
            const count = isLocation 
              ? locationCounts?.get(getLocationName(filter)) || 0
              : tagCounts?.get(filter) || 0

            return (
              <span
                key={filter}
                className="inline-flex items-center gap-2 rounded-full bg-accent text-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent/90 transition-colors"
              >
                {isLocation && (
                  <MapPin className="h-3.5 w-3.5" />
                )}
                {isNoTagsFilter && (
                  <X className="h-3.5 w-3.5" />
                )}
                {displayName}
                {count > 0 && (
                  <span className="opacity-85">({count})</span>
                )}
                <button
                  onClick={() => handleRemoveFilter(filter)}
                  className="hover:bg-white/20 transition-colors rounded-full p-0.5 -mr-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
