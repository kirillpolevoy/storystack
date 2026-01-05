'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Search, Edit2, Trash2, Tag, Sparkles, CheckCircle2, Undo2, MoreVertical, ArrowUpDown, Filter, X, CheckCircle, Loader2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { MobileMenuButton } from '@/components/app/MobileMenuButton'
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace'
import { useTrialGate } from '@/components/subscription'

type TagConfig = {
  name: string
  usageCount: number
  useWithAI: boolean
}

type SortOption = 'alphabetical' | 'most-used' | 'ai-enabled' | 'least-used'
type FilterOption = 'all' | 'ai-enabled' | 'unused'

export default function TagsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [newTagName, setNewTagName] = useState('')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [deleteTagName, setDeleteTagName] = useState<string | null>(null)
  const [bulkDeleteTags, setBulkDeleteTags] = useState<Set<string>>(new Set())
  const [showNewTagDialog, setShowNewTagDialog] = useState(false)
  const [openMenuTag, setOpenMenuTag] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [togglingTag, setTogglingTag] = useState<string | null>(null)
  
  // Cache whether custom_tags column exists to avoid repeated 400 errors
  // Start with null (unknown) - we'll try once to detect, then cache the result
  // This matches mobile app behavior: try database first, handle errors gracefully
  const customTagsColumnExistsRef = useRef<boolean | null>(null)
  
  // Premium delete flow state
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 })
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false)
  const [deletedTagName, setDeletedTagName] = useState('')
  const [deletedTagForUndo, setDeletedTagForUndo] = useState<TagConfig | null>(null)
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Use reactive workspace hook instead of reading localStorage directly
  const activeWorkspaceId = useActiveWorkspace()

  // Edit gating - blocks edits when subscription has ended
  const { withEditAccess } = useTrialGate()

  // Fetch all tags with usage counts
  const { data: tags, isLoading, refetch } = useQuery({
    queryKey: ['tags', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ queryKey }) => {
      const workspaceId = queryKey[1] as string | null
      
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      if (!workspaceId) {
        console.log('[TagManagement] No active workspace, returning empty tags')
        return []
      }

      console.log('[TagManagement] Fetching tags for workspace:', workspaceId, '(from queryKey)')

      // Get all assets with tags from the active workspace
      const { data: assets, error } = await supabase
        .from('assets')
        .select('tags')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)

      if (error) {
        console.error('[TagManagement] Error fetching assets:', error)
        throw error
      }

      // Count tag usage
      const tagCounts = new Map<string, number>()
      assets?.forEach((asset) => {
        if (Array.isArray(asset.tags)) {
          asset.tags.forEach((tag: string) => {
            if (tag && tag.trim()) {
              tagCounts.set(tag.trim(), (tagCounts.get(tag.trim()) || 0) + 1)
            }
          })
        }
      })

      console.log('[TagManagement] Found tags in assets:', Array.from(tagCounts.keys()))

      // Get tag config (auto_tags for AI and custom_tags for user-created tags) for the active workspace
      // Match mobile app: query both columns together, handle errors gracefully
      let autoTags: string[] = []
      let customTags: string[] = []
      
      console.log('[TagManagement] Fetching tag_config for workspace:', workspaceId)
      
      // Try fetching both columns together (like mobile app does)
      const { data: config, error: configError } = await supabase
        .from('tag_config')
        .select('auto_tags, custom_tags')
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      console.log('[TagManagement] Query result - data:', config, 'error:', configError)

      if (configError) {
        if (configError.code === 'PGRST116') {
          console.log('[TagManagement] No tag_config found for workspace (new workspace) - this is OK')
        } else if (
          configError.code === '42703' || // PostgreSQL: undefined column
          configError.code === '400' || 
          configError.message?.includes('custom_tags') || 
          configError.message?.includes('column') ||
          configError.message?.includes('does not exist')
        ) {
          // custom_tags column doesn't exist - cache this and fetch just auto_tags
          customTagsColumnExistsRef.current = false
          console.log('[TagManagement] custom_tags column does not exist (error code:', configError.code, '), fetching just auto_tags')
          const { data: autoConfig } = await supabase
            .from('tag_config')
            .select('auto_tags')
            .eq('workspace_id', workspaceId)
            .maybeSingle()
          
          if (autoConfig?.auto_tags && Array.isArray(autoConfig.auto_tags)) {
            autoTags = autoConfig.auto_tags
            console.log('[TagManagement] ✅ Loaded auto_tags:', autoTags)
          }
        } else {
          console.error('[TagManagement] Config fetch error:', configError.code, configError.message, configError)
        }
      } else if (config) {
        if (config.auto_tags && Array.isArray(config.auto_tags)) {
          autoTags = config.auto_tags
          console.log('[TagManagement] ✅ Loaded auto_tags:', autoTags)
        }
        
        if (config.custom_tags && Array.isArray(config.custom_tags)) {
          customTags = config.custom_tags
          console.log('[TagManagement] ✅ Loaded custom_tags:', customTags)
          // Column exists - cache it
          customTagsColumnExistsRef.current = true
        }
      }

      // Combine used tags from assets, custom_tags (user-created tags), and auto_tags config
      // Tags from assets will persist, custom_tags ensures user-created tags show even if unused,
      // and auto_tags ensures AI-enabled tags show even if unused
      const allTags = new Set([
        ...tagCounts.keys(),      // Tags currently used in assets
        ...customTags,            // User-created tags (may not be used yet)
        ...autoTags,              // Tags with AI enabled (may not be used yet)
      ])
      console.log('[TagManagement] All unique tags (from assets + custom_tags + auto_tags):', Array.from(allTags))
      
      const tagConfigs: TagConfig[] = Array.from(allTags)
        .map((tag) => {
          const useWithAI = autoTags.includes(tag)
          return {
            name: tag,
            usageCount: tagCounts.get(tag) || 0,
            useWithAI,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      return tagConfigs
    },
  })

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!tags) return { total: 0, aiEnabled: 0, totalPhotos: 0 }
    const aiEnabled = tags.filter(t => t.useWithAI).length
    const totalPhotos = tags.reduce((sum, tag) => sum + tag.usageCount, 0)
    return {
      total: tags.length,
      aiEnabled,
      totalPhotos,
    }
  }, [tags])

  // Filter and sort tags
  const filteredTags = useMemo(() => {
    if (!tags) return []
    
    let result = [...tags]
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((tag) => tag.name.toLowerCase().includes(query))
    }
    
    // Apply filter option
    if (filterBy === 'ai-enabled') {
      result = result.filter(tag => tag.useWithAI)
    } else if (filterBy === 'unused') {
      result = result.filter(tag => tag.usageCount === 0)
    }
    
    // Apply sort
    if (sortBy === 'alphabetical') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'most-used') {
      result.sort((a, b) => b.usageCount - a.usageCount)
    } else if (sortBy === 'least-used') {
      result.sort((a, b) => a.usageCount - b.usageCount)
    } else if (sortBy === 'ai-enabled') {
      result.sort((a, b) => {
        if (a.useWithAI === b.useWithAI) {
          return a.name.localeCompare(b.name)
        }
        return a.useWithAI ? -1 : 1
      })
    }
    
    return result
  }, [tags, searchQuery, sortBy, filterBy])

  // Create new tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      if (!activeWorkspaceId) throw new Error('No active workspace')

      // Get existing custom_tags to append new tag
      // Only query if we haven't confirmed the column doesn't exist
      let currentCustomTags: string[] = []
      
      if (customTagsColumnExistsRef.current !== false) {
        // Try fetching custom_tags (like mobile app does)
        const { data: existingConfig, error: fetchError } = await supabase
          .from('tag_config')
          .select('custom_tags')
          .eq('workspace_id', activeWorkspaceId)
          .maybeSingle()

        if (existingConfig?.custom_tags && Array.isArray(existingConfig.custom_tags)) {
          currentCustomTags = existingConfig.custom_tags
          // Column exists - cache it
          customTagsColumnExistsRef.current = true
        } else if (fetchError) {
          // If error is about missing column, cache it
          if (
            fetchError.code === '42703' || // PostgreSQL: undefined column
            fetchError.code === '400' || 
            fetchError.message?.includes('custom_tags') || 
            fetchError.message?.includes('column') ||
            fetchError.message?.includes('does not exist')
          ) {
            customTagsColumnExistsRef.current = false
            console.log('[TagManagement] custom_tags column does not exist - tag will appear when used in an asset')
          }
        }
      } else {
        console.log('[TagManagement] Skipping custom_tags query - column does not exist (cached)')
      }

      // Add new tag to custom_tags (try optimistically - if column doesn't exist, we'll handle the error)
      // Note: New tags are NOT added to auto_tags by default (user must enable AI manually)
      // This matches mobile app behavior where new tags have isAutoTag: false
      const updatedCustomTags = currentCustomTags.includes(tagName)
        ? currentCustomTags
        : [...currentCustomTags, tagName]

      // Only try to save to custom_tags if column exists (or we don't know yet)
      if (customTagsColumnExistsRef.current !== false) {
        // Match mobile app: upsert ONLY custom_tags (not auto_tags) - simpler and more reliable
        // Mobile app does: upsert({ workspace_id, custom_tags }, { onConflict: 'workspace_id' })
        const { error: customTagsError } = await supabase
          .from('tag_config')
          .upsert(
            { 
              workspace_id: activeWorkspaceId, 
              custom_tags: updatedCustomTags 
            }, 
            { onConflict: 'workspace_id' }
          )

        if (customTagsError) {
          // Check if error is due to missing custom_tags column
          const isColumnMissingError = 
            customTagsError.code === '42703' || // PostgreSQL: undefined column
            customTagsError.code === '400' || 
            customTagsError.message?.includes('custom_tags') || 
            customTagsError.message?.includes('column') ||
            customTagsError.message?.includes('does not exist')
          
          if (isColumnMissingError) {
            // custom_tags column doesn't exist - cache this
            customTagsColumnExistsRef.current = false
            console.log('[TagManagement] ⚠️ custom_tags column does not exist - tag will appear once used in an asset')
            // Don't throw error - tag creation "succeeds" but won't persist until used
          } else {
            // Some other error - try update as fallback (like mobile app does)
            const { error: updateError } = await supabase
              .from('tag_config')
              .update({ custom_tags: updatedCustomTags })
              .eq('workspace_id', activeWorkspaceId)
            
            if (updateError) {
              throw updateError
            } else {
              customTagsColumnExistsRef.current = true
              console.log('[TagManagement] ✅ Tag created successfully and saved to custom_tags:', tagName)
            }
          }
        } else {
          // Success! Tag saved to custom_tags
          // Update cache to reflect that column exists
          customTagsColumnExistsRef.current = true
          console.log('[TagManagement] ✅ Tag created successfully and saved to custom_tags:', tagName)
        }
      } else {
        // Column doesn't exist - tag will appear when used in an asset
        console.log('[TagManagement] ⚠️ custom_tags column does not exist - tag will appear once used in an asset')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', activeWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['availableTags'] })
      setNewTagName('')
      setShowNewTagDialog(false)
      // Show success message
      setToast({
        message: 'Tag created successfully',
        type: 'success',
      })
      setTimeout(() => setToast(null), 3000)
    },
    onError: (error: any) => {
      console.error('[TagManagement] Tag creation failed:', error)
      setToast({
        message: `Failed to create tag: ${error.message || 'Unknown error'}`,
        type: 'error',
      })
      setTimeout(() => setToast(null), 4000)
    },
  })

  // Update tag name mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      if (!activeWorkspaceId) throw new Error('No active workspace')

      // Update tags in assets
      const { data: assets } = await supabase
        .from('assets')
        .select('id, tags')
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null)
        .contains('tags', [oldName])

      if (assets) {
        const updates = assets.map((asset) => {
          const updatedTags = (asset.tags || []).map((tag: string) =>
            tag === oldName ? newName : tag
          )
          return supabase
            .from('assets')
            .update({ tags: updatedTags })
            .eq('id', asset.id)
        })

        await Promise.all(updates)
      }

      // Update tag_config: rename in auto_tags and custom_tags
      let customTagsColumnExists = false
      
      // First fetch auto_tags (this column definitely exists)
      const { data: config, error: configError } = await supabase
        .from('tag_config')
        .select('auto_tags')
        .eq('workspace_id', activeWorkspaceId)
        .maybeSingle()

      if (config) {
        const updatedAutoTags = config.auto_tags && Array.isArray(config.auto_tags)
          ? config.auto_tags.map((tag: string) => tag === oldName ? newName : tag)
          : []
        
        // Try to fetch and update custom_tags separately (don't fail if column doesn't exist)
        // Skip query if we already know the column doesn't exist (cached as false)
        // Only query if we know it exists (true)
        let updatedCustomTags: string[] = []
        if (customTagsColumnExistsRef.current !== false) {
          // NOTE: Supabase queries return { data, error }, they don't throw exceptions
          const { data: customTagsConfig, error: customTagsError } = await supabase
            .from('tag_config')
            .select('custom_tags')
            .eq('workspace_id', activeWorkspaceId)
            .maybeSingle()
          
          // Check if error is due to missing column (400 Bad Request)
          const isColumnMissingError = customTagsError && (
            customTagsError.code === '400' ||
            customTagsError.message?.includes('400') ||
            customTagsError.message?.includes('custom_tags') ||
            customTagsError.code === '42703' ||
            (customTagsError.message?.includes('column') && customTagsError.message?.includes('does not exist'))
          )
          
          if (isColumnMissingError) {
            // custom_tags column doesn't exist - cache this to avoid future queries
            customTagsColumnExistsRef.current = false
            customTagsColumnExists = false
          } else if (customTagsConfig && 'custom_tags' in customTagsConfig) {
            customTagsColumnExistsRef.current = true
            customTagsColumnExists = true
            updatedCustomTags = customTagsConfig.custom_tags && Array.isArray(customTagsConfig.custom_tags)
              ? customTagsConfig.custom_tags.map((tag: string) => tag === oldName ? newName : tag)
              : []
          } else if (customTagsError) {
            console.warn('[TagManagement] Error fetching custom_tags:', customTagsError)
            customTagsColumnExists = false
          }
        } else {
          // Column doesn't exist (cached), skip query
          customTagsColumnExists = false
        }

        // Prepare upsert data - only include custom_tags if column exists
        const upsertData: any = {
          workspace_id: activeWorkspaceId,
          auto_tags: updatedAutoTags,
        }
        
        if (customTagsColumnExists) {
          upsertData.custom_tags = updatedCustomTags
        }

        // Try to save both, but handle gracefully if custom_tags column doesn't exist
        const { error: upsertError } = await supabase
          .from('tag_config')
          .upsert(upsertData, { onConflict: 'workspace_id' })
        
        // If upsert fails due to custom_tags column (400 error), try with just auto_tags
        if (upsertError && (
          upsertError.code === '400' || 
          upsertError.message?.includes('400') ||
          (upsertError.message?.includes('custom_tags') && customTagsColumnExists) || 
          upsertError.code === '42703'
        )) {
          await supabase
            .from('tag_config')
            .upsert(
              {
                workspace_id: activeWorkspaceId,
                auto_tags: updatedAutoTags,
              },
              { onConflict: 'workspace_id' }
            )
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', activeWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setEditingTag(null)
      setEditTagName('')
    },
  })

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      if (!activeWorkspaceId) throw new Error('No active workspace')

      // Remove tag from all assets
      const { data: assets } = await supabase
        .from('assets')
        .select('id, tags')
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null)
        .contains('tags', [tagName])

      if (assets && assets.length > 0) {
        const updates = assets.map((asset) => {
          const updatedTags = (asset.tags || []).filter((tag: string) => tag !== tagName)
          return supabase
            .from('assets')
            .update({ tags: updatedTags })
            .eq('id', asset.id)
        })

        await Promise.all(updates)
      }

      // Remove tag from tag_config (auto_tags and custom_tags)
      // First fetch auto_tags (this column definitely exists)
      const { data: config, error: configError } = await supabase
        .from('tag_config')
        .select('auto_tags')
        .eq('workspace_id', activeWorkspaceId)
        .maybeSingle()

      if (config) {
        const updatedAutoTags = config.auto_tags && Array.isArray(config.auto_tags)
          ? config.auto_tags.filter((tag: string) => tag !== tagName)
          : []
        
        // Try to fetch and update custom_tags separately (don't fail if column doesn't exist)
        let updatedCustomTags: string[] = []
        let customTagsColumnExists = false
        
        if (customTagsColumnExistsRef.current !== false) {
          const { data: customTagsConfig, error: customTagsError } = await supabase
            .from('tag_config')
            .select('custom_tags')
            .eq('workspace_id', activeWorkspaceId)
            .maybeSingle()
          
          // Check if error is due to missing column
          const isColumnMissingError = customTagsError && (
            customTagsError.code === '42703' ||
            customTagsError.code === '400' ||
            customTagsError.message?.includes('custom_tags') ||
            customTagsError.message?.includes('column') ||
            customTagsError.message?.includes('does not exist')
          )
          
          if (isColumnMissingError) {
            customTagsColumnExistsRef.current = false
            customTagsColumnExists = false
          } else if (customTagsConfig && 'custom_tags' in customTagsConfig) {
            customTagsColumnExistsRef.current = true
            customTagsColumnExists = true
            updatedCustomTags = customTagsConfig.custom_tags && Array.isArray(customTagsConfig.custom_tags)
              ? customTagsConfig.custom_tags.filter((tag: string) => tag !== tagName)
              : []
          }
        } else {
          customTagsColumnExists = false
        }
        
        // Prepare upsert data - only include custom_tags if column exists
        const upsertData: any = {
          workspace_id: activeWorkspaceId,
          auto_tags: updatedAutoTags,
        }
        
        if (customTagsColumnExists) {
          upsertData.custom_tags = updatedCustomTags
        }
        
        const { error: upsertError } = await supabase
          .from('tag_config')
          .upsert(upsertData, { onConflict: 'workspace_id' })

        // If upsert fails due to custom_tags column, try with just auto_tags
        if (upsertError && (
          upsertError.code === '42703' ||
          upsertError.code === '400' ||
          (upsertError.message?.includes('custom_tags') && customTagsColumnExists)
        )) {
          await supabase
            .from('tag_config')
            .upsert(
              { 
                workspace_id: activeWorkspaceId, 
                auto_tags: updatedAutoTags,
              },
              { onConflict: 'workspace_id' }
            )
        } else if (upsertError) {
          console.error('[TagsPage] Failed to remove tag from tag_config:', upsertError)
        }
      }
    },
    onSuccess: () => {
      // Invalidate and refetch all related queries to refresh data (matches library/stories delete pattern)
      queryClient.invalidateQueries({ queryKey: ['tags', activeWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['availableTags'] })
      
      // Explicitly refetch tags to update UI immediately
      queryClient.refetchQueries({ queryKey: ['tags', activeWorkspaceId] })
    },
    onError: (error: any) => {
      console.error('[TagsPage] Delete tag failed:', error)
      // Invalidate queries to ensure UI is in sync
      queryClient.invalidateQueries({ queryKey: ['tags', activeWorkspaceId] })
    },
  })

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    if (tags?.some((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      alert('This tag already exists')
      return
    }
    await withEditAccess(async () => {
      createTagMutation.mutate(newTagName.trim())
    })
  }

  const handleUpdateTag = async () => {
    if (!editingTag || !editTagName.trim()) return
    if (
      editTagName.trim() !== editingTag &&
      tags?.some((t) => t.name.toLowerCase() === editTagName.trim().toLowerCase())
    ) {
      alert('This tag already exists')
      return
    }
    await withEditAccess(async () => {
      updateTagMutation.mutate({ oldName: editingTag, newName: editTagName.trim() })
    })
  }

  const handleDeleteTag = async () => {
    if (!deleteTagName) return

    const tagToDelete = tags?.find(t => t.name === deleteTagName)
    if (!tagToDelete) return

    await withEditAccess(async () => {
      setIsDeleting(true)
      setDeleteProgress({ current: 0, total: 1 })

      try {
        // Store for undo (if needed)
        setDeletedTagForUndo(tagToDelete)
        setDeletedTagName(tagToDelete.name)

        // Delete the tag - mutation handles query invalidation on success
        await deleteTagMutation.mutateAsync(deleteTagName)
        setDeleteProgress({ current: 1, total: 1 })

        // Close delete dialog immediately
        setDeleteTagName(null)
        setIsDeleting(false)

        // Show success toast (matches library/stories delete pattern)
        setShowDeleteSuccess(true)

        // Auto-dismiss success notification after 3 seconds (matches library pattern)
        setTimeout(() => {
          setShowDeleteSuccess(false)
          setDeletedTagForUndo(null)
        }, 3000)

      } catch (error) {
        console.error('[TagsPage] Delete failed:', error)
        setIsDeleting(false)
        setToast({
          message: 'Failed to delete tag. Please try again.',
          type: 'error',
        })
        setTimeout(() => setToast(null), 4000)
      } finally {
        setDeleteProgress({ current: 0, total: 0 })
      }
    })
  }

  const handleUndoDelete = async () => {
    if (!deletedTagForUndo) return

    try {
      queryClient.setQueryData(['tags'], (oldData: TagConfig[] | undefined) => {
        if (!oldData) return [deletedTagForUndo]
        const restored = [...oldData, deletedTagForUndo]
        return restored.sort((a, b) => a.name.localeCompare(b.name))
      })

      setDeletedTagForUndo(null)
      setShowDeleteSuccess(false)

      queryClient.invalidateQueries({ queryKey: ['tags', activeWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['availableTags'] })

      alert('Tag restored. Note: If the tag was already removed from assets, you may need to re-add it manually.')
    } catch (error) {
      console.error('[TagsPage] Undo failed:', error)
      alert('Unable to restore deleted tag.')
    }
  }

  // Toggle AI usage for a tag - matches mobile app behavior exactly
  // Mobile app saves ALL tags where isAutoTag=true as an array
  const toggleAIMutation = useMutation({
    mutationFn: async ({ tagName, enabled }: { tagName: string; enabled: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      if (!activeWorkspaceId) throw new Error('No active workspace')

      // Read from cache AFTER onMutate has updated it optimistically
      // This ensures we have the correct updated state
      const optimisticTags = queryClient.getQueryData<TagConfig[]>(['tags', activeWorkspaceId]) || []
      
      if (!optimisticTags.length) {
        console.error('[TagManagement] ❌ No tags found in cache after optimistic update!')
        throw new Error('Failed to read tags from cache')
      }

      // Verify the tag we're toggling has the correct state
      const toggledTag = optimisticTags.find(t => t.name === tagName)
      if (!toggledTag) {
        console.error('[TagManagement] ❌ Tag not found in cache:', tagName)
        throw new Error(`Tag ${tagName} not found`)
      }
      if (toggledTag.useWithAI !== enabled) {
        console.error('[TagManagement] ❌ Cache state mismatch! Expected:', enabled, 'Got:', toggledTag.useWithAI)
        throw new Error('Cache state mismatch - optimistic update failed')
      }

      // Filter to ONLY tags where useWithAI is true (matches mobile app: filter where isAutoTag === true)
      const autoTags = optimisticTags.filter((t) => t.useWithAI).map((t) => t.name)

      console.log('[TagManagement] Saving auto_tags:', autoTags, 'for tag:', tagName, 'enabled:', enabled)
      console.log('[TagManagement] Tag state in cache:', toggledTag.useWithAI, 'Expected:', enabled)

      // Save the auto_tags array
      const { error } = await supabase
        .from('tag_config')
        .upsert(
          { workspace_id: activeWorkspaceId, auto_tags: autoTags },
          { onConflict: 'workspace_id' }
        )

      if (error) {
        console.error('[TagManagement] Upsert failed:', error)
        // Try insert/update fallback like mobile app
        const insertResult = await supabase
          .from('tag_config')
          .insert({ workspace_id: activeWorkspaceId, auto_tags: autoTags })
        
        if (insertResult.error) {
          if (insertResult.error.code === '23505' || insertResult.error.message?.includes('duplicate')) {
            const updateResult = await supabase
              .from('tag_config')
              .update({ auto_tags: autoTags })
              .eq('workspace_id', activeWorkspaceId)
            
            if (updateResult.error) {
              console.error('[TagManagement] Update failed:', updateResult.error)
              throw updateResult.error
            }
            console.log('[TagManagement] Update succeeded')
          } else {
            console.error('[TagManagement] Insert failed:', insertResult.error)
            throw insertResult.error
          }
        } else {
          console.log('[TagManagement] Insert succeeded')
        }
      } else {
        console.log('[TagManagement] Upsert succeeded')
      }

      // Verify the save by reading it back immediately
      const { data: verifyData, error: verifyError } = await supabase
        .from('tag_config')
        .select('auto_tags')
        .eq('workspace_id', activeWorkspaceId)
        .maybeSingle()

      if (verifyError) {
        console.error('[TagManagement] ❌ Verify read failed:', verifyError)
        throw new Error('Failed to verify database save')
      }
      
      if (!verifyData) {
        console.error('[TagManagement] ❌ Verify read returned no data')
        throw new Error('Failed to verify database save - no data returned')
      }

      const savedAutoTags = verifyData?.auto_tags || []
      const expectedAutoTags = optimisticTags.filter((t) => t.useWithAI).map((t) => t.name)
      
      if (JSON.stringify(savedAutoTags.sort()) !== JSON.stringify(expectedAutoTags.sort())) {
        console.error('[TagManagement] ❌ DATABASE MISMATCH!')
        console.error('[TagManagement] Expected:', expectedAutoTags)
        console.error('[TagManagement] Got from DB:', savedAutoTags)
        throw new Error('Database save verification failed - data mismatch')
      }

      console.log('[TagManagement] ✅ Verified: Database save matches expected state')

      return optimisticTags
    },
    onMutate: async ({ tagName, enabled }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tags', activeWorkspaceId] })

      // Snapshot the previous value using the correct query key
      const previousTags = queryClient.getQueryData<TagConfig[]>(['tags', activeWorkspaceId])

      if (!previousTags) {
        console.warn('[TagManagement] No previous tags found in cache')
        return { previousTags: null, optimisticTags: [] }
      }

      // Optimistically update to the new value
      const optimisticTags = previousTags.map((tag) =>
        tag.name === tagName ? { ...tag, useWithAI: enabled } : tag
      )

      console.log('[TagManagement] Optimistic update:', tagName, 'enabled:', enabled, 'new state:', optimisticTags.find(t => t.name === tagName)?.useWithAI)

      queryClient.setQueryData<TagConfig[]>(['tags', activeWorkspaceId], optimisticTags)

      // Return both previous and optimistic for use in mutationFn
      return { previousTags, optimisticTags }
    },
    onError: (err, variables, context) => {
      console.error('[TagManagement] Mutation error:', err)
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTags && activeWorkspaceId) {
        queryClient.setQueryData(['tags', activeWorkspaceId], context.previousTags)
      }
    },
    onSuccess: async () => {
      console.log('[TagManagement] Mutation success - keeping optimistic update')
      // DON'T refetch immediately - this causes race condition with DB replication lag
      // The optimistic update is already correct and matches what we saved to DB
      // Data will refresh naturally on next page load or manual refresh
    },
  })

  const handleToggleAI = async (tagName: string, enabled: boolean) => {
    await withEditAccess(async () => {
      setTogglingTag(tagName)

      toggleAIMutation.mutate(
        { tagName, enabled },
        {
          onSuccess: () => {
            setTogglingTag(null)
            setToast({
              message: `AI tagging ${enabled ? 'enabled' : 'disabled'} for "${tagName}"`,
              type: 'success',
            })
            setTimeout(() => setToast(null), 3000)
          },
          onError: () => {
            setTogglingTag(null)
            setToast({
              message: `Failed to ${enabled ? 'enable' : 'disable'} AI tagging for "${tagName}"`,
              type: 'error',
            })
            setTimeout(() => setToast(null), 4000)
          },
        }
      )
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Cmd/Ctrl + N: New tag
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setShowNewTagDialog(true)
      }

      // Cmd/Ctrl + A: Select all (when not in input)
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        if (filteredTags.length > 0) {
          setSelectedTags(new Set(filteredTags.map(t => t.name)))
        }
      }

      // Escape: Clear selection or close dialogs
      if (e.key === 'Escape') {
        if (selectedTags.size > 0) {
          setSelectedTags(new Set())
        } else if (showNewTagDialog) {
          setShowNewTagDialog(false)
        } else if (editingTag) {
          setEditingTag(null)
        } else if (deleteTagName) {
          setDeleteTagName(null)
        }
      }

      // /: Focus search
      if (e.key === '/' && !showNewTagDialog && !editingTag) {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder="Search tags..."]') as HTMLInputElement
        searchInput?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredTags, selectedTags, showNewTagDialog, editingTag, deleteTagName])

  // Bulk actions
  const handleBulkToggleAI = useCallback(async (enabled: boolean) => {
    if (selectedTags.size === 0) return

    await withEditAccess(async () => {
      const tagsToUpdate = Array.from(selectedTags)
      let successCount = 0
      let errorCount = 0

      for (const tagName of tagsToUpdate) {
        try {
          await toggleAIMutation.mutateAsync({ tagName, enabled })
          successCount++
        } catch (error) {
          errorCount++
        }
      }

      setSelectedTags(new Set())
      setToast({
        message: `${successCount} tag${successCount !== 1 ? 's' : ''} updated${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        type: errorCount > 0 ? 'error' : 'success',
      })
      setTimeout(() => setToast(null), 4000)
    })
  }, [selectedTags, toggleAIMutation, withEditAccess])

  const handleBulkDelete = useCallback(() => {
    if (selectedTags.size === 0) return
    // Show bulk delete confirmation dialog (matches single delete pattern)
    setBulkDeleteTags(new Set(selectedTags))
  }, [selectedTags])

  const confirmBulkDelete = useCallback(async () => {
    if (bulkDeleteTags.size === 0) return

    await withEditAccess(async () => {
      const tagsToDelete = Array.from(bulkDeleteTags)
      setIsDeleting(true)
      setDeleteProgress({ current: 0, total: tagsToDelete.length })

      try {
        let successCount = 0
        let errorCount = 0

        // Delete each tag sequentially
        for (let i = 0; i < tagsToDelete.length; i++) {
          try {
            await deleteTagMutation.mutateAsync(tagsToDelete[i])
            successCount++
          } catch (error) {
            console.error(`[TagsPage] Failed to delete tag ${tagsToDelete[i]}:`, error)
            errorCount++
          }
          setDeleteProgress({ current: i + 1, total: tagsToDelete.length })
        }

        // Close dialog and clear selection
        setBulkDeleteTags(new Set())
        setSelectedTags(new Set())
        setIsDeleting(false)

        // Show success toast
        if (successCount > 0) {
          setDeletedTagName(`${successCount} tag${successCount !== 1 ? 's' : ''}`)
          setShowDeleteSuccess(true)
          setTimeout(() => {
            setShowDeleteSuccess(false)
            setDeletedTagName('')
          }, 3000)
        }

        // Show error toast if any failed
        if (errorCount > 0) {
          setToast({
            message: `Failed to delete ${errorCount} tag${errorCount !== 1 ? 's' : ''}. Please try again.`,
            type: 'error',
          })
          setTimeout(() => setToast(null), 4000)
        }

      } catch (error) {
        console.error('[TagsPage] Bulk delete failed:', error)
        setIsDeleting(false)
        setToast({
          message: 'Failed to delete tags. Please try again.',
          type: 'error',
        })
        setTimeout(() => setToast(null), 4000)
      } finally {
        setDeleteProgress({ current: 0, total: 0 })
      }
    })
  }, [bulkDeleteTags, deleteTagMutation, withEditAccess])

  const handleToggleTagSelection = useCallback((tagName: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev)
      if (next.has(tagName)) {
        next.delete(tagName)
      } else {
        next.add(tagName)
      }
      return next
    })
  }, [])

  // Clear stuck pending assets mutation
  const clearPendingAssetsMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      if (!activeWorkspaceId) throw new Error('No active workspace')

      const { data: pendingAssets, error: countError } = await supabase
        .from('assets')
        .select('id', { count: 'exact' })
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null)
        .eq('auto_tag_status', 'pending')

      if (countError) {
        throw new Error(`Failed to count pending assets: ${countError.message || JSON.stringify(countError)}`)
      }

      const pendingCount = pendingAssets?.length || 0

      if (pendingCount === 0) {
        return { cleared: 0 }
      }

      const { data, error } = await supabase
        .from('assets')
        .update({ auto_tag_status: null })
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null)
        .eq('auto_tag_status', 'pending')
        .select('id')

      if (error) {
        throw new Error(`Failed to clear pending assets: ${error.message || JSON.stringify(error)}`)
      }

      return { cleared: data?.length || 0 }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset'] })
      alert(`Cleared ${data.cleared} stuck pending asset${data.cleared !== 1 ? 's' : ''}`)
    },
    onError: (error) => {
      console.error('[TagManagement] Failed to clear pending assets:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`Failed to clear pending assets: ${errorMessage}`)
    },
  })

  return (
    <div className="flex h-full flex-col bg-background" style={{ backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <MobileMenuButton />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                  Tag Management
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                  {summaryStats.total > 0 ? (
                    <>
                      {summaryStats.total} {summaryStats.total === 1 ? 'tag' : 'tags'}
                      {summaryStats.aiEnabled > 0 && (
                        <> • {summaryStats.aiEnabled} using AI</>
                      )}
                      {summaryStats.totalPhotos > 0 && (
                        <> • {summaryStats.totalPhotos} {summaryStats.totalPhotos === 1 ? 'photo' : 'photos'} tagged</>
                      )}
                    </>
                  ) : (
                    'Organize your content taxonomy'
                  )}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowNewTagDialog(true)}
              className="h-9 px-4 text-sm font-semibold bg-accent hover:bg-accent/90 shadow-sm rounded-lg w-full sm:w-auto shrink-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Tag
            </Button>
          </div>
          
          {/* Search and Filters Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 w-full sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 sm:h-9 text-sm border-gray-300 focus:border-accent focus:ring-accent rounded-lg"
              />
              {searchQuery && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hidden sm:inline">
                  {filteredTags.length} {filteredTags.length === 1 ? 'result' : 'results'}
                </span>
              )}
            </div>
            
            {/* Sort and Filter Dropdowns */}
            <div className="flex gap-3 sm:flex-shrink-0">
              {/* Sort Dropdown */}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm border-gray-300 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  <SelectItem value="most-used">Most Used</SelectItem>
                  <SelectItem value="least-used">Least Used</SelectItem>
                  <SelectItem value="ai-enabled">AI Enabled</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Filter Dropdown */}
              <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterOption)}>
                <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm border-gray-300 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-gray-400" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  <SelectItem value="ai-enabled">AI Enabled</SelectItem>
                  <SelectItem value="unused">Unused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Mobile search results count */}
          {searchQuery && (
            <div className="mt-2 sm:hidden text-xs text-gray-500">
              {filteredTags.length} {filteredTags.length === 1 ? 'result' : 'results'}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {isLoading ? (
            <div className="flex h-48 sm:h-64 items-center justify-center py-8">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-accent border-r-transparent"></div>
                <p className="text-sm text-gray-500 mt-4">Loading tags...</p>
              </div>
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="flex flex-1 items-center justify-center min-h-[400px] sm:min-h-[500px] py-8">
              <div className="text-center max-w-lg px-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 mb-6 sm:mb-8 animate-in zoom-in-95 duration-500">
                  <Tag className="h-10 w-10 sm:h-12 sm:w-12 text-accent" />
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
                  {searchQuery || filterBy !== 'all' ? 'No tags found' : 'Start organizing with tags'}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8 leading-relaxed px-2">
                  {searchQuery 
                    ? `No tags match "${searchQuery}". Try a different search term or clear your filters.`
                    : filterBy === 'ai-enabled'
                    ? 'No tags are currently using AI. Enable AI tagging for any tag to get started.'
                    : filterBy === 'unused'
                    ? 'All your tags are being used! Great job organizing your content.'
                    : 'Tags are the foundation of StoryStack. Create tags to organize your photos, enable AI-powered auto-tagging, and find content instantly.'}
                </p>
                {!searchQuery && filterBy === 'all' && (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center px-2">
                    <Button
                      onClick={() => setShowNewTagDialog(true)}
                      className="h-11 px-6 text-sm font-semibold bg-accent hover:bg-accent/90 shadow-sm hover:shadow-md transition-all duration-200 rounded-lg w-full sm:w-auto"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create your first tag
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const searchInput = document.querySelector('input[placeholder="Search tags..."]') as HTMLInputElement
                        searchInput?.focus()
                      }}
                      className="h-11 px-6 text-sm font-medium rounded-lg w-full sm:w-auto"
                    >
                      <Search className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Press / to search</span>
                      <span className="sm:hidden">Search tags</span>
                    </Button>
                  </div>
                )}
                {searchQuery && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('')
                      setFilterBy('all')
                    }}
                    className="h-10 px-5 text-sm font-medium rounded-lg mt-4"
                  >
                    Clear search and filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Bulk Action Bar */}
              {selectedTags.size > 0 && (
                <div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200 max-w-md sm:max-w-none sm:w-auto mx-auto">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3">
                    <span className="text-sm font-semibold text-gray-900 text-center sm:text-left sm:mr-2">
                      {selectedTags.size} {selectedTags.size === 1 ? 'tag' : 'tags'} selected
                    </span>
                    <div className="hidden sm:block h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-2 sm:flex-row">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkToggleAI(true)}
                        disabled={toggleAIMutation.isPending}
                        className="h-9 sm:h-8 px-3 text-xs font-medium flex-1 sm:flex-initial"
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Enable AI
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkToggleAI(false)}
                        disabled={toggleAIMutation.isPending}
                        className="h-9 sm:h-8 px-3 text-xs font-medium flex-1 sm:flex-initial"
                      >
                        Disable AI
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkDelete}
                        className="h-9 sm:h-8 px-3 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 flex-1 sm:flex-initial"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedTags(new Set())}
                        className="h-9 sm:h-8 w-9 sm:w-8 p-0 text-gray-500 hover:text-gray-700 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-200">
                  {filteredTags.map((tag, index) => {
                    const isSelected = selectedTags.has(tag.name)
                    return (
                      <div
                        key={tag.name}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 transition-all duration-200 group animate-in fade-in slide-in-from-left-2 ${
                          isSelected 
                            ? 'bg-accent/5 border-l-2 border-l-accent' 
                            : 'hover:bg-gray-50/80'
                        }`}
                        style={{
                          animationDelay: `${Math.min(index * 15, 300)}ms`,
                        }}
                      >
                        <div className="flex items-center gap-3 sm:gap-5 flex-1 min-w-0 mb-3 sm:mb-0">
                          {/* Selection Checkbox */}
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleTagSelection(tag.name)}
                            className="h-5 w-5 sm:h-4 sm:w-4 flex-shrink-0"
                          />

                          {/* Tag Icon */}
                          <div className={`flex-shrink-0 h-10 w-10 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center transition-colors ${
                            tag.useWithAI 
                              ? 'bg-accent/10 text-accent' 
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            <Tag className="h-5 w-5" />
                          </div>
                          
                          {/* Tag Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-1 sm:mb-1.5">
                              <h3 className="text-base font-semibold text-gray-900 break-words sm:truncate">{tag.name}</h3>
                              {tag.useWithAI && (
                                <Badge variant="secondary" className="bg-accent/10 text-accent border-0 text-xs font-medium px-2 py-0.5 shrink-0">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  AI
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              Used in <span className="font-medium text-gray-900">{tag.usageCount}</span> {tag.usageCount === 1 ? 'photo' : 'photos'}
                            </p>
                          </div>
                        </div>
                          
                        {/* Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pl-8 sm:pl-0">
                          {/* AI Toggle */}
                          <label className={`flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors flex-1 sm:flex-initial ${
                            togglingTag === tag.name ? 'cursor-wait' : 'cursor-pointer'
                          }`}>
                            {togglingTag === tag.name ? (
                              <Loader2 className="h-4 w-4 animate-spin text-accent shrink-0" />
                            ) : (
                              <Checkbox
                                checked={tag.useWithAI}
                                onCheckedChange={(checked) => handleToggleAI(tag.name, checked === true)}
                                disabled={togglingTag !== null}
                                className="h-4 w-4 shrink-0"
                              />
                            )}
                            <span className="text-xs sm:text-sm text-gray-700 flex items-center gap-1.5 font-medium whitespace-nowrap">
                              <Sparkles className={`h-3.5 w-3.5 shrink-0 ${tag.useWithAI ? 'text-accent' : 'text-gray-400'}`} />
                              <span className="hidden sm:inline">Use with AI</span>
                              <span className="sm:hidden">AI</span>
                            </span>
                          </label>
                          
                          {/* Actions Menu */}
                          <Popover open={openMenuTag === tag.name} onOpenChange={(open) => setOpenMenuTag(open ? tag.name : null)}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
                              >
                                <MoreVertical className="h-4 w-4 text-gray-600" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" align="end">
                              <div className="space-y-0.5">
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start text-sm font-normal h-9 px-3"
                                  onClick={() => {
                                    setEditingTag(tag.name)
                                    setEditTagName(tag.name)
                                    setOpenMenuTag(null)
                                  }}
                                >
                                  <Edit2 className="h-4 w-4 mr-2 text-gray-600" />
                                  Edit Tag
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start text-sm font-normal h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setDeleteTagName(tag.name)
                                    setOpenMenuTag(null)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Tag
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Tag Dialog */}
      <Dialog open={showNewTagDialog} onOpenChange={setShowNewTagDialog}>
        <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-semibold">Create New Tag</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-gray-600">
              Add a new tag to organize your photos. Tags help you find and categorize content quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Enter tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateTag()
                }
              }}
              autoFocus
              className="h-11 text-base border-gray-300 focus:border-accent focus:ring-accent rounded-lg"
            />
            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewTagDialog(false)
                  setNewTagName('')
                }}
                className="h-10 px-5 rounded-lg w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || createTagMutation.isPending}
                className="h-10 px-5 font-semibold bg-accent hover:bg-accent/90 rounded-lg w-full sm:w-auto"
              >
                {createTagMutation.isPending ? 'Creating...' : 'Create Tag'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-semibold">Edit Tag</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-gray-600">
              Rename this tag. All photos using this tag will be updated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Enter tag name"
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateTag()
                }
              }}
              autoFocus
              className="h-11 text-base border-gray-300 focus:border-accent focus:ring-accent rounded-lg"
            />
            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTag(null)
                  setEditTagName('')
                }}
                className="h-10 px-5 rounded-lg w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTag}
                disabled={!editTagName.trim() || updateTagMutation.isPending}
                className="h-10 px-5 font-semibold bg-accent hover:bg-accent/90 rounded-lg w-full sm:w-auto"
              >
                {updateTagMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTagName && !isDeleting} onOpenChange={() => !isDeleting && setDeleteTagName(null)}>
        <AlertDialogContent className="sm:max-w-md mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 mb-2">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <AlertDialogTitle className="text-lg sm:text-xl font-semibold text-gray-900">
                  Delete Tag?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs sm:text-sm text-gray-600 mt-2 sm:pl-0">
                  This will remove the tag &quot;{deleteTagName}&quot; from all photos. This action cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
            <AlertDialogCancel className="mt-0 h-10 px-5 rounded-lg w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              className="bg-red-600 hover:bg-red-700 text-white h-10 px-5 rounded-lg font-semibold w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Tags Dialog */}
      <AlertDialog open={bulkDeleteTags.size > 0 && !isDeleting} onOpenChange={(open) => !open && setBulkDeleteTags(new Set())}>
        <AlertDialogContent className="sm:max-w-md mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 mb-2">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <AlertDialogTitle className="text-lg sm:text-xl font-semibold text-gray-900">
                  Delete {bulkDeleteTags.size} Tag{bulkDeleteTags.size !== 1 ? 's' : ''}?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs sm:text-sm text-gray-600 mt-2 sm:pl-0">
                  This will remove {bulkDeleteTags.size === 1 ? 'this tag' : 'these tags'} from all photos. This action cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
            <AlertDialogCancel className="mt-0 h-10 px-5 rounded-lg w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white h-10 px-5 rounded-lg font-semibold w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {bulkDeleteTags.size} Tag{bulkDeleteTags.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Progress Dialog */}
      {isDeleting && (
        <AlertDialog open={isDeleting}>
          <AlertDialogContent className="sm:max-w-md mx-4 sm:mx-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg sm:text-xl font-semibold text-gray-900">
                Deleting Tag...
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm text-gray-600 mt-2">
                Please wait while we remove this tag from all photos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-red-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${(deleteProgress.current / deleteProgress.total) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {deleteProgress.current} of {deleteProgress.total} completed
              </p>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Success Toast - Matches library/stories delete pattern */}
      {showDeleteSuccess && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 animate-in slide-in-from-top-5 fade-in-0">
          <div className="mx-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                Tag deleted
              </p>
              <p className="text-xs text-gray-600 mt-0.5 break-words">
                &quot;{deletedTagName}&quot; has been removed from all photos
              </p>
            </div>
            {deletedTagForUndo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndoDelete}
                className="h-8 px-3 text-xs font-medium text-accent hover:text-accent/80 hover:bg-accent/5 flex-shrink-0 rounded-lg"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                Undo
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200 max-w-sm sm:max-w-none sm:min-w-[320px]">
          <div className={`rounded-lg border shadow-lg p-4 flex items-start gap-3 ${
            toast.type === 'success' 
              ? 'bg-white border-green-200' 
              : toast.type === 'error'
              ? 'bg-white border-red-200'
              : 'bg-white border-blue-200'
          }`}>
            <div className={`flex-shrink-0 h-5 w-5 mt-0.5 ${
              toast.type === 'success'
                ? 'text-green-600'
                : toast.type === 'error'
                ? 'text-red-600'
                : 'text-blue-600'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : toast.type === 'error' ? (
                <X className="h-5 w-5" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
            </div>
            <p className="text-sm font-medium text-gray-900 flex-1 break-words">{toast.message}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setToast(null)}
              className="h-6 w-6 text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
