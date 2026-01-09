'use client'

import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Simple progress bar component
function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`bg-gray-700 rounded-full overflow-hidden ${className || ''}`}>
      <div
        className="h-full bg-blue-500 transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export interface TaggingProgress {
  total: number
  completed: number
  tagged: number      // Completed with tags
  noTags: number      // Completed without tags
  assetIds: string[]  // Asset IDs being tracked
}

interface TaggingProgressBarProps {
  progress: TaggingProgress
  onDismiss: () => void
}

export function TaggingProgressBar({ progress, onDismiss }: TaggingProgressBarProps) {
  const { total, completed, tagged, noTags } = progress
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
  const isComplete = completed >= total
  const pending = total - completed

  if (total === 0) return null

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Status icon and text */}
          <div className="flex items-center gap-3 min-w-0">
            {isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            ) : (
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">
                {isComplete ? 'Tagging Complete' : 'AI Tagging in Progress'}
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                <span>{completed}/{total} images</span>
                {tagged > 0 && (
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {tagged} tagged
                  </span>
                )}
                {noTags > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <AlertCircle className="h-3 w-3" />
                    {noTags} no tags
                  </span>
                )}
                {pending > 0 && (
                  <span className="text-gray-500">
                    {pending} pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Progress bar */}
          <div className="flex-1 max-w-md hidden sm:block">
            <ProgressBar value={percentage} className="h-2" />
          </div>

          {/* Right: Percentage and dismiss */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm font-medium text-white tabular-nums">
              {percentage}%
            </span>
            {isComplete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Mobile progress bar */}
        <div className="mt-2 sm:hidden">
          <ProgressBar value={percentage} className="h-2" />
        </div>
      </div>
    </div>
  )
}
