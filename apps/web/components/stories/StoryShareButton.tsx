'use client'

import { useState } from 'react'
import { useStoryLinks, useCreateStoryLink, useDeleteStoryLink } from '@/hooks/useStoryLinks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import { Share2, Copy, Check, Trash2, ExternalLink, Loader2, Plus, Calendar, Eye } from 'lucide-react'
import { StoryLink } from '@/types'

interface StoryShareButtonProps {
  storyId: string
  storyName: string
}

export function StoryShareButton({ storyId, storyName }: StoryShareButtonProps) {
  const { data: links, isLoading } = useStoryLinks(storyId)
  const createLink = useCreateStoryLink()
  const deleteLink = useDeleteStoryLink()

  const [isOpen, setIsOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<StoryLink | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newLinkName, setNewLinkName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const handleCopyLink = async (link: StoryLink) => {
    const url = `${window.location.origin}/story/${link.id}`
    await navigator.clipboard.writeText(url)
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCreateLink = async () => {
    try {
      await createLink.mutateAsync({
        storyId,
        name: newLinkName.trim() || `Share - ${storyName}`,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      setIsCreating(false)
      setNewLinkName('')
      setExpiresAt('')
    } catch (error) {
      console.error('Failed to create share link:', error)
    }
  }

  const handleDeleteLink = async () => {
    if (!linkToDelete) return

    try {
      await deleteLink.mutateAsync({
        id: linkToDelete.id,
        storyId,
      })
      setShowDeleteDialog(false)
      setLinkToDelete(null)
    } catch (error) {
      console.error('Failed to delete share link:', error)
    }
  }

  const isExpired = (link: StoryLink) => {
    if (!link.expires_at) return false
    return new Date(link.expires_at) < new Date()
  }

  const activeLinks = links?.filter((l) => l.is_active && !isExpired(l)) || []

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Share2 className="h-4 w-4 mr-2" />
            Share
            {activeLinks.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded">
                {activeLinks.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Share Story</h3>
            <p className="text-xs text-gray-500 mt-1">
              Create shareable links for clients to view this story
            </p>
          </div>

          <div className="p-2 max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="py-4 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : isCreating ? (
              // Create form
              <div className="p-2 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Link Name</label>
                  <Input
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                    placeholder={`Share - ${storyName}`}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Expires (optional)</label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleCreateLink}
                    disabled={createLink.isPending}
                    className="flex-1 h-8"
                  >
                    {createLink.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Create'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsCreating(false)
                      setNewLinkName('')
                      setExpiresAt('')
                    }}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : links && links.length > 0 ? (
              // Links list
              <div className="space-y-1">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className={`p-2 rounded-lg ${
                      !link.is_active || isExpired(link)
                        ? 'bg-gray-50 opacity-60'
                        : 'hover:bg-gray-50'
                    } transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {link.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          {link.view_count > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Eye className="h-3 w-3" />
                              {link.view_count}
                            </span>
                          )}
                          {link.expires_at && (
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {isExpired(link) ? 'Expired' : new Date(link.expires_at).toLocaleDateString()}
                            </span>
                          )}
                          {!link.is_active && (
                            <span className="text-gray-400">Inactive</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLink(link)}
                          className="h-7 w-7 p-0"
                          disabled={!link.is_active || isExpired(link)}
                        >
                          {copiedId === link.id ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/story/${link.id}`, '_blank')}
                          className="h-7 w-7 p-0"
                          disabled={!link.is_active || isExpired(link)}
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
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Empty state
              <div className="py-6 text-center">
                <Share2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No share links yet</p>
              </div>
            )}
          </div>

          {!isCreating && (
            <div className="p-2 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreating(true)}
                className="w-full h-8 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Share Link
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Share Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{linkToDelete?.name}&quot;? This link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLink}
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
    </>
  )
}
