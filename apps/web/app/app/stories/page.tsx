'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStories, useCreateStory, useDeleteStory, useUpdateStory } from '@/hooks/useStories'
import { useStoryAssets } from '@/hooks/useStoryAssets'
import { downloadStoryAsZip } from '@/utils/downloadStory'
import { createClient } from '@/lib/supabase/client'
import { Asset } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Search, X, Image as ImageIcon, Clock, CheckCircle2, Undo2, Download, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useQueryClient } from '@tanstack/react-query'
import { MobileMenuButton } from '@/components/app/MobileMenuButton'
import { useTrialGate } from '@/components/subscription'

dayjs.extend(relativeTime)

export default function StoriesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: stories, isLoading, refetch } = useStories()
  const { withEditAccess } = useTrialGate()
  
  // Log when stories data changes
  useEffect(() => {
    console.log('[StoriesPage] Stories data changed:', stories?.length || 0, 'stories')
  }, [stories])
  const createStory = useCreateStory()
  const deleteStory = useDeleteStory()
  const [newStoryName, setNewStoryName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteStoryId, setDeleteStoryId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Premium delete flow state
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 })
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false)
  const [deletedStoryName, setDeletedStoryName] = useState('')
  const [deletedStoryForUndo, setDeletedStoryForUndo] = useState<any>(null)
  const [downloadingStoryId, setDownloadingStoryId] = useState<string | null>(null)

  // Auto-refresh: Poll for story updates (thumbnails, asset counts, etc.)
  useEffect(() => {
    // Initial fetch
    refetch()

    // Poll every 3 seconds for updates (thumbnails, new stories, asset counts, etc.)
    const pollInterval = setInterval(() => {
      refetch()
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [refetch])

  // Filter stories based on search query
  const filteredStories = useMemo(() => {
    if (!stories) return []
    if (!searchQuery.trim()) return stories

    const query = searchQuery.toLowerCase().trim()
    return stories.filter((story) => {
      const nameMatch = story.name.toLowerCase().includes(query)
      const descriptionMatch = story.description?.toLowerCase().includes(query) || false
      return nameMatch || descriptionMatch
    })
  }, [stories, searchQuery])

  const handleCreateStory = async () => {
    if (!newStoryName.trim()) return

    await withEditAccess(async () => {
      try {
        const story = await createStory.mutateAsync(newStoryName.trim())
        setNewStoryName('')
        setShowCreateModal(false)
        router.push(`/app/stories/${story.id}`)
      } catch (error) {
        console.error('Failed to create story:', error)
      }
    })
  }

  const handleDeleteStory = useCallback(async () => {
    if (!deleteStoryId) return

    const storyToDelete = stories?.find(s => s.id === deleteStoryId)
    if (!storyToDelete) return

    await withEditAccess(async () => {
      setIsDeleting(true)
      setDeleteProgress({ current: 0, total: 1 })

      try {
        // Optimistic update - remove from UI immediately
        queryClient.setQueryData(['stories'], (oldData: any) => {
          if (!oldData) return oldData
          return oldData.filter((story: any) => story.id !== deleteStoryId)
        })

        // Store for undo
        setDeletedStoryForUndo(storyToDelete)
        setDeletedStoryName(storyToDelete.name)

        // Delete story
        await deleteStory.mutateAsync(deleteStoryId)
        setDeleteProgress({ current: 1, total: 1 })

        // Show success notification
        setShowDeleteSuccess(true)

        // Auto-dismiss success notification after 5 seconds
        setTimeout(() => {
          setShowDeleteSuccess(false)
          setDeletedStoryForUndo(null)
        }, 5000)

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['stories'] })

      } catch (error) {
        console.error('[StoriesPage] Delete failed:', error)

        // Rollback optimistic update on error
        queryClient.invalidateQueries({ queryKey: ['stories'] })

        alert('Failed to delete story. Please try again.')
      } finally {
        setIsDeleting(false)
        setDeleteProgress({ current: 0, total: 0 })
        setDeleteStoryId(null)
      }
    })
  }, [deleteStoryId, stories, deleteStory, queryClient, withEditAccess])

  const handleUndoDelete = useCallback(async () => {
    if (!deletedStoryForUndo) return

    try {
      // Restore story optimistically
      queryClient.setQueryData(['stories'], (oldData: any) => {
        if (!oldData) return [deletedStoryForUndo]
        return [...oldData, deletedStoryForUndo].sort((a: any, b: any) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      })

      setDeletedStoryForUndo(null)
      setShowDeleteSuccess(false)

      // Refresh to sync with server
      queryClient.invalidateQueries({ queryKey: ['stories'] })

      alert('Story restored. Note: If the story was already deleted from the database, you may need to recreate it.')
    } catch (error) {
      console.error('[StoriesPage] Undo failed:', error)
      alert('Unable to restore deleted story.')
    }
  }, [deletedStoryForUndo, queryClient])

  const handleDownloadStory = useCallback(async (storyId: string, storyName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (downloadingStoryId) return // Prevent multiple simultaneous downloads
    
    setDownloadingStoryId(storyId)
    
    try {
      // Fetch story assets
      const supabase = createClient()
      const { data: storyAssetsData, error } = await supabase
        .from('story_assets')
        .select('*, assets(*)')
        .eq('story_id', storyId)
        .order('order_index', { ascending: true })

      if (error) throw error

      if (!storyAssetsData || storyAssetsData.length === 0) {
        alert('No assets to download')
        return
      }

      // Process assets to get URLs
      const assets = storyAssetsData.map((item: any) => {
        const asset = item.assets as any
        const thumbUrl = asset.storage_path_thumb
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_thumb).data.publicUrl
          : asset.storage_path_preview
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_preview).data.publicUrl
          : supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl

        const previewUrl = asset.storage_path_preview
          ? supabase.storage.from('assets').getPublicUrl(asset.storage_path_preview).data.publicUrl
          : supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl

        const publicUrl = supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl

        return {
          ...asset,
          publicUrl,
          previewUrl,
          thumbUrl,
        } as Asset
      })

      await downloadStoryAsZip(assets, storyName)
    } catch (error) {
      console.error('Failed to download story:', error)
      alert(error instanceof Error ? error.message : 'Failed to download story. Please try again.')
    } finally {
      setDownloadingStoryId(null)
    }
  }, [downloadingStoryId])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-accent border-r-transparent mb-4"></div>
          <p className="text-sm font-medium text-gray-600">Loading stories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          {/* Row 1: Title + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 pb-4">
            <div className="flex items-center gap-3">
              <MobileMenuButton />
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                  Stories
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Create and organize visual narratives</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="h-9 px-3 sm:px-4 text-xs sm:text-sm font-semibold bg-accent hover:bg-accent/90 shadow-sm"
              >
                <Plus className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                New Story
              </Button>
            </div>
          </div>

          {/* Row 2: Search Bar */}
          <div className="flex items-center justify-between pb-3">
            <div className="relative max-w-md flex-1 w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-9 text-xs sm:text-sm border-gray-300 focus:border-accent focus:ring-accent bg-white"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md hover:bg-gray-100"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {filteredStories && filteredStories.length === 0 ? (
          <div className="flex flex-1 items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md">
              {searchQuery ? (
                <>
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <Search className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="mb-2 text-xl font-semibold text-gray-900">No stories found</p>
                  <p className="mb-6 text-sm text-gray-500">
                    Try adjusting your search query
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery('')}
                    className="border-gray-300"
                  >
                    Clear search
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="mb-2 text-xl font-semibold text-gray-900">No stories yet</p>
                  <p className="mb-6 text-sm text-gray-500">
                    Create your first story to start organizing your photos
                  </p>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-accent hover:bg-accent/90 shadow-sm"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Create your first story
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredStories?.map((story) => (
              <div
                key={story.id}
                onClick={() => router.push(`/app/stories/${story.id}`)}
                className="group relative cursor-pointer overflow-hidden rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                  {story.thumbnailUrl ? (
                    <Image
                      src={story.thumbnailUrl}
                      alt={story.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs font-medium text-gray-500">No photos</p>
                      </div>
                    </div>
                  )}
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Action buttons - visible on hover */}
                  <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {/* Download button */}
                    {story.assetCount > 0 && (
                      <button
                        onClick={(e) => handleDownloadStory(story.id, story.name, e)}
                        disabled={downloadingStoryId === story.id}
                        className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white shadow-md hover:scale-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download story"
                      >
                        {downloadingStoryId === story.id ? (
                          <Loader2 className="h-4 w-4 text-gray-700 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 text-gray-700" />
                        )}
                      </button>
                    )}
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteStoryId(story.id)
                      }}
                      className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white shadow-md hover:scale-110 transition-all duration-200"
                      title="Delete story"
                    >
                      <Trash2 className="h-4 w-4 text-gray-700" />
                    </button>
                  </div>

                  {/* Asset count badge */}
                  {story.assetCount > 0 && (
                    <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-gray-700" />
                      <span className="text-xs font-semibold text-gray-900">{story.assetCount}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-accent transition-colors">
                    {story.name}
                  </h3>
                  
                  {story.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {story.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      Updated {dayjs(story.updated_at).fromNow()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Story Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">Create New Story</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Give your story a name to get started. You can add a description later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Story name..."
              value={newStoryName}
              onChange={(e) => setNewStoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateStory()
                } else if (e.key === 'Escape') {
                  setShowCreateModal(false)
                  setNewStoryName('')
                }
              }}
              autoFocus
              className="h-10 text-sm border-gray-300 focus:border-accent focus:ring-accent"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                setNewStoryName('')
              }}
              className="border-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStory}
              disabled={!newStoryName.trim() || createStory.isPending}
              className="bg-accent hover:bg-accent/90"
            >
              {createStory.isPending ? 'Creating...' : 'Create Story'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteStoryId && !isDeleting} onOpenChange={() => !isDeleting && setDeleteStoryId(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                  Delete Story?
                </AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="text-sm text-gray-600 mt-2">
              This will permanently delete this story and remove all assets from it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStory}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Story
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
                Deleting Story...
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600 mt-2">
                Please wait while we delete your story.
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
                  Story deleted
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  &quot;{deletedStoryName}&quot; has been deleted
                </p>
              </div>
              {deletedStoryForUndo && (
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
