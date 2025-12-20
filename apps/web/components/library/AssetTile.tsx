'use client'

import Image from 'next/image'
import { Asset } from '@/types'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Plus, Tag as TagIcon, Loader2, Sparkles, CheckCircle2 } from 'lucide-react'

interface AssetTileProps {
  asset: Asset
  onClick: () => void
  isSelected?: boolean
  onSelectChange?: (selected: boolean) => void
  onAddToStory?: () => void
  onEditTags?: () => void
  isRetagging?: boolean
  isCompleted?: boolean
}

export function AssetTile({
  asset,
  onClick,
  isSelected = false,
  onSelectChange,
  onAddToStory,
  onEditTags,
  isRetagging = false,
  isCompleted = false,
}: AssetTileProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isStoryBadgeOpen, setIsStoryBadgeOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  // Properly prioritize thumbnail URLs - thumb should be 400px, preview 2000px
  const imageUrl = asset.thumbUrl || asset.previewUrl || asset.publicUrl || ''
  
  const storyCount = asset.story_count || 0
  const storyNames = asset.story_names || []
  
  // Check if asset is recent (within last 48-72 hours) - based on created_at (when imported)
  // Use created_at, not date_taken, because "NEW" should indicate recently imported assets
  // Reduced to 48-72 hours for more meaningful "NEW" badge
  const isRecent = (() => {
    if (!asset.created_at) return false
    const importDate = new Date(asset.created_at)
    const hoursAgo = (Date.now() - importDate.getTime()) / (1000 * 60 * 60)
    return hoursAgo <= 72 // 3 days max
  })()
  
  // Check if asset is currently being tagged
  // Use both the database status AND the tracked retagging state
  // This ensures we show the indicator immediately when bulk retagging starts
  const isTagging = isRetagging || asset.auto_tag_status === 'pending'
  
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectChange?.(!isSelected)
  }

  return (
    <div
      className="group relative w-full h-full cursor-pointer overflow-hidden rounded-lg bg-gray-50 transition-all duration-200 hover:shadow-md hover:scale-[1.01]"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

      {/* Success Indicator - shows briefly after tagging completes */}
      {isCompleted && !isTagging && (
        <div className="absolute inset-0 z-10 bg-green-50/80 flex items-center justify-center backdrop-blur-[2px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 text-green-700 text-[10px] font-medium rounded-md shadow-card">
            <CheckCircle2 className="h-3 w-3" />
            <span>Tagged</span>
          </div>
        </div>
      )}
      
      {/* Tagging Status Indicator - subtle overlay */}
      {isTagging && (
        <div className="absolute inset-0 z-10 bg-accent/10 flex items-center justify-center backdrop-blur-[2px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-accent/20 text-accent text-[10px] font-medium rounded-md shadow-card">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Tagging...</span>
          </div>
        </div>
      )}
      
      {/* NEW Indicator - subtle, reduced visual dominance */}
      {isRecent && !isTagging && (
        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 bg-gray-700/80 text-white text-[10px] font-medium rounded-full backdrop-blur-sm">
          New
        </div>
      )}

      {/* Story Badge - subtle, neutral color */}
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
      {imageUrl && !imageError ? (
        <>
          {isLoading && (
            <div className="absolute inset-0 bg-gray-100 animate-pulse" />
          )}
          <Image
            src={imageUrl}
            alt={asset.tags?.[0] || 'Asset'}
            fill
            className={`object-cover transition-opacity duration-200 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
            onError={() => {
              setImageError(true)
              setIsLoading(false)
            }}
            onLoad={() => setIsLoading(false)}
            loading="lazy"
            quality={85}
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center bg-gray-50">
          <div className="text-center p-4">
            <svg
              className="mx-auto h-8 w-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
      )}
      
      
      {/* Overlay with tag info - Stripe-style subtle */}
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
