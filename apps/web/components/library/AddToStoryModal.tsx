'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStories, useCreateStory } from '@/hooks/useStories'
import { useAddStoryAssets } from '@/hooks/useStoryAssets'
import { Asset } from '@/types'
import { Plus, Check } from 'lucide-react'

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
  
  const { data: stories } = useStories()
  const createStory = useCreateStory()
  const addAssets = useAddStoryAssets()

  const handleAddToStory = async () => {
    if (!selectedStoryId) return

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
  }

  const handleCreateAndAdd = async () => {
    if (!newStoryName.trim()) return

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
  }

  const canSubmit = selectedStoryId || (showCreateStory && newStoryName.trim())

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add {selectedAssetIds.length} {selectedAssetIds.length === 1 ? 'asset' : 'assets'} to Story
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing Stories */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">Select a story</p>
            <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-200 rounded-md p-2">
              {stories && stories.length > 0 ? (
                stories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => {
                      setSelectedStoryId(story.id)
                      setShowCreateStory(false)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedStoryId === story.id
                        ? 'bg-accent/10 text-accent font-medium border border-accent'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{story.name}</span>
                      {selectedStoryId === story.id && (
                        <Check className="h-4 w-4 text-accent" />
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">No stories yet</p>
              )}
            </div>
          </div>

          {/* Create New Story */}
          <div className="space-y-2">
            {!showCreateStory ? (
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateStory(true)
                  setSelectedStoryId(null)
                }}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create new story
              </Button>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Story name"
                  value={newStoryName}
                  onChange={(e) => setNewStoryName(e.target.value)}
                  className="h-9"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateStory(false)
                      setNewStoryName('')
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAndAdd}
                    disabled={!newStoryName.trim() || createStory.isPending || addAssets.isPending}
                    className="flex-1"
                  >
                    {createStory.isPending || addAssets.isPending ? 'Adding...' : 'Create & Add'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddToStory}
            disabled={!selectedStoryId || addAssets.isPending}
          >
            {addAssets.isPending ? 'Adding...' : 'Add to Story'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

