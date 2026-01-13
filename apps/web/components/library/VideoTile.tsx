'use client'

import { Asset } from '@/types'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Plus, Tag as TagIcon, Loader2, Sparkles, CheckCircle2, Play } from 'lucide-react'
import { formatVideoDuration } from '@/utils/videoProcessing'
import { RatingBadge } from './AssetRating'

interface VideoTileProps {
  asset: Asset
  onClick: () => void
  isSelected?: boolean
  onSelectChange?: (selected: boolean) => void
  onAddToStory?: () => void
  onEditTags?: () => void
  isRetagging?: boolean
  isCompleted?: boolean
}

export function VideoTile({
  asset,
  onClick,
  isSelected = false,
  onSelectChange,
  onAddToStory,
  onEditTags,
  isRetagging = false,
  isCompleted = false,
}: VideoTileProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isStoryBadgeOpen, setIsStoryBadgeOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrubIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Get thumbnail frame URLs
  const thumbnailFrameUrls = asset.thumbnailFrameUrls || []
  const frameCount = thumbnailFrameUrls.length

  // Primary thumbnail (first frame or regular thumb)
  const primaryThumbnail = thumbnailFrameUrls[0] || asset.thumbUrl || asset.previewUrl || asset.publicUrl || ''

  // Current frame to display
  const currentThumbnail = isHovered && frameCount > 1
    ? (thumbnailFrameUrls[currentFrameIndex] || primaryThumbnail)
    : primaryThumbnail

  const storyCount = asset.story_count || 0
  const storyNames = asset.story_names || []

  // Check if asset is recent (within last 72 hours)
  const isRecent = (() => {
    if (!asset.created_at) return false
    const importDate = new Date(asset.created_at)
    const hoursAgo = (Date.now() - importDate.getTime()) / (1000 * 60 * 60)
    return hoursAgo <= 72
  })()

  // Check if asset is currently being tagged
  const isTagging = isRetagging || asset.auto_tag_status === 'pending'

  // Handle mouse move for scrubbing through frames
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || frameCount <= 1) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const frameIndex = Math.min(
      Math.floor(percentage * frameCount),
      frameCount - 1
    )
    setCurrentFrameIndex(frameIndex)
  }, [frameCount])

  // Auto-cycle through frames when hovering (fallback for touch/no-movement)
  useEffect(() => {
    if (isHovered && frameCount > 1) {
      // Start auto-scrub after 500ms of hover without mouse movement
      scrubIntervalRef.current = setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % frameCount)
      }, 400) // Change frame every 400ms
    } else {
      if (scrubIntervalRef.current) {
        clearInterval(scrubIntervalRef.current)
        scrubIntervalRef.current = null
      }
      setCurrentFrameIndex(0)
    }

    return () => {
      if (scrubIntervalRef.current) {
        clearInterval(scrubIntervalRef.current)
      }
    }
  }, [isHovered, frameCount])

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectChange?.(!isSelected)
  }

  return (
    <div
      ref={containerRef}
      className="group relative w-full h-full cursor-pointer overflow-hidden rounded-lg bg-gray-50 transition-all duration-200 hover:shadow-md hover:scale-[1.01]"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      {/* Selection Checkbox - visible on hover */}
      {onSelectChange && (
        <div
          className={`absolute top-2 left-2 z-20 transition-opacity ${
            isHovered || isSelected ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={handleCheckboxClick}
        >
          <div className="h-5 w-5 rounded border-2 bg-white/95 shadow-sm flex items-center justify-center">
            {isSelected && (
              <div className="h-3 w-3 rounded-sm bg-accent" />
            )}
          </div>
        </div>
      )}

      {/* Video Play Icon Overlay - visible when not hovering */}
      {!isHovered && !isTagging && !isCompleted && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="h-12 w-12 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <Play className="h-6 w-6 text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Video Duration Badge */}
      {asset.video_duration_seconds && (
        <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 bg-black/70 text-white text-[10px] font-medium rounded backdrop-blur-sm">
          {formatVideoDuration(asset.video_duration_seconds)}
        </div>
      )}

      {/* Frame Indicator Dots - visible on hover when multiple frames */}
      {isHovered && frameCount > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-1">
          {thumbnailFrameUrls.slice(0, 10).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === currentFrameIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* Success Indicator - shows briefly after tagging completes */}
      {isCompleted && !isTagging && (
        <div className={`absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px] ${
          asset.tags && asset.tags.length > 0 ? 'bg-green-50/80' : 'bg-gray-50/80'
        }`}>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 bg-white text-[10px] font-medium rounded-md shadow-card ${
            asset.tags && asset.tags.length > 0
              ? 'border border-green-200 text-green-700'
              : 'border border-gray-200 text-gray-600'
          }`}>
            <CheckCircle2 className="h-3 w-3" />
            <span>{asset.tags && asset.tags.length > 0 ? 'Tagged' : 'No tags'}</span>
          </div>
        </div>
      )}

      {/* Tagging Status Indicator */}
      {isTagging && (
        <div className="absolute inset-0 z-10 bg-accent/10 flex items-center justify-center backdrop-blur-[2px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-accent/20 text-accent text-[10px] font-medium rounded-md shadow-card">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Tagging...</span>
          </div>
        </div>
      )}

      {/* NEW Indicator */}
      {isRecent && !isTagging && !asset.rating && (
        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 bg-gray-700/80 text-white text-[10px] font-medium rounded-full backdrop-blur-sm">
          New
        </div>
      )}

      {/* Rating Badge - shows approval status */}
      {!isTagging && <RatingBadge rating={asset.rating} />}

      {/* Story Badge */}
      {storyCount > 0 && (
        <Popover open={isStoryBadgeOpen} onOpenChange={setIsStoryBadgeOpen}>
          <PopoverTrigger asChild>
            <button
              className={`absolute bottom-2 left-2 z-10 px-2 py-0.5 bg-gray-600/70 text-white text-[10px] font-medium rounded-full backdrop-blur-sm hover:bg-gray-600/90 transition-all duration-200 ${
                isHovered ? 'opacity-100' : 'opacity-70'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                setIsStoryBadgeOpen(!isStoryBadgeOpen)
              }}
            >
              {storyCount} {storyCount === 1 ? 'story' : 'stories'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start" side="top">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-900 mb-2">In stories:</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {storyNames.map((storyName, idx) => (
                  <div key={idx} className="text-sm text-gray-700 py-1">
                    {storyName}
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Hover Actions */}
      {(onAddToStory || onEditTags) && isHovered && (
        <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddToStory && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onAddToStory()
              }}
              className="h-8 px-3 text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add to Story
            </Button>
          )}
          {onEditTags && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                onEditTags()
              }}
              className="h-8 px-3 text-xs bg-white"
            >
              <TagIcon className="mr-1.5 h-3.5 w-3.5" />
              Edit Tags
            </Button>
          )}
        </div>
      )}

      {/* Thumbnail Image */}
      {currentThumbnail && !imageError ? (
        <>
          {isLoading && (
            <div className="absolute inset-0 bg-gray-100 animate-pulse" />
          )}
          <img
            src={currentThumbnail}
            alt={asset.tags?.[0] || 'Video'}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-100 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onError={() => {
              setImageError(true)
              setIsLoading(false)
            }}
            onLoad={() => setIsLoading(false)}
            loading="lazy"
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center bg-gray-50">
          <div className="text-center p-4">
            <Play className="mx-auto h-8 w-8 text-gray-400" />
            <p className="text-xs text-gray-500 mt-2">Video unavailable</p>
          </div>
        </div>
      )}

      {/* Tag info overlay */}
      {asset.tags && asset.tags.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <p className="text-xs font-medium text-white truncate">
            {asset.tags[0]}
          </p>
          {asset.tags.length > 1 && (
            <p className="text-xs text-white/70 mt-0.5">
              +{asset.tags.length - 1} more
            </p>
          )}
        </div>
      )}
    </div>
  )
}
