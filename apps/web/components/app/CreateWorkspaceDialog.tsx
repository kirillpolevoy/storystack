'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { createWorkspace } from '@/utils/workspaceHelpers'

interface CreateWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (workspaceId: string) => void
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateWorkspaceDialogProps) {
  const [workspaceName, setWorkspaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    const trimmedName = workspaceName.trim()
    
    if (!trimmedName) {
      setError('Workspace name is required')
      return
    }

    if (trimmedName.length < 1) {
      setError('Workspace name must be at least 1 character')
      return
    }

    if (trimmedName.length > 100) {
      setError('Workspace name must be less than 100 characters')
      return
    }

    setError(null)
    setIsCreating(true)

    try {
      const workspace = await createWorkspace(trimmedName)
      setWorkspaceName('')
      onOpenChange(false)
      onSuccess(workspace.id)
    } catch (err: any) {
      console.error('[CreateWorkspaceDialog] Error creating workspace:', err)
      setError(err.message || 'Failed to create workspace. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setWorkspaceName('')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Create a new workspace to organize your content and collaborate with your team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="workspace-name" className="text-sm font-medium mb-2 block">
              Workspace Name
            </label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => {
                setWorkspaceName(e.target.value)
                setError(null)
              }}
              placeholder="My Workspace"
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating && workspaceName.trim()) {
                  handleCreate()
                }
              }}
              maxLength={100}
            />
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !workspaceName.trim()}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Workspace'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

