'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Story } from '@/types'
import { StoryBuilder } from '@/components/stories/StoryBuilder'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Edit2, Check, X as XIcon, Download, Loader2 } from 'lucide-react'
import { useUpdateStory } from '@/hooks/useStories'
import { useStoryAssets } from '@/hooks/useStoryAssets'
import { downloadStoryAsZip } from '@/utils/downloadStory'

export default function StoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const storyId = params.id as string
  const supabase = createClient()
  const updateStory = useUpdateStory()
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editingDescription, setEditingDescription] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  
  const { data: storyAssets } = useStoryAssets(storyId)

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

  const handleDownloadStory = async () => {
    if (!story || !storyAssets || storyAssets.length === 0) {
      alert('No assets to download')
      return
    }

    setIsDownloading(true)
    try {
      await downloadStoryAsZip(storyAssets, story.name, story.post_text)
    } catch (error) {
      console.error('Failed to download story:', error)
      alert(error instanceof Error ? error.message : 'Failed to download story. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading story...</p>
        </div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <p className="text-base text-gray-600 mb-2">Story not found</p>
          <Button variant="outline" onClick={() => router.push('/app/stories')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Tight Sticky Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
          <div className="py-3">
            {/* Row 1: Title + Actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => router.push('/app/stories')} 
                  className="h-9 w-9 flex-shrink-0 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 text-gray-700" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight truncate">
                    {story.name}
                  </h1>
                  {storyAssets && storyAssets.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {storyAssets.length} {storyAssets.length === 1 ? 'asset' : 'assets'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  onClick={handleDownloadStory}
                  disabled={isDownloading || !storyAssets || storyAssets.length === 0}
                  className="h-9 px-4 text-sm font-medium bg-accent hover:bg-accent/90 shadow-sm hover:shadow-md transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Story
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Row 2: Description */}
            <div className="mt-2.5 pt-2.5 border-t border-gray-100">
              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    placeholder="Add a description for this story..."
                    className="min-h-[80px] text-sm border-gray-300 focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none rounded-lg transition-all"
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
                      className="h-8 px-3 text-xs font-medium bg-accent hover:bg-accent/90 rounded-lg transition-colors"
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={updateStory.isPending}
                      className="h-8 px-3 text-xs font-medium border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <XIcon className="h-3.5 w-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group/desc relative">
                  {story.description ? (
                    <p className="text-sm text-gray-700 leading-relaxed pr-10">
                      {story.description}
                    </p>
                  ) : (
                    <button
                      onClick={handleStartEditDescription}
                      className="text-sm text-gray-400 hover:text-gray-600 italic pr-10 transition-colors"
                    >
                      Add a description...
                    </button>
                  )}
                  <button
                    onClick={handleStartEditDescription}
                    className="absolute top-0 right-0 h-7 w-7 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center opacity-0 group-hover/desc:opacity-100 transition-all duration-200 hover:bg-gray-100 hover:border-accent hover:shadow-sm"
                    aria-label="Edit description"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-gray-600" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <StoryBuilder storyId={storyId} />
      </div>
    </div>
  )
}

