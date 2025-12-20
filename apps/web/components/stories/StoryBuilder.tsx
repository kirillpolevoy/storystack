'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
import { AddAssetsModal } from './AddAssetsModal'
import { Button } from '@/components/ui/button'
import { GripVertical, Plus, X } from 'lucide-react'

interface StoryBuilderProps {
  storyId: string
}

function SortableAssetItem({
  asset,
  onRemove,
}: {
  asset: Asset & { storyAssetId: string; order_index: number }
  onRemove: () => void
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
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const imageUrl = asset.thumbUrl || asset.previewUrl || asset.publicUrl || ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1"
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={asset.tags?.[0] || 'Asset'}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No image
          </div>
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">
          {asset.tags?.[0] || 'Untitled'}
        </p>
        {asset.tags && asset.tags.length > 1 && (
          <p className="text-xs text-gray-500 mt-0.5">
            {asset.tags.slice(1).join(', ')}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="flex-shrink-0 h-8 w-8"
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
  const [showAddAssetsModal, setShowAddAssetsModal] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && assets) {
      const oldIndex = assets.findIndex((asset) => asset.id === active.id)
      const newIndex = assets.findIndex((asset) => asset.id === over.id)

      const newOrder = arrayMove(assets, oldIndex, newIndex)
      const assetIds = newOrder.map((asset) => asset.id)

      updateOrder.mutate({
        storyId,
        assetIds,
      })
    }
  }


  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading story assets...</p>
      </div>
    )
  }

  const assetIds = assets?.map((asset) => asset.id) || []

  return (
    <>
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Story Assets</h2>
          <Button onClick={() => setShowAddAssetsModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Assets
          </Button>
        </div>

        {assets && assets.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center max-w-md">
              <p className="mb-4 text-base font-medium text-gray-700">No assets in this story</p>
              <Button onClick={() => setShowAddAssetsModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first asset
              </Button>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={assetIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 overflow-y-auto">
                {assets?.map((asset) => (
                  <SortableAssetItem
                    key={asset.id}
                    asset={asset}
                    onRemove={() => removeAsset.mutate(asset.storyAssetId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
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

