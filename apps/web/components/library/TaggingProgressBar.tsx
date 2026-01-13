'use client'

import { X, Sparkles, Check } from 'lucide-react'

export interface TaggingProgress {
  total: number
  completed: number
  tagged: number      // Completed with tags
  noTags: number      // Completed without tags
  assetIds: string[]  // Asset IDs being tracked
  estimatedSecondsRemaining: number | null  // Dynamic estimate based on progress
}

interface TaggingProgressBarProps {
  progress: TaggingProgress
  onDismiss: () => void
}

function formatTimeRemaining(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null

  if (seconds < 60) {
    return 'Less than a minute'
  } else if (seconds < 120) {
    return '~1 min remaining'
  } else {
    const minutes = Math.ceil(seconds / 60)
    return `~${minutes} min remaining`
  }
}

export function TaggingProgressBar({ progress, onDismiss }: TaggingProgressBarProps) {
  const { total, completed, tagged, noTags, estimatedSecondsRemaining } = progress
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
  const isComplete = completed >= total
  const timeRemaining = formatTimeRemaining(estimatedSecondsRemaining)

  if (total === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-72 overflow-hidden">
        {/* Progress bar at top */}
        <div className="h-1 bg-gray-100">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              isComplete ? 'bg-green-500' : 'bg-amber-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="p-3">
          <div className="flex items-start justify-between gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {isComplete ? (
                <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-3 w-3 text-green-600" strokeWidth={2.5} />
                </div>
              ) : (
                <div className="h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-amber-600" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {isComplete ? 'Tagging complete' : 'AI tagging in progress'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {completed} of {total} assets
                {!isComplete && timeRemaining && (
                  <span className="text-gray-400"> · {timeRemaining}</span>
                )}
              </p>
              {isComplete && (tagged > 0 || noTags > 0) && (
                <p className="text-xs mt-1">
                  {tagged > 0 && (
                    <span className="text-green-600">{tagged} tagged</span>
                  )}
                  {tagged > 0 && noTags > 0 && (
                    <span className="text-gray-300"> · </span>
                  )}
                  {noTags > 0 && (
                    <span className="text-gray-400">{noTags} not tagged</span>
                  )}
                </p>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={onDismiss}
              className="flex-shrink-0 p-1 -m-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
