'use client'

import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { X, Tag, MapPin } from 'lucide-react'

const LOCATION_PREFIX = '__LOCATION__'
const NO_TAGS_FILTER = '__NO_TAGS__'

interface FilterSidebarProps {
  selectedFilters: string[]
  onToggleFilter: (filter: string) => void
  availableTags: string[]
  availableLocations: string[]
  tagCounts?: Map<string, number>
  locationCounts?: Map<string, number>
  totalCount?: number
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

export function FilterSidebar({
  selectedFilters,
  onToggleFilter,
  availableTags,
  availableLocations,
  tagCounts = new Map(),
  locationCounts = new Map(),
  totalCount = 0,
}: FilterSidebarProps) {
  const selectedFiltersSet = useMemo(() => new Set(selectedFilters || []), [selectedFilters])

  // Calculate "No Tags" count
  const noTagsCount = useMemo(() => {
    const assetsWithTags = availableTags.reduce((sum, tag) => sum + (tagCounts.get(tag) || 0), 0)
    return Math.max(0, totalCount - assetsWithTags)
  }, [availableTags, tagCounts, totalCount])

  // Build filter items
  const filterItems = useMemo(() => {
    const items: Array<{
      type: 'tag' | 'location' | 'no-tags'
      value: string
      displayName: string
      count: number
    }> = []

    // Add "No Tags" option
    if (noTagsCount > 0 || selectedFiltersSet.has(NO_TAGS_FILTER)) {
      items.push({
        type: 'no-tags',
        value: NO_TAGS_FILTER,
        displayName: 'No Tags',
        count: noTagsCount,
      })
    }

    // Add locations
    availableLocations.forEach((location) => {
      if (location && location.trim()) {
        const count = locationCounts.get(location) || 0
        if (count > 0 || selectedFiltersSet.has(createLocationFilter(location))) {
          items.push({
            type: 'location',
            value: createLocationFilter(location),
            displayName: location,
            count,
          })
        }
      }
    })

    // Add tags
    availableTags.forEach((tag) => {
      if (tag && tag.trim()) {
        const count = tagCounts.get(tag) || 0
        if (count > 0 || selectedFiltersSet.has(tag)) {
          items.push({
            type: 'tag',
            value: tag,
            displayName: tag,
            count,
          })
        }
      }
    })

    // Sort by count (descending), then alphabetically
    return items.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return a.displayName.localeCompare(b.displayName)
    })
  }, [availableTags, availableLocations, tagCounts, locationCounts, selectedFiltersSet, noTagsCount])

  const handleToggle = (filterValue: string) => {
    onToggleFilter(filterValue)
  }

  return (
    <div className="w-64 border-r border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {filterItems.length} {filterItems.length === 1 ? 'RESULT' : 'RESULTS'}
        </h3>
        {selectedFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              selectedFilters.forEach((filter) => onToggleFilter(filter))
            }}
            className="h-6 px-2 text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Filter List */}
      <div className="flex-1 overflow-y-auto">
        {filterItems.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No filters available</p>
          </div>
        ) : (
          <div className="py-2">
            {filterItems.map((item) => {
              const isSelected = selectedFiltersSet.has(item.value)
              const isLocation = item.type === 'location'
              const isNoTags = item.type === 'no-tags'

              return (
                <label
                  key={item.value}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(item.value)}
                    className="flex-shrink-0"
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isLocation && (
                      <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    {isNoTags && (
                      <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    {!isLocation && !isNoTags && (
                      <Tag className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm text-gray-900 flex-1 truncate">
                      {item.displayName}
                    </span>
                    {item.count > 0 && (
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {item.count}
                      </span>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

