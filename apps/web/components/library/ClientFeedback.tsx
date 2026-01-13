'use client'

import { useState, useCallback } from 'react'
import { Check, Circle, X, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssetRating } from '@/types'

// ============================================
// TUNABLE VARIABLES
// ============================================
const TUNABLE = {
  // Container
  containerRadius: 'rounded-lg',        // rounded-md | rounded-lg | rounded-xl
  containerBorder: 'border-gray-200',   // border color
  containerBg: 'bg-gray-50/50',         // subtle background

  // Segments
  segmentPadding: 'px-3 py-2',          // internal padding
  segmentRadius: 'rounded-md',          // selected segment radius
  segmentGap: 'gap-0.5',                // gap between segments

  // Typography
  labelSize: 'text-sm',                 // text-xs | text-sm
  labelWeight: 'font-medium',           // font-normal | font-medium

  // Colors (only applied to selected state)
  colors: {
    approved: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      icon: 'text-emerald-600',
    },
    maybe: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: 'text-amber-600',
    },
    rejected: {
      bg: 'bg-gray-100',
      border: 'border-gray-300',
      text: 'text-gray-700',
      icon: 'text-gray-600',
    },
  },

  // Note
  noteTextColor: 'text-gray-600',
  noteMutedColor: 'text-gray-400',
}

// ============================================
// TYPES
// ============================================
type FeedbackValue = AssetRating | null | undefined

interface ClientFeedbackProps {
  value: FeedbackValue
  onChange: (value: AssetRating | null) => void
  note?: string | null
  onNoteChange?: (note: string) => void
  disabled?: boolean
  className?: string
}

// ============================================
// SEGMENT CONFIG
// ============================================
const segments: Array<{
  value: AssetRating
  label: string
  icon: typeof Check
}> = [
  { value: 'approved', label: 'Approved', icon: Check },
  { value: 'maybe', label: 'Maybe', icon: Circle },
  { value: 'rejected', label: 'Rejected', icon: X },
]

// ============================================
// COMPONENT
// ============================================
export function ClientFeedback({
  value,
  onChange,
  note,
  onNoteChange,
  disabled = false,
  className,
}: ClientFeedbackProps) {
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(note || '')

  const handleSegmentClick = useCallback(
    (segmentValue: AssetRating) => {
      if (disabled) return
      // Toggle off if clicking the same value
      onChange(value === segmentValue ? null : segmentValue)
    },
    [disabled, onChange, value]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, segmentValue: AssetRating) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleSegmentClick(segmentValue)
      }
    },
    [handleSegmentClick]
  )

  const handleNoteSave = useCallback(() => {
    onNoteChange?.(noteValue)
    setIsEditingNote(false)
  }, [noteValue, onNoteChange])

  const handleNoteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleNoteSave()
      }
      if (e.key === 'Escape') {
        setNoteValue(note || '')
        setIsEditingNote(false)
      }
    },
    [handleNoteSave, note]
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Segmented Control */}
      <div
        role="radiogroup"
        aria-label="Feedback selection"
        className={cn(
          'inline-flex w-full p-1',
          TUNABLE.containerRadius,
          TUNABLE.containerBg,
          'border',
          TUNABLE.containerBorder,
          TUNABLE.segmentGap,
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        {segments.map((segment) => {
          const isSelected = value === segment.value
          const colors = TUNABLE.colors[segment.value]
          const Icon = segment.icon

          return (
            <button
              key={segment.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={segment.label}
              tabIndex={0}
              onClick={() => handleSegmentClick(segment.value)}
              onKeyDown={(e) => handleKeyDown(e, segment.value)}
              className={cn(
                // Base styles
                'flex-1 flex items-center justify-center gap-1.5',
                TUNABLE.segmentPadding,
                TUNABLE.segmentRadius,
                TUNABLE.labelSize,
                TUNABLE.labelWeight,
                'transition-all duration-150 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-400',

                // Selected state
                isSelected
                  ? cn(
                      colors.bg,
                      'border',
                      colors.border,
                      colors.text,
                      'shadow-sm'
                    )
                  : cn(
                      // Unselected state - muted, recedes
                      'text-gray-400',
                      'hover:text-gray-600 hover:bg-white/60',
                      'border border-transparent'
                    )
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isSelected ? colors.icon : ''
                )}
                strokeWidth={2.5}
              />
              <span>{segment.label}</span>
            </button>
          )
        })}
      </div>

      {/* Note Section */}
      {onNoteChange && (
        <div className="min-h-[28px]">
          {isEditingNote ? (
            // Edit mode
            <div className="space-y-2">
              <textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                onKeyDown={handleNoteKeyDown}
                placeholder="Add a note..."
                rows={2}
                autoFocus
                className={cn(
                  'w-full px-3 py-2 text-sm',
                  'bg-white border border-gray-200 rounded-lg',
                  'resize-none',
                  'placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300',
                  'transition-shadow'
                )}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNoteValue(note || '')
                    setIsEditingNote(false)
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNoteSave}
                  className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : note ? (
            // Display note
            <button
              type="button"
              onClick={() => {
                setNoteValue(note)
                setIsEditingNote(true)
              }}
              disabled={disabled}
              className={cn(
                'group w-full flex items-start gap-2 text-left',
                'px-2 py-1.5 -mx-2 rounded-md',
                'hover:bg-gray-50 transition-colors',
                disabled && 'pointer-events-none'
              )}
            >
              <span className={cn('text-sm leading-relaxed flex-1', TUNABLE.noteTextColor)}>
                "{note}"
              </span>
              <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
            </button>
          ) : (
            // Add note prompt
            <button
              type="button"
              onClick={() => setIsEditingNote(true)}
              disabled={disabled}
              className={cn(
                'text-sm',
                TUNABLE.noteMutedColor,
                'hover:text-gray-500 transition-colors',
                disabled && 'pointer-events-none'
              )}
            >
              + Add note
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// COMPACT BADGE (for grid tiles)
// ============================================
export function FeedbackBadge({ value }: { value: FeedbackValue }) {
  if (!value) return null

  const config = {
    approved: { icon: Check, bg: 'bg-emerald-500' },
    maybe: { icon: Circle, bg: 'bg-amber-500' },
    rejected: { icon: X, bg: 'bg-gray-500' },
  }

  const { icon: Icon, bg } = config[value]

  return (
    <div
      className={cn(
        'h-5 w-5 rounded-full flex items-center justify-center',
        'ring-2 ring-white shadow-sm',
        bg
      )}
    >
      <Icon className="h-3 w-3 text-white" strokeWidth={2.5} />
    </div>
  )
}
