'use client'

import { useState, useMemo } from 'react'
import { useReviewLinkInfo, useReviewLinkAssets } from '@/hooks/useReviewLinks'
import { useUpdateAssetRatingViaReviewLink } from '@/hooks/useUpdateAssetRating'
import { Asset, AssetRating } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Check, X, Circle, Loader2, Play, Film, ChevronLeft, ChevronRight, MessageSquare, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatVideoDuration } from '@/utils/videoProcessing'

interface ReviewPageContentProps {
  linkId: string
}

export function ReviewPageContent({ linkId }: ReviewPageContentProps) {
  const { data: linkInfo, isLoading: isLoadingInfo, error: infoError } = useReviewLinkInfo(linkId)
  const { data: assets, isLoading: isLoadingAssets } = useReviewLinkAssets(linkId)
  const updateRating = useUpdateAssetRatingViaReviewLink()

  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteValue, setNoteValue] = useState('')

  // Get unique tags from assets or use allowed_tags from link
  const availableTags = useMemo(() => {
    if (linkInfo?.allowed_tags && linkInfo.allowed_tags.length > 0) {
      return linkInfo.allowed_tags
    }
    if (!assets) return []
    const tags = new Set<string>()
    assets.forEach((asset: Asset) => {
      asset.tags?.forEach((tag) => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [linkInfo, assets])

  // Filter assets by selected tag
  const filteredAssets = useMemo(() => {
    if (!assets) return []
    if (!selectedTag) return assets
    return assets.filter((asset: Asset) => asset.tags?.includes(selectedTag))
  }, [assets, selectedTag])

  // Handle rating change with optimistic update
  const handleRatingChange = async (asset: Asset, rating: AssetRating | null) => {
    if (!linkInfo?.allow_rating) return

    // Optimistic update - immediately update the UI
    const updatedAsset = { ...asset, rating }
    setSelectedAsset(updatedAsset)

    try {
      await updateRating.mutateAsync({
        linkId,
        assetId: asset.id,
        rating,
        note: asset.rating_note,
      })
    } catch (error) {
      console.error('Failed to update rating:', error)
      // Revert on error
      setSelectedAsset(asset)
    }
  }

  // Handle note save with optimistic update
  const handleNoteSave = async () => {
    if (!selectedAsset || !linkInfo?.allow_notes) return

    // Optimistic update - immediately update the UI
    const updatedAsset = { ...selectedAsset, rating_note: noteValue }
    setSelectedAsset(updatedAsset)
    setShowNoteInput(false)

    try {
      await updateRating.mutateAsync({
        linkId,
        assetId: selectedAsset.id,
        rating: selectedAsset.rating || null,
        note: noteValue,
      })
    } catch (error) {
      console.error('Failed to save note:', error)
      // Revert on error
      setSelectedAsset(selectedAsset)
      setShowNoteInput(true)
    }
  }

  // Navigate between assets in modal
  const currentIndex = useMemo(() => {
    if (!selectedAsset || !filteredAssets) return -1
    return filteredAssets.findIndex((a: Asset) => a.id === selectedAsset.id)
  }, [selectedAsset, filteredAssets])

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevAsset = filteredAssets[currentIndex - 1]
      setSelectedAsset(prevAsset)
      setNoteValue(prevAsset.rating_note || '')
    }
  }

  const handleNext = () => {
    if (currentIndex < filteredAssets.length - 1) {
      const nextAsset = filteredAssets[currentIndex + 1]
      setSelectedAsset(nextAsset)
      setNoteValue(nextAsset.rating_note || '')
    }
  }

  // Loading state
  if (isLoadingInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading review...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (infoError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link Not Available</h1>
          <p className="text-sm text-gray-600">
            This review link may have expired or been deactivated. Please contact the person who shared this link with you.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{linkInfo?.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {linkInfo?.workspace_name} | {filteredAssets.length} assets
              </p>
            </div>
            {linkInfo?.allow_rating && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Rate each asset:</span>
                <RatingLegend />
              </div>
            )}
          </div>

          {/* Tag Filter Pills */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                variant={selectedTag === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTag(null)}
                className="h-7 text-xs"
              >
                All ({assets?.length || 0})
              </Button>
              {availableTags.map((tag) => {
                const count = assets?.filter((a: Asset) => a.tags?.includes(tag)).length || 0
                return (
                  <Button
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTag(tag)}
                    className="h-7 text-xs"
                  >
                    {tag} ({count})
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </header>

      {/* Asset Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoadingAssets ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No assets to review</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredAssets.map((asset: Asset) => (
              <ReviewAssetTile
                key={asset.id}
                asset={asset}
                onClick={() => {
                  setSelectedAsset(asset)
                  setNoteValue(asset.rating_note || '')
                }}
                onRatingChange={
                  linkInfo?.allow_rating
                    ? (rating) => handleRatingChange(asset, rating)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </main>

      {/* Asset Detail Modal - Mobile Optimized */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/95 md:bg-black/80">
          {/* Close button - only visible on mobile, desktop has it in side panel */}
          <button
            onClick={() => {
              setSelectedAsset(null)
              setShowNoteInput(false)
            }}
            className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors md:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Mobile Layout */}
          <div className="h-full flex flex-col md:flex-row">
            {/* Asset Preview */}
            <div className="relative flex-1 flex items-center justify-center min-h-0">
              {selectedAsset.asset_type === 'video' ? (
                <video
                  src={selectedAsset.publicUrl}
                  className="max-w-full max-h-full object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={selectedAsset.previewUrl || selectedAsset.publicUrl}
                  alt={selectedAsset.tags?.[0] || 'Asset'}
                  className="max-w-full max-h-full object-contain"
                />
              )}

              {/* Counter Badge */}
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                {currentIndex + 1} / {filteredAssets.length}
              </div>

              {/* Current Rating Badge on Image */}
              {selectedAsset.rating && (
                <div className="absolute top-4 left-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium bg-white/90 backdrop-blur-sm shadow-sm">
                  {selectedAsset.rating === 'approved' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
                      <span className="text-emerald-700">Approved</span>
                    </>
                  ) : selectedAsset.rating === 'maybe' ? (
                    <>
                      <Circle className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
                      <span className="text-amber-700">Maybe</span>
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5 text-gray-500" strokeWidth={2.5} />
                      <span className="text-gray-700">Rejected</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile: Bottom Sheet / Desktop: Side Panel */}
            <div className="bg-white md:w-96 md:h-full flex flex-col rounded-t-3xl md:rounded-none shadow-2xl md:shadow-none">
              {/* Drag Handle (Mobile) / Close button (Desktop) */}
              <div className="flex justify-center pt-3 pb-2 md:justify-end md:pt-3 md:pb-0 md:pr-3">
                <div className="w-10 h-1 bg-gray-300 rounded-full md:hidden" />
                <button
                  onClick={() => {
                    setSelectedAsset(null)
                    setShowNoteInput(false)
                  }}
                  className="hidden md:flex h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Feedback Control - Calm segmented design */}
              {linkInfo?.allow_rating && (
                <div className="px-4 md:px-6 py-4 md:py-5">
                  <div
                    role="radiogroup"
                    aria-label="Rate this asset"
                    className="flex w-full p-1 rounded-xl bg-gray-100/80 border border-gray-200/50 gap-1"
                  >
                    {([
                      { value: 'approved' as const, label: 'Approved', icon: Check, colors: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-600' } },
                      { value: 'maybe' as const, label: 'Maybe', icon: Circle, colors: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-600' } },
                      { value: 'rejected' as const, label: 'Rejected', icon: X, colors: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700', icon: 'text-gray-500' } },
                    ]).map((option) => {
                      const isSelected = selectedAsset.rating === option.value
                      const Icon = option.icon
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => handleRatingChange(
                            selectedAsset,
                            isSelected ? null : option.value
                          )}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-3 md:py-3.5 rounded-lg',
                            'text-sm font-medium',
                            'transition-all duration-150 active:scale-[0.98]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1',
                            isSelected
                              ? cn(option.colors.bg, 'border', option.colors.border, option.colors.text, 'shadow-sm')
                              : 'text-gray-400 hover:text-gray-600 hover:bg-white/50 border border-transparent'
                          )}
                        >
                          <Icon className={cn('h-4 w-4 shrink-0', isSelected && option.colors.icon)} strokeWidth={2.5} />
                          <span className="truncate">{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Note Section - Compact and integrated */}
              {linkInfo?.allow_notes && (
                <div className="px-4 md:px-6 py-3 flex-1 overflow-y-auto border-t border-gray-100">
                  {showNoteInput ? (
                    <div className="space-y-3">
                      <textarea
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        placeholder="Add a note..."
                        rows={2}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleNoteSave()
                          }
                          if (e.key === 'Escape') {
                            setShowNoteInput(false)
                            setNoteValue(selectedAsset.rating_note || '')
                          }
                        }}
                        className="w-full px-3 py-2.5 text-base bg-white border border-gray-200 rounded-lg resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setShowNoteInput(false)
                            setNoteValue(selectedAsset.rating_note || '')
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleNoteSave}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : selectedAsset.rating_note ? (
                    <button
                      onClick={() => {
                        setNoteValue(selectedAsset.rating_note || '')
                        setShowNoteInput(true)
                      }}
                      className="group w-full flex items-start gap-2 text-left px-2 py-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm md:text-base text-gray-600 leading-relaxed flex-1">
                        "{selectedAsset.rating_note}"
                      </span>
                      <Pencil className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowNoteInput(true)}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-500 transition-colors py-1"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Add note</span>
                    </button>
                  )}
                </div>
              )}

              {/* Mobile Navigation Footer */}
              <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/50 safe-area-pb">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="flex-1 h-12 rounded-xl border-gray-200 disabled:opacity-40 text-base font-medium"
                  >
                    <ChevronLeft className="h-5 w-5 mr-1" />
                    Previous
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={currentIndex === filteredAssets.length - 1}
                    className="flex-1 h-12 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-base font-medium"
                  >
                    Next
                    <ChevronRight className="h-5 w-5 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Rating Legend
function RatingLegend() {
  return (
    <div className="flex items-center gap-3 text-gray-500">
      <div className="flex items-center gap-1">
        <Check className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs">Approved</span>
      </div>
      <div className="flex items-center gap-1">
        <Circle className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-xs">Maybe</span>
      </div>
      <div className="flex items-center gap-1">
        <X className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs">Rejected</span>
      </div>
    </div>
  )
}

// Rating Button
function RatingButton({
  type,
  active,
  onClick,
}: {
  type: 'approved' | 'maybe' | 'rejected'
  active: boolean
  onClick: () => void
}) {
  const config = {
    approved: {
      icon: Check,
      label: 'Approved',
      activeClass: 'bg-green-500 text-white border-green-500',
      inactiveClass: 'text-green-600 border-green-200 hover:bg-green-50',
    },
    maybe: {
      icon: Circle,
      label: 'Maybe',
      activeClass: 'bg-yellow-500 text-white border-yellow-500',
      inactiveClass: 'text-yellow-600 border-yellow-200 hover:bg-yellow-50',
    },
    rejected: {
      icon: X,
      label: 'Rejected',
      activeClass: 'bg-red-500 text-white border-red-500',
      inactiveClass: 'text-red-600 border-red-200 hover:bg-red-50',
    },
  }

  const { icon: Icon, label, activeClass, inactiveClass } = config[type]

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${
        active ? activeClass : inactiveClass
      }`}
      title={label}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

// Review Asset Tile
function ReviewAssetTile({
  asset,
  onClick,
  onRatingChange,
}: {
  asset: Asset
  onClick: () => void
  onRatingChange?: (rating: AssetRating | null) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)

  const isVideo = asset.asset_type === 'video'
  const thumbnailFrameUrls = asset.thumbnailFrameUrls || []
  const frameCount = thumbnailFrameUrls.length
  const primaryThumbnail = thumbnailFrameUrls[0] || asset.thumbUrl || asset.previewUrl || asset.publicUrl || ''
  const currentThumbnail = isHovered && frameCount > 1
    ? (thumbnailFrameUrls[currentFrameIndex] || primaryThumbnail)
    : primaryThumbnail

  // Auto-cycle through frames on hover
  React.useEffect(() => {
    if (isHovered && frameCount > 1) {
      const interval = setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % frameCount)
      }, 400)
      return () => clearInterval(interval)
    } else {
      setCurrentFrameIndex(0)
    }
  }, [isHovered, frameCount])

  return (
    <div
      className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image/Video Thumbnail */}
      <img
        src={currentThumbnail}
        alt={asset.tags?.[0] || 'Asset'}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Video indicator */}
      {isVideo && !isHovered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
          </div>
        </div>
      )}

      {/* Duration badge for videos */}
      {isVideo && asset.video_duration_seconds && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-medium rounded">
          {formatVideoDuration(asset.video_duration_seconds)}
        </div>
      )}

      {/* Rating Badge */}
      {asset.rating && (
        <RatingBadge rating={asset.rating} />
      )}

      {/* Quick Rating Buttons (on hover) */}
      {onRatingChange && isHovered && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRatingChange(asset.rating === 'approved' ? null : 'approved')
            }}
            className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
              asset.rating === 'approved'
                ? 'bg-green-500 text-white'
                : 'bg-white/90 text-green-600 hover:bg-green-100'
            }`}
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRatingChange(asset.rating === 'maybe' ? null : 'maybe')
            }}
            className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
              asset.rating === 'maybe'
                ? 'bg-yellow-500 text-white'
                : 'bg-white/90 text-yellow-600 hover:bg-yellow-100'
            }`}
          >
            <Circle className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRatingChange(asset.rating === 'rejected' ? null : 'rejected')
            }}
            className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
              asset.rating === 'rejected'
                ? 'bg-red-500 text-white'
                : 'bg-white/90 text-red-600 hover:bg-red-100'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// Rating Badge - Subtle white background with colored icon
function RatingBadge({ rating }: { rating: AssetRating }) {
  const config = {
    approved: { icon: Check, iconClass: 'text-emerald-600', borderClass: 'border-emerald-200' },
    maybe: { icon: Circle, iconClass: 'text-amber-600', borderClass: 'border-amber-200' },
    rejected: { icon: X, iconClass: 'text-gray-500', borderClass: 'border-gray-300' },
  }

  const { icon: Icon, iconClass, borderClass } = config[rating]

  return (
    <div
      className={`absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center z-10 bg-white/90 backdrop-blur-sm shadow-sm border ${borderClass}`}
    >
      <Icon className={`h-3.5 w-3.5 ${iconClass}`} strokeWidth={2.5} />
    </div>
  )
}

// Import React for useEffect
import React from 'react'
