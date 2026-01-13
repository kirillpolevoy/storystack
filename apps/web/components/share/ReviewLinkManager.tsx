'use client'

import { useState } from 'react'
import { useReviewLinks, useCreateReviewLink, useDeleteReviewLink, useUpdateReviewLink } from '@/hooks/useReviewLinks'
import { useAvailableTags } from '@/hooks/useAvailableTags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Plus, Link as LinkIcon, Copy, Trash2, Check, ExternalLink, Users, Tag, Calendar, Loader2 } from 'lucide-react'
import { ReviewLink } from '@/types'

export function ReviewLinkManager() {
  const { data: reviewLinks, isLoading } = useReviewLinks()
  const { data: availableTags } = useAvailableTags()
  const createLink = useCreateReviewLink()
  const deleteLink = useDeleteReviewLink()
  const updateLink = useUpdateReviewLink()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<ReviewLink | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Create form state
  const [newLinkName, setNewLinkName] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [allowRating, setAllowRating] = useState(true)
  const [allowNotes, setAllowNotes] = useState(true)

  const handleCreate = async () => {
    if (!newLinkName.trim()) return

    try {
      await createLink.mutateAsync({
        name: newLinkName.trim(),
        allowedTags: selectedTags,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        allowRating,
        allowNotes,
      })

      // Reset form
      setNewLinkName('')
      setSelectedTags([])
      setExpiresAt('')
      setAllowRating(true)
      setAllowNotes(true)
      setShowCreateDialog(false)
    } catch (error) {
      console.error('Failed to create review link:', error)
    }
  }

  const handleDelete = async () => {
    if (!linkToDelete) return

    try {
      await deleteLink.mutateAsync(linkToDelete.id)
      setShowDeleteDialog(false)
      setLinkToDelete(null)
    } catch (error) {
      console.error('Failed to delete review link:', error)
    }
  }

  const handleCopyLink = async (link: ReviewLink) => {
    const url = `${window.location.origin}/review/${link.id}`
    await navigator.clipboard.writeText(url)
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleToggleActive = async (link: ReviewLink) => {
    try {
      await updateLink.mutateAsync({
        id: link.id,
        isActive: !link.is_active,
      })
    } catch (error) {
      console.error('Failed to toggle review link:', error)
    }
  }

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const isExpired = (link: ReviewLink) => {
    if (!link.expires_at) return false
    return new Date(link.expires_at) < new Date()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review Links</h2>
          <p className="text-sm text-gray-500 mt-1">
            Share links with clients to review and rate your assets
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-accent hover:bg-accent/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Link
        </Button>
      </div>

      {/* Links List */}
      {reviewLinks && reviewLinks.length > 0 ? (
        <div className="space-y-3">
          {reviewLinks.map((link) => (
            <div
              key={link.id}
              className={`border rounded-lg p-4 ${
                !link.is_active || isExpired(link)
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              } transition-colors`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900">{link.name}</h3>
                    {!link.is_active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                    {isExpired(link) && (
                      <Badge variant="secondary" className="text-xs bg-red-50 text-red-700">Expired</Badge>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {link.allowed_tags && link.allowed_tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        <span>{link.allowed_tags.length} tags</span>
                      </div>
                    )}
                    {link.expires_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {isExpired(link) ? 'Expired' : `Expires ${new Date(link.expires_at).toLocaleDateString()}`}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>
                        {link.allow_rating ? 'Rating enabled' : 'View only'}
                      </span>
                    </div>
                  </div>

                  {link.allowed_tags && link.allowed_tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {link.allowed_tags.slice(0, 5).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0.5">
                          {tag}
                        </Badge>
                      ))}
                      {link.allowed_tags.length > 5 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-gray-50">
                          +{link.allowed_tags.length - 5} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(link)}
                    className="h-8"
                  >
                    {copiedId === link.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/review/${link.id}`, '_blank')}
                    className="h-8"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLinkToDelete(link)
                      setShowDeleteDialog(true)
                    }}
                    className="h-8 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
          <LinkIcon className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">No review links yet</p>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Create a link to share assets with clients for review
          </p>
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="outline"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create your first link
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create Review Link</DialogTitle>
            <DialogDescription>
              Generate a shareable link for clients to review and rate your assets
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Link Name</label>
              <Input
                value={newLinkName}
                onChange={(e) => setNewLinkName(e.target.value)}
                placeholder="e.g., Client Review - Spring 2024"
              />
            </div>

            {/* Tag Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Filter by Tags (optional)</label>
              <p className="text-xs text-gray-500">
                Only show assets with selected tags. Leave empty to show all assets.
              </p>
              {availableTags && availableTags.length > 0 ? (
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {availableTags.map((tag) => (
                    <label
                      key={tag}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded"
                    >
                      <Checkbox
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <span className="text-sm text-gray-700">{tag}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No tags available</p>
              )}
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Expiration Date (optional)</label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Permissions</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={allowRating}
                    onCheckedChange={(checked) => setAllowRating(checked as boolean)}
                  />
                  <span className="text-sm text-gray-700">Allow clients to rate assets</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={allowNotes}
                    onCheckedChange={(checked) => setAllowNotes(checked as boolean)}
                  />
                  <span className="text-sm text-gray-700">Allow clients to add notes</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newLinkName.trim() || createLink.isPending}
              className="bg-accent hover:bg-accent/90"
            >
              {createLink.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Link'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{linkToDelete?.name}&quot;? This link will no longer work and cannot be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLink.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
