'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, X, Tag, MapPin, Calendar } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'

const NO_TAGS_FILTER = '__NO_TAGS__'
const NO_LOCATION_FILTER = '__NO_LOCATION__'

interface FilterBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  selectedLocation: string | null
  onLocationChange: (location: string | null) => void
  dateRange: { from: Date | null; to: Date | null }
  onDateRangeChange: (range: { from: Date | null; to: Date | null }) => void
  availableTags: string[]
  availableLocations: string[]
  tagCounts?: Map<string, number>
  locationCounts?: Map<string, number>
  noTagsCount?: number
  noLocationCount?: number
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  selectedTags,
  onTagsChange,
  selectedLocation,
  onLocationChange,
  dateRange,
  onDateRangeChange,
  availableTags,
  availableLocations,
  tagCounts = new Map(),
  locationCounts = new Map(),
  noTagsCount = 0,
  noLocationCount = 0,
}: FilterBarProps) {
  const [tagsOpen, setTagsOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)

  const isNoTagsSelected = selectedTags.includes(NO_TAGS_FILTER)
  const isNoLocationSelected = selectedLocation === NO_LOCATION_FILTER

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag))
    } else {
      // If "No Tags" is selected, remove it when selecting a regular tag
      const tagsWithoutNoTags = selectedTags.filter((t) => t !== NO_TAGS_FILTER)
      onTagsChange([...tagsWithoutNoTags, tag])
    }
  }

  const handleNoTagsToggle = () => {
    if (isNoTagsSelected) {
      onTagsChange(selectedTags.filter((t) => t !== NO_TAGS_FILTER))
    } else {
      // Remove all regular tags when selecting "No Tags"
      onTagsChange([NO_TAGS_FILTER])
    }
  }

  const handleLocationSelect = (location: string) => {
    if (selectedLocation === location) {
      onLocationChange(null)
    } else {
      // If "No Location" is selected, remove it when selecting a regular location
      onLocationChange(location)
    }
    setLocationOpen(false)
  }

  const handleNoLocationToggle = () => {
    if (isNoLocationSelected) {
      onLocationChange(null)
    } else {
      // Remove regular location when selecting "No Location"
      onLocationChange(NO_LOCATION_FILTER)
    }
    setLocationOpen(false)
  }

  const hasActiveFilters = selectedTags.length > 0 || selectedLocation || dateRange.from || dateRange.to

  return (
    <div className="space-y-3">
      {/* Search Input - Visually dominant */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <Input
          type="text"
          placeholder="Search assets…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-4 h-10 text-sm border-gray-300 bg-white focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent transition-all duration-200"
        />
      </div>

      {/* Filter Controls - Compact pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tags Filter */}
        <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={selectedTags.length > 0 ? 'default' : 'outline'}
              size="sm"
              className="h-8 px-3 text-xs font-medium rounded-md border-gray-300 transition-all duration-200 hover:shadow-sm"
            >
              <Tag className="mr-1.5 h-3.5 w-3.5" />
              Tags
              {selectedTags.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-xs font-medium">
                  {selectedTags.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-900 mb-2">Filter by tags</p>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {/* No Tags option - always show */}
                <label
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded"
                >
                  <Checkbox
                    checked={isNoTagsSelected}
                    onCheckedChange={handleNoTagsToggle}
                  />
                  <span className="text-sm text-gray-700 flex-1">No Tags</span>
                  {noTagsCount > 0 && (
                    <span className="text-xs text-gray-500">{noTagsCount}</span>
                  )}
                </label>
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag)
                  const count = tagCounts.get(tag) || 0
                  const isDisabled = isNoTagsSelected && !isSelected
                  return (
                    <label
                      key={tag}
                      className={`flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleTagToggle(tag)}
                        disabled={isDisabled}
                      />
                      <span className="text-sm text-gray-700 flex-1">{tag}</span>
                      {count > 0 && (
                        <span className="text-xs text-gray-500">{count}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Location Filter */}
        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={selectedLocation ? 'default' : 'outline'}
              size="sm"
              className="h-8 px-3 text-xs font-medium rounded-md border-gray-300 transition-all duration-200 hover:shadow-sm"
            >
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Location
              {selectedLocation && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-xs font-medium">
                  1
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-900 mb-2">Filter by location</p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {/* No Location option - always show */}
                <button
                  onClick={handleNoLocationToggle}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    isNoLocationSelected
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>No Location</span>
                    {noLocationCount > 0 && (
                      <span className="text-xs text-gray-500">{noLocationCount}</span>
                    )}
                  </div>
                </button>
                {availableLocations.map((location) => {
                  const isSelected = selectedLocation === location
                  const count = locationCounts.get(location) || 0
                  const isDisabled = isNoLocationSelected && !isSelected
                  return (
                    <button
                      key={location}
                      onClick={() => handleLocationSelect(location)}
                      disabled={isDisabled}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                        isSelected
                          ? 'bg-accent/10 text-accent font-medium'
                          : isDisabled
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{location}</span>
                        {count > 0 && (
                          <span className="text-xs text-gray-500">{count}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Date Range Filter */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={dateRange.from || dateRange.to ? 'default' : 'outline'}
              size="sm"
              className="h-8 px-3 text-xs font-medium rounded-md border-gray-300 transition-all duration-200 hover:shadow-sm"
            >
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              Date
              {(dateRange.from || dateRange.to) && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-xs font-medium">
                  1
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-900">Filter by photo date</p>
              <p className="text-xs text-gray-500">When the photo was taken (from EXIF)</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">From</label>
                  <Input
                    type="date"
                    value={dateRange.from ? dateRange.from.toISOString().split('T')[0] : ''}
                    onChange={(e) =>
                      onDateRangeChange({
                        ...dateRange,
                        from: e.target.value ? new Date(e.target.value) : null,
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">To</label>
                  <Input
                    type="date"
                    value={dateRange.to ? dateRange.to.toISOString().split('T')[0] : ''}
                    onChange={(e) =>
                      onDateRangeChange({
                        ...dateRange,
                        to: e.target.value ? new Date(e.target.value) : null,
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              {(dateRange.from || dateRange.to) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDateRangeChange({ from: null, to: null })}
                  className="w-full h-7 text-xs"
                >
                  Clear date filter
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear All */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onTagsChange([])
              onLocationChange(null)
              onDateRangeChange({ from: null, to: null })
            }}
            className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active Filter Chips - Polished pills */}
      {(selectedTags.length > 0 || selectedLocation || dateRange.from || dateRange.to) && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 border-0 rounded-full hover:bg-gray-200 transition-colors"
            >
              {tag === NO_TAGS_FILTER ? 'No Tags' : tag}
              <button
                onClick={() => handleTagToggle(tag)}
                className="ml-1.5 hover:text-gray-900 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedLocation && (
            <Badge
              variant="secondary"
              className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 border-0 rounded-full hover:bg-gray-200 transition-colors"
            >
              {selectedLocation === NO_LOCATION_FILTER ? 'No Location' : selectedLocation}
              <button
                onClick={() => onLocationChange(null)}
                className="ml-1.5 hover:text-gray-900 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(dateRange.from || dateRange.to) && (
            <Badge
              variant="secondary"
              className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 border-0 rounded-full hover:bg-gray-200 transition-colors"
            >
              {dateRange.from?.toLocaleDateString() || '...'} - {dateRange.to?.toLocaleDateString() || '...'}
              <button
                onClick={() => onDateRangeChange({ from: null, to: null })}
                className="ml-1.5 hover:text-gray-900 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

