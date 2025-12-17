'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStories, useCreateStory, useDeleteStory } from '@/hooks/useStories'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
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

export default function StoriesPage() {
  const router = useRouter()
  const { data: stories, isLoading } = useStories()
  const createStory = useCreateStory()
  const deleteStory = useDeleteStory()
  const [newStoryName, setNewStoryName] = useState('')
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [deleteStoryId, setDeleteStoryId] = useState<string | null>(null)

  const handleCreateStory = async () => {
    if (!newStoryName.trim()) return

    try {
      const story = await createStory.mutateAsync(newStoryName.trim())
      setNewStoryName('')
      setShowCreateInput(false)
      router.push(`/app/stories/${story.id}`)
    } catch (error) {
      console.error('Failed to create story:', error)
    }
  }

  const handleDeleteStory = async () => {
    if (!deleteStoryId) return

    try {
      await deleteStory.mutateAsync(deleteStoryId)
      setDeleteStoryId(null)
    } catch (error) {
      console.error('Failed to delete story:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading stories...</p>
      </div>
    )
  }

      return (
        <div className="flex h-full flex-col bg-background">
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Stories
            </h1>
            <p className="text-sm text-gray-500">Create and organize visual narratives</p>
          </div>
        {!showCreateInput ? (
          <Button onClick={() => setShowCreateInput(true)}>
            <Plus className="mr-2 h-5 w-5" />
            New Story
          </Button>
        ) : (
          <div className="flex gap-3">
            <Input
              placeholder="Story name..."
              value={newStoryName}
              onChange={(e) => setNewStoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateStory()
                } else if (e.key === 'Escape') {
                  setShowCreateInput(false)
                  setNewStoryName('')
                }
              }}
              autoFocus
              className="w-72"
            />
            <Button onClick={handleCreateStory} disabled={!newStoryName.trim()}>
              Create
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateInput(false)
                setNewStoryName('')
              }}
            >
              Cancel
            </Button>
          </div>
        )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {stories && stories.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center max-w-md">
              <p className="mb-6 text-xl font-semibold text-foreground">No stories yet</p>
              <Button onClick={() => setShowCreateInput(true)}>
                <Plus className="mr-2 h-5 w-5" />
                Create your first story
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stories?.map((story) => (
              <Card
                key={story.id}
                className="cursor-pointer transition-shadow hover:shadow-md border-gray-200"
                onClick={() => router.push(`/app/stories/${story.id}`)}
              >
                <CardHeader className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl font-semibold mb-2">{story.name}</CardTitle>
                      {story.description && (
                        <CardDescription className="text-base mt-2">
                          {story.description}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteStoryId(story.id)
                      }}
                      className="h-9 w-9 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <p className="text-sm text-muted-foreground font-medium">
                    Updated {dayjs(story.updated_at).fromNow()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteStoryId} onOpenChange={() => setDeleteStoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Story?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this story and remove all assets from it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

