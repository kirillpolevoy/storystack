'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Search, Edit2, Trash2, Tag, Sparkles, RefreshCw } from 'lucide-react'
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
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch all tags with usage counts
  const { data: tags, isLoading, refetch } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      console.log('[TagManagement] Fetching tags for user:', user.id)

      // Get all assets with tags
      const { data: assets, error } = await supabase
        .from('assets')
        .select('tags')
        .eq('user_id', user.id)

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

      // Get tag config (auto_tags for AI)
      // Note: custom_tags column doesn't exist in tag_config table, only auto_tags
      let autoTags: string[] = []
      
      console.log('[TagManagement] Fetching tag_config for user:', user.id)
      const { data: config, error: configError } = await supabase
        .from('tag_config')
        .select('auto_tags')
        .eq('user_id', user.id)
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

      // Combine used tags (custom_tags column doesn't exist, so we only use tags from assets)
      const allTags = new Set([...tagCounts.keys()])
      console.log('[TagManagement] All unique tags:', Array.from(allTags))
      
      const tagConfigs: TagConfig[] = Array.from(allTags)
        .map((tag) => {
          const useWithAI = autoTags.includes(tag)
          if (useWithAI) {
            console.log(`[TagManagement] ✅ Tag "${tag}" is enabled for AI`)
          }
          return {
            name: tag,
            usageCount: tagCounts.get(tag) || 0,
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
    cacheTime: 0, // Don't cache
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

      // Note: custom_tags column doesn't exist in tag_config table
      // Tags are automatically discovered from assets, so no need to save custom_tags
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
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

      // Update all assets that use this tag
      const { data: assets } = await supabase
        .from('assets')
        .select('id, tags')
        .eq('user_id', user.id)
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

      // Remove tag from all assets
      const { data: assets } = await supabase
        .from('assets')
        .select('id, tags')
        .eq('user_id', user.id)
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

      // Note: custom_tags and deleted_tags columns don't exist in tag_config table
      // Tag deletion removes tags from assets directly, no need to update tag_config
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setDeleteTagName(null)
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

  const handleDeleteTag = () => {
    if (!deleteTagName) return
    deleteTagMutation.mutate(deleteTagName)
  }

  // Toggle AI usage for a tag - matches mobile app behavior exactly
  // Mobile app saves ALL tags where isAutoTag=true as an array
  const toggleAIMutation = useMutation({
    mutationFn: async ({ tagName, enabled }: { tagName: string; enabled: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      // Read optimistic tags from cache (onMutate has already updated it)
      const optimisticTags = queryClient.getQueryData<TagConfig[]>(['tags']) || []
      
      if (!optimisticTags.length) {
        console.warn('[TagManagement] No tags found in cache, using empty array')
      }

      // Filter to ONLY tags where useWithAI is true (matches mobile app: filter where isAutoTag === true)
      const autoTags = optimisticTags.filter((t) => t.useWithAI).map((t) => t.name)

      console.log('[TagManagement] Saving auto_tags:', autoTags, 'for tag:', tagName, 'enabled:', enabled)

      // Save the auto_tags array (same as mobile app: saves array of tag names)
      const { error } = await supabase
        .from('tag_config')
        .upsert(
          { user_id: user.id, auto_tags: autoTags },
          { onConflict: 'user_id' }
        )

      if (error) {
        console.error('[TagManagement] Upsert failed:', error)
        // Try insert/update fallback like mobile app
        const insertResult = await supabase
          .from('tag_config')
          .insert({ user_id: user.id, auto_tags: autoTags })
        
        if (insertResult.error) {
          if (insertResult.error.code === '23505' || insertResult.error.message?.includes('duplicate')) {
            const updateResult = await supabase
              .from('tag_config')
              .update({ auto_tags: autoTags })
              .eq('user_id', user.id)
            
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
        .eq('user_id', user.id)
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

      console.log('[TagManagement] Clearing pending assets for user:', user.id)

      // First, check how many pending assets exist
      const { data: pendingAssets, error: countError } = await supabase
        .from('assets')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
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

      // Clear all pending assets for this user
      const { data, error } = await supabase
        .from('assets')
        .update({ auto_tag_status: null })
        .eq('user_id', user.id)
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
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Tag Management
            </h1>
            <p className="text-sm text-gray-500">Organize your content taxonomy</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => clearPendingAssetsMutation.mutate()}
              disabled={clearPendingAssetsMutation.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${clearPendingAssetsMutation.isPending ? 'animate-spin' : ''}`} />
              Clear Stuck Pending
            </Button>
            <Button
              onClick={() => setShowNewTagDialog(true)}
            >
              <Plus className="mr-2 h-5 w-5" />
              New Tag
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
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
      <AlertDialog open={!!deleteTagName} onOpenChange={(open) => !open && setDeleteTagName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tag "{deleteTagName}" from all photos. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              disabled={deleteTagMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTagMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

