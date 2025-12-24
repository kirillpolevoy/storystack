'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Asset } from '@/types'
import { useActiveWorkspace } from './useActiveWorkspace'

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

  // Use reactive workspace hook instead of reading localStorage directly
  const activeWorkspaceId = useActiveWorkspace()

  const query = useInfiniteQuery({
    queryKey: ['assets', activeWorkspaceId, searchQuery, selectedFilters, viewFilter],
    enabled: !!activeWorkspaceId, // Only run query when workspace ID is available
    refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: false, // Don't refetch on window focus (already disabled in QueryClient)
    staleTime: 0, // Consider data stale immediately to force refetch
    gcTime: 0, // Don't cache data when workspace changes (garbage collect immediately)
    queryFn: async ({ pageParam = 0, queryKey }) => {
      try {
        // Extract workspace ID from query key to ensure we use the correct one
        const workspaceId = queryKey[1] as string | null
        
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

      // workspaceId is extracted from queryKey to ensure correct workspace
      if (!workspaceId) {
        // Return empty if no workspace selected
        return { assets: [], nextPage: null, totalCount: 0 }
      }

      console.log('[useAssets] Fetching assets for workspace:', workspaceId, '(from queryKey)')

      // When searching, fetch more results to account for client-side filtering
      // This ensures we don't miss matches due to pagination
      const searchPageSize = searchQuery && searchQuery.trim() ? PAGE_SIZE * 3 : PAGE_SIZE
      
      let query = supabase
        .from('assets')
        .select('*, auto_tag_status, original_filename') // Explicitly include auto_tag_status and original_filename
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null) // Exclude soft-deleted assets
        .order('created_at', { ascending: false })
        .range(pageParam * searchPageSize, (pageParam + 1) * searchPageSize - 1)

      // Note: Search filtering (including tags) is done client-side since Supabase doesn't support
      // array functions in filters. We fetch more results when searching to account for this.
      // This ensures we can search across filename, location, AND tags with proper OR logic.

      // Apply filters server-side (tags and location filters)
      // If search is active, filters narrow down search results (AND logic)
      if (selectedFilters && selectedFilters.length > 0) {
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
      
      console.log('[useAssets] Fetched', data?.length || 0, 'assets for workspace:', workspaceId)

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

      // 2. Apply tag search filter client-side (if search query provided)
      // Note: Filename and location search are handled server-side above
      // Tags are searched client-side since Supabase doesn't support array functions in filters
      // Uses OR logic: asset matches if ANY search term is found in filename/location (server-side) OR tags (client-side)
      if (searchQuery && searchQuery.trim()) {
        const searchTerms = searchQuery
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter(term => term.length > 0)
        
        if (searchTerms.length > 0) {
          filteredData = filteredData.filter((asset) => {
            // All assets in filteredData already matched filename/location server-side
            // Now check if they also match tags (OR logic - keep if matches tags OR already matched filename/location)
            const tagsLower = (asset.tags || []).map((tag: string) => tag.toLowerCase())
            const tagsText = tagsLower.join(' ')
            
            // Also check filename/location client-side to ensure consistency
            const filenameFromPath = asset.storage_path?.split('/').pop() || ''
            const originalFilename = asset.original_filename || ''
            const filename = (originalFilename || filenameFromPath).toLowerCase()
            const locationLower = (asset.location || '').toLowerCase()
            
            // Asset matches if ANY search term is found in filename, location, OR tags
            return searchTerms.some(term => 
              filename.includes(term) || 
              locationLower.includes(term) || 
              tagsText.includes(term)
            )
          })
        }
      }

      // 3. Tag/location filters are now applied server-side above (before pagination)
      // This ensures filters work correctly with search and proper pagination
      
      // 4. Date filter is applied in LibraryPage component after this hook returns

      // Get total count from backend (before pagination and client-side filtering)
      // This count reflects server-side filters: tags, location, search, and view filter
      let totalCount = 0

      try {
        // Build count query with same filters as data query
        let countQuery = supabase
          .from('assets')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .is('deleted_at', null) // Exclude soft-deleted assets

        // Note: Search count is approximate when searching, since tags are filtered client-side
        // We use filename/location matching for count to avoid the array function limitation
        if (searchQuery && searchQuery.trim()) {
          const searchTerms = searchQuery.trim().split(/\s+/).filter(term => term.length > 0)
          if (searchTerms.length > 0) {
            // Use OR logic: match any search term in storage_path, original_filename, or location
            // ILIKE with %term% allows partial matches (e.g., "chicago" matches "chicago, illinois")
            // Tags are not included in count query (approximate count)
            const searchConditions = searchTerms.map(term => 
              `storage_path.ilike.%${term}%,original_filename.ilike.%${term}%,location.ilike.%${term}%`
            ).join(',')
            countQuery = countQuery.or(searchConditions)
          }
        }

        // Apply tag/location filters server-side (always, regardless of search)
        if (selectedFilters && selectedFilters.length > 0) {
          if (regularTags.length > 0) {
            countQuery = countQuery.contains('tags', regularTags)
          } else if (hasNoTagsFilter) {
            countQuery = countQuery.or('tags.is.null,tags.eq.[]')
          }
          if (locationFilters.length > 0) {
            countQuery = countQuery.in('location', locationFilters)
          }
        }

        const { count: serverSideCount, error: countError } = await countQuery

        if (countError) {
          console.warn('[useAssets] Count query error (non-fatal):', countError)
        }

        totalCount = serverSideCount || 0

        // Apply view filter count adjustment using asset_story_summary
        if (viewFilter !== 'all') {
          // Get all asset IDs that match the base filters (for count calculation)
          let viewCountQuery = supabase
            .from('assets')
            .select('id')
            .eq('workspace_id', workspaceId)
            .is('deleted_at', null) // Exclude soft-deleted assets

          // Apply same server-side filters as count query (search first, then filters)
          // Note: Tags are not included in search query (approximate count)
          if (searchQuery && searchQuery.trim()) {
            const searchTerms = searchQuery.trim().split(/\s+/).filter(term => term.length > 0)
            if (searchTerms.length > 0) {
              // Use OR logic: match any search term in storage_path, original_filename, or location
              const searchConditions = searchTerms.map(term => 
                `storage_path.ilike.%${term}%,original_filename.ilike.%${term}%,location.ilike.%${term}%`
              ).join(',')
              viewCountQuery = viewCountQuery.or(searchConditions)
            }
          }

          if (selectedFilters && selectedFilters.length > 0) {
            if (regularTags.length > 0) {
              viewCountQuery = viewCountQuery.contains('tags', regularTags)
            } else if (hasNoTagsFilter) {
              viewCountQuery = viewCountQuery.or('tags.is.null,tags.eq.[]')
            }
            if (locationFilters.length > 0) {
              viewCountQuery = viewCountQuery.in('location', locationFilters)
            }
          }

          const { data: assetIdsData, error: assetIdsError } = await viewCountQuery

          if (!assetIdsError && assetIdsData && assetIdsData.length > 0) {
            const assetIds = assetIdsData.map((a: any) => a.id)

            // Query asset_story_summary to filter by story membership
            const { data: storySummaryData, error: storySummaryError } = await supabase
              .from('asset_story_summary')
              .select('asset_id, story_count')
              .in('asset_id', assetIds)

            if (!storySummaryError && storySummaryData) {
              const storySummaryMap = new Map(
                storySummaryData.map((s: any) => [s.asset_id, s.story_count || 0])
              )

              // Count assets based on view filter
              if (viewFilter === 'in-stories') {
                totalCount = assetIds.filter((id: string) => {
                  const count = storySummaryMap.get(id) || 0
                  return count > 0
                }).length
              } else if (viewFilter === 'not-in-stories') {
                totalCount = assetIds.filter((id: string) => {
                  const count = storySummaryMap.get(id) || 0
                  return count === 0
                }).length
              }
            }
          }
        }
      } catch (countErr) {
        console.warn('[useAssets] Error calculating count:', countErr)
        // Fallback: use filtered data length as approximate count
        totalCount = filteredData.length
      }

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
          tags: Array.isArray(asset.tags) ? asset.tags : [],
          publicUrl,
          previewUrl,
          thumbUrl,
          story_ids: storyMembership.story_ids,
          story_names: storyMembership.story_names,
          story_count: storyMembership.story_count,
        } as Asset
      })

        // For search queries, we fetched more results to account for client-side tag filtering
        // So we need to limit to PAGE_SIZE and adjust pagination accordingly
        const finalAssets = searchQuery && searchQuery.trim() 
          ? assetsWithUrls.slice(0, PAGE_SIZE)
          : assetsWithUrls
        
        return {
          assets: finalAssets,
          nextPage: (searchQuery && searchQuery.trim() 
            ? filteredData.length > PAGE_SIZE 
            : filteredData.length === PAGE_SIZE) ? pageParam + 1 : null,
          totalCount: totalCount, // Backend-driven count
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

