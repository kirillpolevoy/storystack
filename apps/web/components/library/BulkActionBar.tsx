'use client'

import { Button } from '@/components/ui/button'
import { Plus, Tag, Trash2, X, Sparkles } from 'lucide-react'

interface BulkActionBarProps {
  selectedCount: number
  onAddToStory: () => void
  onAddTags: () => void
  onRetagWithAI: () => void
  onDelete: () => void
  onClearSelection: () => void
}

export function BulkActionBar({
  selectedCount,
  onAddToStory,
  onAddTags,
  onRetagWithAI,
  onDelete,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-card-hover px-4 py-2.5">
        <span className="text-sm font-medium text-gray-900 mr-1">
          {selectedCount} {selectedCount === 1 ? 'asset' : 'assets'} selected
        </span>
        <div className="h-4 w-px bg-gray-200" />
        <Button
          size="sm"
          onClick={onAddToStory}
          className="h-8 px-3 text-xs font-medium"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add to Story
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onAddTags}
          className="h-8 px-3 text-xs font-medium"
        >
          <Tag className="mr-1.5 h-3.5 w-3.5" />
          Add Tags
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetagWithAI}
          className="h-8 px-3 text-xs font-medium"
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Retag with AI
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          className="h-8 px-3 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

