'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Story } from '@/types'
import { StoryBuilder } from '@/components/stories/StoryBuilder'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Edit2, Check, X as XIcon } from 'lucide-react'
import { useUpdateStory } from '@/hooks/useStories'

export default function StoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const storyId = params.id as string
  const supabase = createClient()
  const updateStory = useUpdateStory()
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editingDescription, setEditingDescription] = useState('')

  const { data: story, isLoading } = useQuery({
    queryKey: ['story', storyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single()

      if (error) throw error
      return data as Story
    },
    enabled: !!storyId,
  })

  const handleStartEditDescription = () => {
    if (story) {
      setEditingDescription(story.description || '')
      setIsEditingDescription(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingDescription(false)
    setEditingDescription('')
  }

  const handleSaveDescription = async () => {
    if (!story) return

    try {
      await updateStory.mutateAsync({
        storyId: story.id,
        description: editingDescription.trim() || null,
      })
      setIsEditingDescription(false)
      setEditingDescription('')
      // Invalidate both story and stories queries
      queryClient.invalidateQueries({ queryKey: ['story', storyId] })
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    } catch (error) {
      console.error('Failed to update story description:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading story...</p>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Story not found</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-gray-200 bg-white">
        <div className="px-8 pt-4 pb-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-gray-900 mb-3">{story.name}</h1>
              
              {/* Description - editable */}
              {isEditingDescription ? (
                <div className="space-y-3">
                  <Textarea
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    placeholder="Add a description..."
                    className="min-h-[80px] text-sm border-gray-300 focus:border-accent focus:ring-accent resize-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        handleCancelEdit()
                      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleSaveDescription()
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDescription}
                      disabled={updateStory.isPending}
                      className="h-8 px-3 text-xs font-medium bg-accent hover:bg-accent/90"
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={updateStory.isPending}
                      className="h-8 px-3 text-xs font-medium border-gray-300"
                    >
                      <XIcon className="h-3.5 w-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group/desc relative">
                  {story.description ? (
                    <p className="text-sm text-gray-600 pr-8">
                      {story.description}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic pr-8">
                      No description
                    </p>
                  )}
                  <button
                    onClick={handleStartEditDescription}
                    className="absolute top-0 right-0 h-7 w-7 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center opacity-0 group-hover/desc:opacity-100 transition-opacity duration-200 hover:bg-gray-100 hover:border-accent"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-gray-600" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <StoryBuilder storyId={storyId} />
      </div>
    </div>
  )
}

