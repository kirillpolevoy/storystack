'use client'

import { useState, useEffect } from 'react'
import { Check, X, Circle, MessageSquare, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AssetRating as RatingType } from '@/types'

interface AssetRatingProps {
  rating: RatingType | null | undefined
  note?: string | null
  onRatingChange: (rating: RatingType | null) => void
  onNoteChange?: (note: string) => void
  compact?: boolean
  disabled?: boolean
  readOnly?: boolean
}

const ratingConfig = {
  approved: {
    icon: Check,
    label: 'Approved',
    selectedBg: 'bg-emerald-50',
    selectedBorder: 'border-emerald-200',
    selectedText: 'text-emerald-600',
    selectedIcon: 'text-emerald-500',
  },
  maybe: {
    icon: Circle,
    label: 'Maybe',
    selectedBg: 'bg-amber-50',
    selectedBorder: 'border-amber-200',
    selectedText: 'text-amber-600',
    selectedIcon: 'text-amber-500',
  },
  rejected: {
    icon: X,
    label: 'Rejected',
    selectedBg: 'bg-gray-100',
    selectedBorder: 'border-gray-300',
    selectedText: 'text-gray-600',
    selectedIcon: 'text-gray-500',
  },
}

// Consistent labels across the app
export const FEEDBACK_LABELS = {
  approved: 'Approved',
  maybe: 'Maybe',
  rejected: 'Rejected',
  unrated: 'No Feedback',
}

export function AssetRating({
  rating,
  note,
  onRatingChange,
  onNoteChange,
  compact = false,
  disabled = false,
  readOnly = false,
}: AssetRatingProps) {
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteValue, setNoteValue] = useState(note || '')

  useEffect(() => {
    setNoteValue(note || '')
  }, [note])

  const handleRatingClick = (newRating: RatingType) => {
    if (disabled || readOnly) return
    onRatingChange(rating === newRating ? null : newRating)
  }

  const handleNoteSave = () => {
    onNoteChange?.(noteValue)
    setShowNoteInput(false)
  }

  // Compact mode for grid tiles
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {(['approved', 'maybe', 'rejected'] as const).map((type) => {
          const config = ratingConfig[type]
          const Icon = config.icon
          const isActive = rating === type
          return (
            <button
              key={type}
              className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center transition-all',
                isActive
                  ? cn(config.selectedBg, 'border', config.selectedBorder)
                  : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => handleRatingClick(type)}
              disabled={disabled}
              title={config.label}
            >
              <Icon
                className={cn('h-3.5 w-3.5', isActive ? config.selectedIcon : '')}
                strokeWidth={2}
              />
            </button>
          )
        })}
      </div>
    )
  }

  // Read-only display
  if (readOnly) {
    if (!rating) {
      return (
        <p className="text-sm text-gray-400">No feedback yet</p>
      )
    }

    const config = ratingConfig[rating]
    const Icon = config.icon

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm',
              config.selectedBg,
              config.selectedText
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="font-medium">{config.label}</span>
          </div>
        </div>
        {note && (
          <p className="text-sm text-gray-600 leading-relaxed">{note}</p>
        )}
      </div>
    )
  }

  // Segmented control - the main editable UI
  return (
    <div className="space-y-3">
      {/* Segmented Control */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50/50 p-0.5">
        {(['approved', 'maybe', 'rejected'] as const).map((type) => {
          const config = ratingConfig[type]
          const Icon = config.icon
          const isActive = rating === type

          return (
            <button
              key={type}
              onClick={() => handleRatingClick(type)}
              disabled={disabled}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                isActive
                  ? cn('bg-white shadow-sm', config.selectedText, 'border', config.selectedBorder)
                  : 'text-gray-400 hover:text-gray-600',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              <span>{config.label}</span>
            </button>
          )
        })}
      </div>

      {/* Note - inline and lightweight */}
      {onNoteChange && (
        <>
          {showNoteInput ? (
            // Inline edit mode
            <div className="space-y-2 bg-gray-50 -mx-2 px-2 py-2 rounded-md">
              <Textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="resize-none text-sm bg-white"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setNoteValue(note || '')
                    setShowNoteInput(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleNoteSave}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : note ? (
            // Display existing note - clickable to edit
            <button
              className="group flex items-start gap-2 text-left w-full hover:bg-gray-50 -mx-2 px-2 py-1 rounded-md transition-colors"
              disabled={disabled}
              onClick={() => !disabled && setShowNoteInput(true)}
            >
              <MessageSquare className="h-3.5 w-3.5 text-gray-300 mt-0.5 shrink-0" />
              <span className="text-sm text-gray-500 leading-snug group-hover:text-gray-700 transition-colors flex-1">
                {note}
              </span>
              <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
            </button>
          ) : (
            // No note - show add button
            <button
              className={cn(
                'flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-500 transition-colors',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              disabled={disabled}
              onClick={() => !disabled && setShowNoteInput(true)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Add note</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}

// Subtle badge for grid display - just an icon indicator
export function RatingBadge({ rating }: { rating: RatingType | null | undefined }) {
  if (!rating) return null

  const config = ratingConfig[rating]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center z-10',
        'bg-white/90 backdrop-blur-sm shadow-sm border',
        config.selectedBorder
      )}
      title={config.label}
    >
      <Icon className={cn('h-3.5 w-3.5', config.selectedIcon)} strokeWidth={2} />
    </div>
  )
}

// Inline status indicator
export function RatingPill({ rating }: { rating: RatingType | null | undefined }) {
  if (!rating) {
    return (
      <span className="text-xs text-gray-400">—</span>
    )
  }

  const config = ratingConfig[rating]
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        config.selectedText
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {config.label}
    </span>
  )
}
