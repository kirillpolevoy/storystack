'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Asset } from '@/types'

const PAGE_SIZE = 50

const LOCATION_PREFIX = '__LOCATION__'
const NO_TAGS_FILTER = '__NO_TAGS__'

// Helper to check if a value is a location filter
const isLocationFilter = (value: string): boolean => {
  return typeof value === 'string' && value.startsWith(LOCATION_PREFIX)
}

// Extract location name from location filter
const getLocationName = (locationFilter: string): string => {
  return locationFilter.replace(LOCATION_PREFIX, '')
}

export type AssetViewFilter = 'all' | 'in-stories' | 'not-in-stories'

export function useAssets(
  searchQuery?: string,
  selectedFilters?: string[],
  viewFilter: AssetViewFilter = 'all'
) {
  const supabase = createClient()

  return useInfiniteQuery({
    queryKey: ['assets', searchQuery, selectedFilters, viewFilter],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) {
          console.error('[useAssets] Auth error:', authError)
          throw authError
        }

        if (!user) {
          throw new Error('Not authenticated')
        }

      // Separate filters into tags and locations
      const hasNoTagsFilter = selectedFilters?.includes(NO_TAGS_FILTER)
      const locationFilters = selectedFilters?.filter((f) => isLocationFilter(f)).map(getLocationName) || []
      const regularTags = selectedFilters?.filter((f) => f !== NO_TAGS_FILTER && !isLocationFilter(f)) || []

      let query = supabase
        .from('assets')
        .select('*, auto_tag_status, original_filename') // Explicitly include auto_tag_status and original_filename
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

      // Note: Search filtering is done client-side to allow searching across
      // filename (storage_path), tags, and location with OR logic
      // This ensures consistent behavior and avoids Supabase query syntax issues

      // Apply filters server-side only if no search query
      // If search is active, we'll filter client-side after search (to narrow down search results)
      // If no search, apply filters server-side for efficiency
      if (!searchQuery && selectedFilters && selectedFilters.length > 0) {
        // Apply tag filters (OR logic within tags)
        if (regularTags.length > 0) {
          query = query.contains('tags', regularTags)
        } else if (hasNoTagsFilter) {
          query = query.or('tags.is.null,tags.eq.[]')
        }

        // Apply location filters (AND logic - must also match location)
        if (locationFilters.length > 0) {
          query = query.in('location', locationFilters)
        }
      }

      const { data, error } = await query

      if (error) {
        console.error('[useAssets] Query error:', error)
        throw error
      }

      // Start with fetched data
      let filteredData = data || []

      // Fetch story membership data for these assets
      const assetIds = filteredData.map((a: any) => a.id)
      let storyMembershipMap = new Map<string, { story_ids: string[], story_names: string[], story_count: number }>()
      
      if (assetIds.length > 0) {
        const { data: storySummaryData, error: storySummaryError } = await supabase
          .from('asset_story_summary')
          .select('asset_id, story_ids, story_names, story_count')
          .in('asset_id', assetIds)
        
        if (storySummaryError) {
          console.warn('[useAssets] Story summary query error (non-fatal):', storySummaryError)
          // Continue without story membership data
        } else if (storySummaryData) {
          storySummaryData.forEach((summary: any) => {
            storyMembershipMap.set(summary.asset_id, {
              story_ids: summary.story_ids || [],
              story_names: summary.story_names || [],
              story_count: summary.story_count || 0,
            })
          })
        }
      }

      // Apply filters in order: View → Search → Tags/Location → Date
      // Search is broad (OR logic), filters narrow down (AND logic)
      
      // 1. Apply view filter (story membership) - FIRST
      if (viewFilter === 'in-stories') {
        filteredData = filteredData.filter((asset) => {
          const membership = storyMembershipMap.get(asset.id)
          return membership && membership.story_count > 0
        })
      } else if (viewFilter === 'not-in-stories') {
        filteredData = filteredData.filter((asset) => {
          const membership = storyMembershipMap.get(asset.id)
          return !membership || membership.story_count === 0
        })
      }

      // 2. Apply search filter client-side (if search query provided) - SECOND
      // Supports multiple search terms separated by spaces
      // Uses OR logic across terms (matches term A OR term B) - broad search
      // Within each term, uses OR logic (matches filename OR location OR tags)
      // This gives you all assets matching any search term
      if (searchQuery && searchQuery.trim()) {
        const searchTerms = searchQuery
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter(term => term.length > 0)
        
        if (searchTerms.length > 0) {
          filteredData = filteredData.filter((asset) => {
            // Extract searchable text from asset
            const filename = asset.storage_path?.split('/').pop() || ''
            const filenameLower = filename.toLowerCase()
            const locationLower = (asset.location || '').toLowerCase()
            const tagsLower = (asset.tags || []).map((tag: string) => tag.toLowerCase())
            
            // Combine all searchable text into a single string for quick searching
            const searchableText = [
              filenameLower,
              locationLower,
              ...tagsLower
            ].join(' ')
            
            // OR logic: asset matches if ANY search term is found (broad search)
            return searchTerms.some(term => searchableText.includes(term))
          })
        }
      }

      // 3. Apply tag/location filters client-side (AND logic between types) - THIRD
      // Filters narrow down the search results (AND logic)
      // Example: Search "chicago chains" gives 20 results, filter Location="Chicago" narrows to 3
      // If search is active, filters are applied client-side to narrow search results
      // If no search, filters were already applied server-side for efficiency
      if (searchQuery && selectedFilters && selectedFilters.length > 0) {
        const hasTags = regularTags.length > 0 || hasNoTagsFilter
        const hasLocation = locationFilters.length > 0
        
        // Apply filters to narrow down search results
        filteredData = filteredData.filter((asset) => {
          // Check tag match (OR logic within tags)
          let matchesTags = true
          if (hasTags) {
            const hasNoTags = !asset.tags || asset.tags.length === 0
            const matchesNoTagsFilter = hasNoTagsFilter && hasNoTags
            const matchesRegularTags = regularTags.length === 0 || 
              (asset.tags && regularTags.some((tag) => asset.tags.includes(tag)))
            matchesTags = matchesNoTagsFilter || matchesRegularTags
          }

          // Check location match
          let matchesLocation = true
          if (hasLocation) {
            matchesLocation = locationFilters.length === 0 || 
              (asset.location && locationFilters.includes(asset.location.trim()))
          }

          // AND logic: must match tags AND location (narrows down search results)
          return matchesTags && matchesLocation
        })
      }
      
      // 4. Date filter is applied in LibraryPage component after this hook returns

      // Map assets with public URLs and story membership data
      const assetsWithUrls: Asset[] = filteredData.map((asset: any) => {
        const thumbUrl = asset.storage_path_thumb
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_thumb).data.publicUrl
          : asset.storage_path_preview
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_preview).data.publicUrl
          : supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl

        const previewUrl = asset.storage_path_preview
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_preview).data.publicUrl
          : supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl

        const publicUrl = supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl

        // Get story membership data from map
        const storyMembership = storyMembershipMap.get(asset.id) || {
          story_ids: [],
          story_names: [],
          story_count: 0,
        }

        return {
          ...asset,
          publicUrl,
          previewUrl,
          thumbUrl,
          story_ids: storyMembership.story_ids,
          story_names: storyMembership.story_names,
          story_count: storyMembership.story_count,
        } as Asset
      })

        return {
          assets: assetsWithUrls,
          nextPage: filteredData.length === PAGE_SIZE ? pageParam + 1 : null,
        }
      } catch (error) {
        console.error('[useAssets] Error:', error)
        throw error
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    retry: 1, // Retry once on failure
  })

  // Return all query methods including refetch
  return query
}

