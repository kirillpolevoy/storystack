'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Story } from '@/types'
import { StoryBuilder } from '@/components/stories/StoryBuilder'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function StoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const storyId = params.id as string
  const supabase = createClient()

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
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">{story.name}</h1>
            {story.description && (
              <p className="text-sm text-gray-500">{story.description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <StoryBuilder storyId={storyId} />
      </div>
    </div>
  )
}

