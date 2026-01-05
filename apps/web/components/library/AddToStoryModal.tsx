'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStories, useCreateStory } from '@/hooks/useStories'
import { useAddStoryAssets } from '@/hooks/useStoryAssets'
import { Asset, Story } from '@/types'
import { Plus, Check, Image as ImageIcon, Sparkles } from 'lucide-react'
import { useTrialGate } from '@/components/subscription'

type StoryWithThumbnail = Story & {
  thumbnailUrl: string | null
  assetCount: number
}

interface AddToStoryModalProps {
  open: boolean
  onClose: () => void
  selectedAssetIds: string[]
  onSuccess?: (storyId: string, assetCount: number) => void
}

export function AddToStoryModal({
  open,
  onClose,
  selectedAssetIds,
  onSuccess,
}: AddToStoryModalProps) {
  const router = useRouter()
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null)
  const [newStoryName, setNewStoryName] = useState('')
  const [showCreateStory, setShowCreateStory] = useState(false)
  
  const { data: stories, isLoading } = useStories()
  const createStory = useCreateStory()
  const addAssets = useAddStoryAssets()
  const { withEditAccess } = useTrialGate()

  const handleAddToStory = async () => {
    if (!selectedStoryId) return

    await withEditAccess(async () => {
      await addAssets.mutateAsync({
        storyId: selectedStoryId,
        assetIds: selectedAssetIds,
      })

      onSuccess?.(selectedStoryId, selectedAssetIds.length)
      onClose()
      setSelectedStoryId(null)

      // Redirect to story page after a brief delay to show toast
      setTimeout(() => {
        router.push(`/app/stories/${selectedStoryId}`)
      }, 500)
    })
  }

  const handleCreateAndAdd = async () => {
    if (!newStoryName.trim()) return

    await withEditAccess(async () => {
      const newStory = await createStory.mutateAsync(newStoryName.trim())

      await addAssets.mutateAsync({
        storyId: newStory.id,
        assetIds: selectedAssetIds,
      })

      onSuccess?.(newStory.id, selectedAssetIds.length)
      onClose()
      setNewStoryName('')
      setShowCreateStory(false)
      setSelectedStoryId(null)

      // Redirect to story page after a brief delay to show toast
      setTimeout(() => {
        router.push(`/app/stories/${newStory.id}`)
      }, 500)
    })
  }

  const handleClose = () => {
    setSelectedStoryId(null)
    setNewStoryName('')
    setShowCreateStory(false)
    onClose()
  }

  const canSubmit = selectedStoryId || (showCreateStory && newStoryName.trim())
  const isProcessing = addAssets.isPending || createStory.isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-xl font-semibold text-gray-900 tracking-tight">
            Add {selectedAssetIds.length} {selectedAssetIds.length === 1 ? 'photo' : 'photos'} to story
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-1">
            Choose an existing story or create a new one to organize your photos
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 max-h-[calc(100vh-280px)] overflow-y-auto">
          {/* Existing Stories - Card Grid */}
          {!showCreateStory && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Your stories</h3>
                {stories && stories.length > 0 && (
                  <span className="text-xs text-gray-500">{stories.length} {stories.length === 1 ? 'story' : 'stories'}</span>
                )}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-accent border-r-transparent mb-3"></div>
                    <p className="text-sm text-gray-500">Loading stories...</p>
                  </div>
                </div>
              ) : stories && stories.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stories.map((story: StoryWithThumbnail) => {
                    const isSelected = selectedStoryId === story.id
                    return (
                      <button
                        key={story.id}
                        onClick={() => setSelectedStoryId(story.id)}
                        className={`
                          group relative overflow-hidden rounded-xl border-2 transition-all duration-200
                          ${isSelected 
                            ? 'border-accent bg-accent/5 shadow-md' 
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                          }
                        `}
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
                          {story.thumbnailUrl ? (
                            <Image
                              src={story.thumbnailUrl}
                              alt={story.name}
                              fill
                              className={`object-cover transition-transform duration-300 ${
                                isSelected ? 'scale-105' : 'group-hover:scale-110'
                              }`}
                              sizes="(max-width: 640px) 100vw, 50vw"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <div className="text-center">
                                <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                                <p className="text-xs font-medium text-gray-500">No photos</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center shadow-lg">
                                <Check className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Story Info */}
                        <div className="p-4">
                          <h4 className={`text-sm font-semibold mb-1 line-clamp-1 ${
                            isSelected ? 'text-accent' : 'text-gray-900'
                          }`}>
                            {story.name}
                          </h4>
                          {story.assetCount > 0 && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <ImageIcon className="h-3 w-3" />
                              {story.assetCount} {story.assetCount === 1 ? 'photo' : 'photos'}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">No stories yet</p>
                  <p className="text-xs text-gray-500 mb-6 max-w-xs">
                    Create your first story to start organizing your photos
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Create New Story Form */}
          {showCreateStory && (
            <div className="space-y-4 animate-in slide-in-from-top-2 fade-in-0 duration-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Create new story</h3>
                  <p className="text-xs text-gray-500">Give your story a memorable name</p>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="e.g., Summer Vacation 2024"
                  value={newStoryName}
                  onChange={(e) => setNewStoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newStoryName.trim() && !isProcessing) {
                      handleCreateAndAdd()
                    } else if (e.key === 'Escape') {
                      setShowCreateStory(false)
                      setNewStoryName('')
                    }
                  }}
                  className="h-11 text-sm border-gray-300 focus:border-accent focus:ring-accent"
                  autoFocus
                  maxLength={100}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateStory(false)
                      setNewStoryName('')
                    }}
                    disabled={isProcessing}
                    className="flex-1 border-gray-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAndAdd}
                    disabled={!newStoryName.trim() || isProcessing}
                    className="flex-1 bg-accent hover:bg-accent/90"
                  >
                    {isProcessing ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create & Add
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
          {!showCreateStory && (
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateStory(true)
                setSelectedStoryId(null)
              }}
              className="border-gray-300 hover:bg-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              New story
            </Button>
          )}
          
          <div className={`flex gap-2 ${showCreateStory ? 'ml-auto' : ''}`}>
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isProcessing}
              className="border-gray-300 hover:bg-white"
            >
              Cancel
            </Button>
            {!showCreateStory && (
              <Button
                onClick={handleAddToStory}
                disabled={!selectedStoryId || isProcessing}
                className="bg-accent hover:bg-accent/90 min-w-[120px]"
              >
                {isProcessing ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  'Add to Story'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

