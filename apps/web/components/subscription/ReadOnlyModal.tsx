'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ReadOnlyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isOwner: boolean
}

export function ReadOnlyModal({ open, onOpenChange, isOwner }: ReadOnlyModalProps) {
  const router = useRouter()

  const handleResubscribe = () => {
    onOpenChange(false)
    router.push('/app/subscription')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-100 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-gray-200 flex items-center justify-center">
              <Lock className="h-5 w-5 text-gray-500" />
            </div>
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Read-only mode
              </DialogTitle>
            </DialogHeader>
          </div>
          <DialogDescription className="text-sm text-gray-600 leading-relaxed">
            {isOwner
              ? 'Your subscription has ended. Resubscribe to make changes to your workspaces.'
              : 'The workspace owner\'s subscription has ended. Contact them to restore editing access.'}
          </DialogDescription>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <div className="space-y-3 mb-5 text-sm text-gray-600">
            <p>While in read-only mode, you can:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>View all your assets and stories</li>
              <li>Download your content</li>
              <li>Browse your library</li>
            </ul>
          </div>

          <div className="space-y-3">
            {isOwner ? (
              <Button onClick={handleResubscribe} className="w-full h-11">
                Resubscribe
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full text-gray-500 hover:text-gray-700"
            >
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
