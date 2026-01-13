'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateReviewLink } from '@/hooks/useReviewLinks'
import { Copy, Check, ExternalLink, Loader2, Share2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

interface BulkShareReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedAssetIds: string[]
  onSuccess?: () => void
}

export function BulkShareReviewModal({
  open,
  onOpenChange,
  selectedAssetIds,
  onSuccess,
}: BulkShareReviewModalProps) {
  const createReviewLink = useCreateReviewLink()
  const [name, setName] = useState('')
  const [allowRating, setAllowRating] = useState(true)
  const [allowNotes, setAllowNotes] = useState(true)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setName(`Review ${selectedAssetIds.length} assets`)
      setAllowRating(true)
      setAllowNotes(true)
      setCreatedLink(null)
      setCopied(false)
    }
  }, [open, selectedAssetIds.length])

  const handleCreate = async () => {
    try {
      const result = await createReviewLink.mutateAsync({
        name: name.trim() || `Review ${selectedAssetIds.length} assets`,
        allowedAssetIds: selectedAssetIds,
        allowRating,
        allowNotes,
      })

      const linkUrl = `${window.location.origin}/review/${result.id}`
      setCreatedLink(linkUrl)

      toast({
        title: 'Review link created',
        description: 'Share this link with your client to get feedback',
      })
    } catch (error) {
      console.error('Failed to create review link:', error)
      toast({
        title: 'Failed to create link',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      })
    }
  }

  const handleCopy = async () => {
    if (!createdLink) return

    try {
      await navigator.clipboard.writeText(createdLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: 'Link copied',
        description: 'Review link copied to clipboard',
      })
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleOpenLink = () => {
    if (createdLink) {
      window.open(createdLink, '_blank')
    }
  }

  const handleClose = () => {
    if (createdLink) {
      onSuccess?.()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-accent" />
            Share for Review
          </DialogTitle>
          <DialogDescription>
            Create a link to share {selectedAssetIds.length} selected {selectedAssetIds.length === 1 ? 'asset' : 'assets'} with your client for review and rating.
          </DialogDescription>
        </DialogHeader>

        {!createdLink ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="link-name">Link name</Label>
              <Input
                id="link-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Wedding photos for review"
              />
              <p className="text-xs text-gray-500">
                A descriptive name helps you identify this link later
              </p>
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-rating" className="text-sm font-medium">
                    Allow rating
                  </Label>
                  <p className="text-xs text-gray-500">
                    Client can approve, maybe, or reject assets
                  </p>
                </div>
                <Switch
                  id="allow-rating"
                  checked={allowRating}
                  onCheckedChange={setAllowRating}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-notes" className="text-sm font-medium">
                    Allow notes
                  </Label>
                  <p className="text-xs text-gray-500">
                    Client can add notes to assets
                  </p>
                </div>
                <Switch
                  id="allow-notes"
                  checked={allowNotes}
                  onCheckedChange={setAllowNotes}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createReviewLink.isPending}
                className="bg-accent hover:bg-accent/90"
              >
                {createReviewLink.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Link'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Review link</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={createdLink}
                  readOnly
                  className="font-mono text-sm bg-gray-50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Share this link with your client. They can view and rate the assets without signing in.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleOpenLink}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Link
              </Button>
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
