'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDndMonitor,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Image from 'next/image'
import { Asset } from '@/types'
import { useStoryAssets, useUpdateStoryOrder, useRemoveStoryAsset, useAddStoryAsset } from '@/hooks/useStoryAssets'
import { useUpdateStory } from '@/hooks/useStories'
import { AddAssetsModal } from './AddAssetsModal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { GripVertical, Plus, X, Loader2, Smile } from 'lucide-react'
import dynamic from 'next/dynamic'

const EmojiPicker = dynamic(
  () => import('emoji-picker-react'),
  { 
    ssr: false,
    loading: () => <div className="w-[350px] h-[400px] flex items-center justify-center text-gray-400">Loading emojis...</div>
  }
)

type EmojiClickData = {
  emoji: string
  unified: string
  activeSkinTone: string
}
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Story } from '@/types'
import { useTrialGate } from '@/components/subscription/TrialGateProvider'

interface StoryBuilderProps {
  storyId: string
}

function SortableAssetItem({
  asset,
  onRemove,
  index,
  isDraggingOverlay = false,
}: {
  asset: Asset & { storyAssetId: string; order_index: number }
  onRemove: () => void
  index: number
  isDraggingOverlay?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging 
      ? 'none' 
      : transition || 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease-out',
    opacity: isDragging && !isDraggingOverlay ? 0.3 : 1,
  }

  const imageUrl = asset.thumbUrl || asset.previewUrl || asset.publicUrl || ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${
        isDragging && !isDraggingOverlay 
          ? 'ring-2 ring-accent/40 shadow-xl scale-[1.01] z-50 border-accent/20' 
          : ''
      } ${isDraggingOverlay ? 'shadow-xl' : ''}`}
    >
      {/* Elegant number badge - integrated into card */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700 group-hover:bg-accent/5 group-hover:border-accent/20 transition-colors">
          {index + 1}
        </div>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 rounded-lg hover:bg-gray-50 transition-colors touch-none opacity-60 group-hover:opacity-100"
        >
          <GripVertical className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
        </div>
      </div>

      {/* Premium image presentation */}
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-sm ring-1 ring-gray-200/50 group-hover:ring-gray-300/50 transition-all">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={asset.tags?.[0] || 'Asset'}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="96px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            No image
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
      </div>

      {/* Refined remove button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="flex-shrink-0 h-9 w-9 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
        aria-label="Remove asset"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function StoryBuilder({ storyId }: StoryBuilderProps) {
  const { data: assets, isLoading } = useStoryAssets(storyId)
  const updateOrder = useUpdateStoryOrder()
  const removeAsset = useRemoveStoryAsset()
  const updateStory = useUpdateStory()
  const queryClient = useQueryClient()
  const [showAddAssetsModal, setShowAddAssetsModal] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const supabase = createClient()
  const { withEditAccess, canEdit } = useTrialGate()

  // Fetch story data to get post_text
  const { data: story } = useQuery({
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
    refetchInterval: 5000, // Refetch every 5 seconds for cross-device sync
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch on mount
  })

  const [postText, setPostText] = useState('')
  const [isSavingPostText, setIsSavingPostText] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedTextRef = useRef<string>('')

  // Initialize post_text from story data (only on initial load)
  const hasInitializedRef = useRef(false)
  const isSavingRef = useRef(false)
  
  useEffect(() => {
    // Only initialize once when story first loads
    if (story && !hasInitializedRef.current) {
      const initialText = story.post_text || ''
      setPostText(initialText)
      lastSavedTextRef.current = initialText.trim() || ''
      hasInitializedRef.current = true
    } else if (story && hasInitializedRef.current && !isSavingRef.current) {
      // Sync from server if user isn't typing and text matches last saved
      // This enables cross-device sync without overwriting unsaved changes
      const trimmedCurrentText = postText.trim() || ''
      const trimmedServerText = (story.post_text || '').trim()
      const trimmedLastSaved = lastSavedTextRef.current || ''
      
      // Only sync if:
      // 1. Current text matches last saved (no local unsaved changes)
      // 2. Server text is different from current (there's an update from another device)
      if (trimmedCurrentText === trimmedLastSaved && trimmedServerText !== trimmedCurrentText) {
        setPostText(story.post_text || '')
        lastSavedTextRef.current = trimmedServerText
      }
    }
  }, [story, postText])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px of movement before drag starts - more responsive
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id && assets) {
      // Check edit access before allowing reorder
      await withEditAccess(async () => {
        const oldIndex = assets.findIndex((asset) => asset.id === active.id)
        const newIndex = assets.findIndex((asset) => asset.id === over.id)

        const newOrder = arrayMove(assets, oldIndex, newIndex)
        const assetIds = newOrder.map((asset) => asset.id)

        // Optimistically update the UI immediately - this prevents the "snap back" effect
        queryClient.setQueryData(['storyAssets', storyId], newOrder)

        // Then perform the mutation in the background
        updateOrder.mutate(
          {
            storyId,
            assetIds,
          },
          {
            onError: (error) => {
              // Rollback on error - restore original order
              queryClient.setQueryData(['storyAssets', storyId], assets)
              console.error('Failed to update story order:', error)
            },
            onSettled: () => {
              // Only refetch after mutation completes to sync with server
              // This ensures the optimistic update stays until the mutation is done
              queryClient.invalidateQueries({ queryKey: ['storyAssets', storyId] })
            },
          }
        )
      })
    }
  }

  const activeAsset = activeId ? assets?.find((asset) => asset.id === activeId) : null

  // Auto-save with debounce (500ms delay)
  useEffect(() => {
    // Don't save if story isn't loaded yet or if we haven't initialized
    // Also don't save if user doesn't have edit access (subscription ended)
    if (!story || !hasInitializedRef.current || !canEdit) {
      return
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    // Don't auto-save if text hasn't changed from last saved value (compare trimmed)
    const trimmedCurrentText = postText.trim() || ''
    if (trimmedCurrentText === lastSavedTextRef.current) {
      return
    }

    // Set new timeout to save after user stops typing
    saveTimeoutRef.current = setTimeout(async () => {
      // Use the current postText value at the time of save (don't re-read from state)
      const textToSave = postText.trim() || ''
      
      // Double-check text hasn't changed during timeout (compare trimmed)
      if (textToSave === lastSavedTextRef.current) {
        return
      }

      setIsSavingPostText(true)
      isSavingRef.current = true
      try {
        await updateStory.mutateAsync({
          storyId,
          post_text: textToSave || null,
        })
        // Store trimmed value for comparison, but don't update local state
        // Keep the user's current text (which may have spaces) in the textarea
        lastSavedTextRef.current = textToSave
      } catch (error) {
        console.error('Failed to save post text:', error)
      } finally {
        setIsSavingPostText(false)
        // Reset saving flag after a short delay to allow query to refetch
        setTimeout(() => {
          isSavingRef.current = false
        }, 100)
      }
    }, 500)

    // Cleanup timeout on unmount or when postText changes
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [postText, story, storyId, updateStory, canEdit])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading story assets...</p>
        </div>
      </div>
    )
  }

  const assetIds = assets?.map((asset) => asset.id) || []

  return (
    <>
      <div className="flex h-full">
        {/* Left Panel - 70% */}
        <div className="flex-[0.7] flex flex-col p-8 lg:p-10 border-r border-gray-200/80 bg-white">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Story Assets</h2>
              {assets && assets.length > 0 && (
                <p className="text-sm text-gray-500 mt-2 font-medium">
                  {assets.length} {assets.length === 1 ? 'photo' : 'photos'} • Drag to reorder
                </p>
              )}
            </div>
            <Button 
              onClick={() => setShowAddAssetsModal(true)}
              className="h-11 px-5 text-sm font-semibold bg-accent hover:bg-accent/90 text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-xl"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Assets
            </Button>
          </div>

          {assets && assets.length === 0 ? (
            <div className="flex flex-1 items-center justify-center min-h-[400px]">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mx-auto mb-6 shadow-inner border border-gray-200/50">
                  <Plus className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">Start Your Story</h3>
                <p className="mb-8 text-sm text-gray-500 leading-relaxed">
                  Build your visual narrative by adding photos from your library
                </p>
                <Button 
                  onClick={() => setShowAddAssetsModal(true)}
                  className="h-11 px-6 text-sm font-semibold bg-accent hover:bg-accent/90 text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-xl"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Photo
                </Button>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={assetIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3 overflow-y-auto -mr-3 pr-3">
                  {assets?.map((asset, index) => (
                    <SortableAssetItem
                      key={asset.id}
                      asset={asset}
                      index={index}
                      onRemove={async () => {
                        await withEditAccess(async () => {
                          removeAsset.mutate(asset.storyAssetId)
                        })
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay
                style={{
                  cursor: 'grabbing',
                }}
                dropAnimation={{
                  duration: 300,
                  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {activeAsset ? (
                  <div className="opacity-90">
                    <SortableAssetItem
                      asset={activeAsset}
                      index={assets?.findIndex((a) => a.id === activeAsset.id) || 0}
                      onRemove={() => {}}
                      isDraggingOverlay={true}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Right Panel - 30% */}
        <div className="flex-[0.3] flex flex-col p-8 bg-gradient-to-b from-gray-50 to-white border-l border-gray-100">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Post Text</h2>
            <p className="text-xs text-gray-500">Write the copy for your social post</p>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="relative flex-1 min-h-0">
              <Textarea
                ref={textAreaRef}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Write your post copy here..."
                className="w-full h-full min-h-[300px] text-sm border-gray-300 focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none bg-white rounded-lg shadow-sm transition-all pr-12"
              />
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 h-8 w-8 rounded-lg hover:bg-gray-100 transition-colors z-10"
                    onClick={(e) => {
                      e.preventDefault()
                      setShowEmojiPicker(!showEmojiPicker)
                    }}
                  >
                    <Smile className="h-4 w-4 text-gray-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 border-gray-200 shadow-xl rounded-xl overflow-hidden"
                  align="end"
                  side="top"
                >
                  <div className="[&_.EmojiPickerReact]:!border-0 [&_.EmojiPickerReact]:!shadow-none">
                    <EmojiPicker
                      onEmojiClick={(emojiData: EmojiClickData) => {
                        const emoji = emojiData.emoji
                        if (textAreaRef.current) {
                          const start = textAreaRef.current.selectionStart || 0
                          const end = textAreaRef.current.selectionEnd || 0
                          const newText = postText.substring(0, start) + emoji + postText.substring(end)
                          setPostText(newText)
                          // Set cursor position after the inserted emoji
                          setTimeout(() => {
                            if (textAreaRef.current) {
                              textAreaRef.current.focus()
                              textAreaRef.current.setSelectionRange(start + emoji.length, start + emoji.length)
                            }
                          }, 0)
                        } else {
                          setPostText(postText + emoji)
                        }
                        setShowEmojiPicker(false)
                      }}
                      width={350}
                      height={400}
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                      searchDisabled={false}
                      lazyLoadEmojis={true}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-gray-500">Auto-saving</span>
              </div>
              {postText.length > 0 && (
                <span className="text-xs text-gray-400">
                  {postText.length} {postText.length === 1 ? 'character' : 'characters'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddAssetsModal
        open={showAddAssetsModal}
        onClose={() => setShowAddAssetsModal(false)}
        storyId={storyId}
        currentStoryAssetIds={assetIds}
      />
    </>
  )
}

