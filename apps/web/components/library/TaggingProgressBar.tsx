'use client'

import { X, Sparkles } from 'lucide-react'

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

// Estimate time remaining based on batch API behavior
// Batch API typically processes ~10-20 images per minute
function getEstimatedTime(pending: number): string {
  if (pending === 0) return ''

  // Conservative estimate: ~5 seconds per image for batch processing
  const estimatedSeconds = pending * 5

  if (estimatedSeconds < 60) {
    return 'Less than a minute'
  } else if (estimatedSeconds < 120) {
    return '~1 minute'
  } else {
    const minutes = Math.ceil(estimatedSeconds / 60)
    return `~${minutes} minutes`
  }
}

export function TaggingProgressBar({ progress, onDismiss }: TaggingProgressBarProps) {
  const { total, completed, tagged, noTags } = progress
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
  const isComplete = completed >= total
  const pending = total - completed
  const estimatedTime = getEstimatedTime(pending)

  if (total === 0) return null

  return (
    <div className="border-b border-gray-100 bg-gradient-to-r from-amber-50/50 to-orange-50/50">
      <div className="px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Icon and status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex-shrink-0">
              {isComplete ? (
                <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-amber-600" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {isComplete ? 'Tagging complete' : 'AI tagging'}
              </span>
              <span className="text-sm text-gray-500">
                {completed} of {total}
              </span>
              {!isComplete && estimatedTime && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm text-gray-400">
                    {estimatedTime} remaining
                  </span>
                </>
              )}
              {isComplete && tagged > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm text-green-600">
                    {tagged} tagged
                  </span>
                </>
              )}
              {isComplete && noTags > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm text-gray-400">
                    {noTags} unmatched
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Progress bar and dismiss */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Thin progress bar */}
            <div className="hidden sm:block w-32">
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    isComplete ? 'bg-green-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Percentage */}
            <span className="text-sm tabular-nums text-gray-500 w-9 text-right">
              {percentage}%
            </span>

            {/* Dismiss button - always visible but subtle */}
            <button
              onClick={onDismiss}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
