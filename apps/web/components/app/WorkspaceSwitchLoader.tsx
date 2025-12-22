'use client'

import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Loader2 } from 'lucide-react'

/**
 * Loading indicator shown during workspace switch
 */
export function WorkspaceSwitchLoader() {
  const { isSwitching } = useWorkspace()

  if (!isSwitching) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-6 shadow-lg">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm font-medium text-gray-900">Switching workspace...</p>
      </div>
    </div>
  )
}

