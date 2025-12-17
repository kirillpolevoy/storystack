'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useUpdateAssetTags } from '@/hooks/useUpdateAssetTags'
import { useAvailableTags } from '@/hooks/useAvailableTags'
import { createClient } from '@/lib/supabase/client'
import { X, Plus } from 'lucide-react'

interface BulkAddTagsModalProps {
  open: boolean
  onClose: () => void
  selectedAssetIds: string[]
  onSuccess?: () => void
}

export function BulkAddTagsModal({
  open,
  onClose,
  selectedAssetIds,
  onSuccess,
}: BulkAddTagsModalProps) {
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { data: availableTags } = useAvailableTags()
  const updateTags = useUpdateAssetTags()
  const supabase = createClient()

  const handleAddTag = () => {
    const tag = newTag.trim()
    if (tag && !tagsToAdd.includes(tag)) {
      setTagsToAdd([...tagsToAdd, tag])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTagsToAdd(tagsToAdd.filter((t) => t !== tagToRemove))
  }

  const handleSave = async () => {
    if (tagsToAdd.length === 0) {
      onClose()
      return
    }

    setIsLoading(true)

    try {
      // Fetch current tags for all selected assets
      const { data: assets } = await supabase
        .from('assets')
        .select('id, tags')
        .in('id', selectedAssetIds)

      if (!assets) return

      // Add tags to each asset (merge with existing)
      await Promise.all(
        assets.map(async (asset) => {
          const currentTags = (asset.tags || []) as string[]
          const mergedTags = [...new Set([...currentTags, ...tagsToAdd])]
          
          await updateTags.mutateAsync({
            assetId: asset.id,
            tags: mergedTags,
          })
        })
      )

      onSuccess?.()
      onClose()
      setTagsToAdd([])
      setNewTag('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add Tags to {selectedAssetIds.length} {selectedAssetIds.length === 1 ? 'Asset' : 'Assets'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">Tags to add</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter tag name"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                className="h-9"
              />
              <Button onClick={handleAddTag} size="sm" className="h-9">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {tagsToAdd.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagsToAdd.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-2 py-1">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1.5 hover:text-gray-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {availableTags && availableTags.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-gray-600">Suggestions</label>
              <div className="flex flex-wrap gap-2">
                {availableTags
                  .filter((tag) => !tagsToAdd.includes(tag))
                  .slice(0, 10)
                  .map((tag) => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!tagsToAdd.includes(tag)) {
                          setTagsToAdd([...tagsToAdd, tag])
                        }
                      }}
                      className="h-7 text-xs"
                    >
                      {tag}
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || tagsToAdd.length === 0}>
            {isLoading ? 'Adding...' : 'Add Tags'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

