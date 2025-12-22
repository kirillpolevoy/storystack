'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Search, Edit2, Trash2, Tag, Sparkles, RefreshCw, CheckCircle2, Undo2 } from 'lucide-react'
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

type TagConfig = {
  name: string
  usageCount: number
  useWithAI: boolean
}

export default function TagsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [deleteTagName, setDeleteTagName] = useState<string | null>(null)
  const [showNewTagDialog, setShowNewTagDialog] = useState(false)
  
  // Premium delete flow state
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 })
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false)
  const [deletedTagName, setDeletedTagName] = useState('')
  const [deletedTagForUndo, setDeletedTagForUndo] = useState<TagConfig | null>(null)
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get active workspace ID
  const activeWorkspaceId = typeof window !== 'undefined' 
    ? localStorage.getItem('@storystack:active_workspace_id')
    : null

  // Fetch all tags with usage counts
  const { data: tags, isLoading, refetch } = useQuery({
    queryKey: ['tags', activeWorkspaceId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      if (!activeWorkspaceId) {
        console.log('[TagManagement] No active workspace, returning empty tags')
        return []
      }

      console.log('[TagManagement] Fetching tags for workspace:', activeWorkspaceId)

      // Get all assets with tags from the active workspace
      const { data: assets, error } = await supabase
        .from('assets')
        .select('tags')
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null) // Exclude soft-deleted assets

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

      // Get tag config (auto_tags for AI) for the active workspace
      // Note: custom_tags column doesn't exist in tag_config table, only auto_tags
      let autoTags: string[] = []
      
      console.log('[TagManagement] Fetching tag_config for workspace:', activeWorkspaceId)
      const { data: config, error: configError } = await supabase
        .from('tag_config')
        .select('auto_tags')
        .eq('workspace_id', activeWorkspaceId)
        .single()

      console.log('[TagManagement] Query result - data:', config, 'error:', configError)

      if (configError) {
        // PGRST116 means no rows found - this is OK for new users
        if (configError.code === 'PGRST116') {
          console.log('[TagManagement] No tag_config found for user (new user) - this is OK')
        } else {
          console.error('[TagManagement] Config fetch error:', configError.code, configError.message, configError)
        }
      } else {
        console.log('[TagManagement] Config fetched successfully:', JSON.stringify(config, null, 2))
        
        if (config?.auto_tags && Array.isArray(config.auto_tags)) {
          autoTags = config.auto_tags
          console.log('[TagManagement] ✅ Loaded auto_tags:', autoTags)
          console.log('[TagManagement] ✅ Number of AI-enabled tags:', autoTags.length)
          console.log('[TagManagement] ✅ AI-enabled tag names:', autoTags)
        } else {
          console.warn('[TagManagement] ⚠️ auto_tags is null/undefined/not an array')
          console.warn('[TagManagement] ⚠️ config.auto_tags value:', config?.auto_tags)
          console.warn('[TagManagement] ⚠️ config.auto_tags type:', typeof config?.auto_tags)
          console.warn('[TagManagement] ⚠️ Is array?', Array.isArray(config?.auto_tags))
        }
      }

      // Combine used tags from assets AND tags from auto_tags config (even if they have 0 photos)
      const allTags = new Set([...tagCounts.keys(), ...autoTags])
      console.log('[TagManagement] All unique tags (from assets + config):', Array.from(allTags))
      
      const tagConfigs: TagConfig[] = Array.from(allTags)
        .map((tag) => {
          const useWithAI = autoTags.includes(tag)
          if (useWithAI) {
            console.log(`[TagManagement] ✅ Tag "${tag}" is enabled for AI`)
          }
          return {
            name: tag,
            usageCount: tagCounts.get(tag) || 0, // Will be 0 if tag is only in auto_tags
            useWithAI,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      const enabledCount = tagConfigs.filter(t => t.useWithAI).length
      console.log('[TagManagement] Final tag configs - Total:', tagConfigs.length, 'AI-enabled:', enabledCount)
      console.log('[TagManagement] AI-enabled tags:', tagConfigs.filter(t => t.useWithAI).map(t => t.name))

      return tagConfigs
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache
  })

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!tags) return []
    if (!searchQuery.trim()) return tags
    const query = searchQuery.toLowerCase()
    return tags.filter((tag) => tag.name.toLowerCase().includes(query))
  }, [tags, searchQuery])

  // Create new tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('@storystack:active_workspace_id')
        : null

      if (!activeWorkspaceId) throw new Error('No active workspace')

      // Get current tag_config to preserve existing auto_tags
      const { data: existingConfig } = await supabase
        .from('tag_config')
        .select('auto_tags')
        .eq('workspace_id', activeWorkspaceId)
        .single()

      const currentAutoTags = existingConfig?.auto_tags && Array.isArray(existingConfig.auto_tags) 
        ? existingConfig.auto_tags 
        : []

      // Add new tag to auto_tags if it doesn't already exist
      if (!currentAutoTags.includes(tagName)) {
        const updatedAutoTags = [...currentAutoTags, tagName].sort()

        // Upsert tag_config with the new tag added to auto_tags
        const { error } = await supabase
          .from('tag_config')
          .upsert(
            { 
              workspace_id: activeWorkspaceId, 
              auto_tags: updatedAutoTags 
            },
            { onConflict: 'workspace_id' }
          )

        if (error) {
          // Try insert/update fallback
          const insertResult = await supabase
            .from('tag_config')
            .insert({ workspace_id: activeWorkspaceId, auto_tags: updatedAutoTags })
          
          if (insertResult.error) {
            if (insertResult.error.code === '23505' || insertResult.error.message?.includes('duplicate')) {
              const updateResult = await supabase
                .from('tag_config')
                .update({ auto_tags: updatedAutoTags })
                .eq('workspace_id', activeWorkspaceId)
              
              if (updateResult.error) {
                throw updateResult.error
              }
            } else {
              throw insertResult.error
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['availableTags'] })
      setNewTagName('')
      setShowNewTagDialog(false)
    },
  })

  // Update tag name mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('@storystack:active_workspace_id')
        : null

      if (!activeWorkspaceId) throw new Error('No active workspace')

      // Update all assets that use this tag
      const { data: assets } = await supabase
        .from('assets')
        .select('id, tags')
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null) // Exclude soft-deleted assets
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

      // Note: custom_tags column doesn't exist in tag_config table
      // Tag renaming updates assets directly, no need to update custom_tags
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
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

      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('@storystack:active_workspace_id')
        : null

      if (!activeWorkspaceId) throw new Error('No active workspace')

      // Remove tag from all assets
      const { data: assets } = await supabase
        .from('assets')
        .select('id, tags')
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null) // Exclude soft-deleted assets
        .contains('tags', [tagName])

      if (assets) {
        const updates = assets.map((asset) => {
          const updatedTags = (asset.tags || []).filter((tag: string) => tag !== tagName)
          return supabase
            .from('assets')
            .update({ tags: updatedTags })
            .eq('id', asset.id)
        })

        await Promise.all(updates)
      }

      // Remove tag from tag_config.auto_tags if it exists there
      const { data: config } = await supabase
        .from('tag_config')
        .select('auto_tags')
        .eq('workspace_id', activeWorkspaceId)
        .single()

      if (config?.auto_tags && Array.isArray(config.auto_tags)) {
        const updatedAutoTags = config.auto_tags.filter((tag: string) => tag !== tagName)
        
        // Update tag_config with the tag removed
        const { error: configError } = await supabase
          .from('tag_config')
          .upsert(
            { workspace_id: activeWorkspaceId, auto_tags: updatedAutoTags },
            { onConflict: 'workspace_id' }
          )

        if (configError) {
          console.error('[TagsPage] Failed to remove tag from auto_tags:', configError)
          // Don't throw - tag removal from assets is more important
        }
      }
    },
  })

  const handleCreateTag = () => {
    if (!newTagName.trim()) return
    if (tags?.some((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      alert('This tag already exists')
      return
    }
    createTagMutation.mutate(newTagName.trim())
  }

  const handleUpdateTag = () => {
    if (!editingTag || !editTagName.trim()) return
    if (
      editTagName.trim() !== editingTag &&
      tags?.some((t) => t.name.toLowerCase() === editTagName.trim().toLowerCase())
    ) {
      alert('This tag already exists')
      return
    }
    updateTagMutation.mutate({ oldName: editingTag, newName: editTagName.trim() })
  }

  const handleDeleteTag = async () => {
    if (!deleteTagName) return

    const tagToDelete = tags?.find(t => t.name === deleteTagName)
    if (!tagToDelete) return

    setIsDeleting(true)
    setDeleteProgress({ current: 0, total: 1 })

    try {
      // Optimistic update - remove from UI immediately
      queryClient.setQueryData(['tags'], (oldData: TagConfig[] | undefined) => {
        if (!oldData) return oldData
        return oldData.filter((tag) => tag.name !== deleteTagName)
      })

      // Store for undo
      setDeletedTagForUndo(tagToDelete)
      setDeletedTagName(tagToDelete.name)

      // Delete tag
      await deleteTagMutation.mutateAsync(deleteTagName)
      setDeleteProgress({ current: 1, total: 1 })

      // Show success notification
      setShowDeleteSuccess(true)

      // Auto-dismiss success notification after 5 seconds
      setTimeout(() => {
        setShowDeleteSuccess(false)
        setDeletedTagForUndo(null)
      }, 5000)

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['availableTags'] })

    } catch (error) {
      console.error('[TagsPage] Delete failed:', error)

      // Rollback optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['tags'] })

      alert('Failed to delete tag. Please try again.')
    } finally {
      setIsDeleting(false)
      setDeleteProgress({ current: 0, total: 0 })
      setDeleteTagName(null)
    }
  }

  const handleUndoDelete = async () => {
    if (!deletedTagForUndo) return

    try {
      // Restore tag optimistically
      queryClient.setQueryData(['tags'], (oldData: TagConfig[] | undefined) => {
        if (!oldData) return [deletedTagForUndo]
        const restored = [...oldData, deletedTagForUndo]
        return restored.sort((a, b) => a.name.localeCompare(b.name))
      })

      setDeletedTagForUndo(null)
      setShowDeleteSuccess(false)

      // Refresh to sync with server
      queryClient.invalidateQueries({ queryKey: ['tags'] })
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

      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('@storystack:active_workspace_id')
        : null

      // Read optimistic tags from cache (onMutate has already updated it)
      const optimisticTags = queryClient.getQueryData<TagConfig[]>(['tags']) || []
      
      if (!optimisticTags.length) {
        console.warn('[TagManagement] No tags found in cache, using empty array')
      }

      // Filter to ONLY tags where useWithAI is true (matches mobile app: filter where isAutoTag === true)
      const autoTags = optimisticTags.filter((t) => t.useWithAI).map((t) => t.name)

      console.log('[TagManagement] Saving auto_tags:', autoTags, 'for tag:', tagName, 'enabled:', enabled)

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

      // Verify the save by reading it back
      const { data: verifyData, error: verifyError } = await supabase
        .from('tag_config')
        .select('auto_tags')
        .eq('workspace_id', activeWorkspaceId)
        .single()

      if (verifyError) {
        console.error('[TagManagement] Verify read failed:', verifyError)
      } else {
        console.log('[TagManagement] Verified auto_tags in DB:', verifyData?.auto_tags)
      }

      return optimisticTags
    },
    onMutate: async ({ tagName, enabled }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tags'] })

      // Snapshot the previous value
      const previousTags = queryClient.getQueryData<TagConfig[]>(['tags'])

      if (!previousTags) {
        console.warn('[TagManagement] No previous tags found in cache')
        return { previousTags: null, optimisticTags: [] }
      }

      // Optimistically update to the new value
      const optimisticTags = previousTags.map((tag) =>
        tag.name === tagName ? { ...tag, useWithAI: enabled } : tag
      )

      console.log('[TagManagement] Optimistic update:', tagName, 'enabled:', enabled, 'new state:', optimisticTags.find(t => t.name === tagName)?.useWithAI)

      queryClient.setQueryData<TagConfig[]>(['tags'], optimisticTags)

      // Return both previous and optimistic for use in mutationFn
      return { previousTags, optimisticTags }
    },
    onError: (err, variables, context) => {
      console.error('[TagManagement] Mutation error:', err)
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTags) {
        queryClient.setQueryData(['tags'], context.previousTags)
      }
    },
    onSuccess: async (data, variables, context) => {
      console.log('[TagManagement] Mutation success, invalidating and refetching tags')
      // Invalidate first to clear cache
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      // Small delay to ensure DB write has propagated
      await new Promise(resolve => setTimeout(resolve, 200))
      // Force refetch to get latest data
      await queryClient.refetchQueries({ queryKey: ['tags'], exact: true })
    },
  })

  const handleToggleAI = (tagName: string, enabled: boolean) => {
    toggleAIMutation.mutate({ tagName, enabled })
  }

  // Clear stuck pending assets mutation
  const clearPendingAssetsMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('@storystack:active_workspace_id')
        : null

      if (!activeWorkspaceId) throw new Error('No active workspace')

      console.log('[TagManagement] Clearing pending assets for workspace:', activeWorkspaceId)

      // First, check how many pending assets exist
      const { data: pendingAssets, error: countError } = await supabase
        .from('assets')
        .select('id', { count: 'exact' })
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null) // Exclude soft-deleted assets
        .eq('auto_tag_status', 'pending')

      if (countError) {
        console.error('[TagManagement] Error counting pending assets:', countError)
        throw new Error(`Failed to count pending assets: ${countError.message || JSON.stringify(countError)}`)
      }

      const pendingCount = pendingAssets?.length || 0
      console.log('[TagManagement] Found', pendingCount, 'pending assets')

      if (pendingCount === 0) {
        return { cleared: 0 }
      }

      // Clear all pending assets for this workspace
      const { data, error } = await supabase
        .from('assets')
        .update({ auto_tag_status: null })
        .eq('workspace_id', activeWorkspaceId)
        .is('deleted_at', null) // Exclude soft-deleted assets
        .eq('auto_tag_status', 'pending')
        .select('id')

      if (error) {
        console.error('[TagManagement] Error clearing pending assets:', error)
        console.error('[TagManagement] Error details:', JSON.stringify(error, null, 2))
        throw new Error(`Failed to clear pending assets: ${error.message || JSON.stringify(error)}`)
      }

      const clearedCount = data?.length || 0
      console.log('[TagManagement] Cleared', clearedCount, 'pending assets')

      return { cleared: clearedCount }
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
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-gray-200 bg-white">
        <div className="px-8 pt-4">
          {/* Row 1: Title + Actions */}
          <div className="flex items-center justify-between pb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                Tag Management
              </h1>
              <p className="text-sm text-gray-500 mt-1">Organize your content taxonomy</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => clearPendingAssetsMutation.mutate()}
                disabled={clearPendingAssetsMutation.isPending}
                className="h-9 px-4 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${clearPendingAssetsMutation.isPending ? 'animate-spin' : ''}`} />
                Clear Stuck Pending
              </Button>
              <Button
                onClick={() => setShowNewTagDialog(true)}
                className="h-9 px-4 text-sm font-semibold bg-accent hover:bg-accent/90 shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Tag
              </Button>
            </div>
          </div>
          {/* Row 2: Search */}
          <div className="relative pb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Loading tags...</p>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center max-w-md">
              <Tag className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="mb-6 text-xl font-semibold text-foreground">
                {searchQuery ? 'No tags found' : 'No tags yet'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setShowNewTagDialog(true)}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Create your first tag
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredTags.map((tag) => (
                <div
                  key={tag.name}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{tag.name}</h3>
                        {tag.useWithAI && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-0 text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Used in {tag.usageCount} {tag.usageCount === 1 ? 'photo' : 'photos'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={tag.useWithAI}
                          onCheckedChange={(checked) => handleToggleAI(tag.name, checked === true)}
                          disabled={toggleAIMutation.isPending}
                          className="h-4 w-4"
                        />
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Use with AI
                        </span>
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingTag(tag.name)
                          setEditTagName(tag.name)
                        }}
                        className="h-8 w-8"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTagName(tag.name)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Tag Dialog */}
      <Dialog open={showNewTagDialog} onOpenChange={setShowNewTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>Add a new tag to organize your photos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateTag()
                }
              }}
              autoFocus
            />
            <div className="flex gap-4 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewTagDialog(false)
                  setNewTagName('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || createTagMutation.isPending}
              >
                {createTagMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>Rename this tag. All photos using this tag will be updated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Tag name"
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateTag()
                }
              }}
              autoFocus
            />
            <div className="flex gap-4 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTag(null)
                  setEditTagName('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTag}
                disabled={!editTagName.trim() || updateTagMutation.isPending}
              >
                {updateTagMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTagName && !isDeleting} onOpenChange={() => !isDeleting && setDeleteTagName(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                  Delete Tag?
                </AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="text-sm text-gray-600 mt-2">
              This will remove the tag &quot;{deleteTagName}&quot; from all photos. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Progress Dialog */}
      {isDeleting && (
        <AlertDialog open={isDeleting}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                Deleting Tag...
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600 mt-2">
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

      {/* Delete Success Toast */}
      {showDeleteSuccess && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 fade-in-0 duration-300">
          <div className="rounded-lg border border-gray-200 bg-white shadow-lg p-4 min-w-[320px]">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  Tag deleted
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  &quot;{deletedTagName}&quot; has been removed from all photos
                </p>
              </div>
              {deletedTagForUndo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndoDelete}
                  className="h-8 px-3 text-xs font-medium text-accent hover:text-accent/80 hover:bg-accent/5 flex-shrink-0"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                  Undo
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

