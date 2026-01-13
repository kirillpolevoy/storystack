'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useStoryViaLink, useIncrementStoryLinkView } from '@/hooks/useStoryLinks'
import { Asset } from '@/types'
import { ChevronLeft, ChevronRight, Loader2, Play, Grid, Maximize, Minimize, ImageOff } from 'lucide-react'
import { formatVideoDuration } from '@/utils/videoProcessing'
import { cn } from '@/lib/utils'

interface StoryViewerContentProps {
  linkId: string
}

export function StoryViewerContent({ linkId }: StoryViewerContentProps) {
  const { data: storyData, isLoading, error } = useStoryViaLink(linkId)
  const incrementView = useIncrementStoryLinkView()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const viewIncrementedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Increment view count on mount
  useEffect(() => {
    if (storyData && !viewIncrementedRef.current) {
      viewIncrementedRef.current = true
      incrementView.mutate(linkId)
    }
  }, [storyData, linkId, incrementView])

  // Reset image loaded state when changing assets
  useEffect(() => {
    setImageLoaded(false)
  }, [currentIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!storyData) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setCurrentIndex((prev) => Math.max(0, prev - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setCurrentIndex((prev) => Math.min(storyData.assets.length - 1, prev + 1))
          break
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen()
          }
          break
        case 'f':
          toggleFullscreen()
          break
        case 'g':
          setShowThumbnails((prev) => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [storyData, isFullscreen])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (containerRef.current) {
        await containerRef.current.requestFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }, [])

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const goToNext = useCallback(() => {
    if (!storyData) return
    setCurrentIndex((prev) => Math.min(storyData.assets.length - 1, prev + 1))
  }, [storyData])

  const currentAsset = useMemo(() => {
    if (!storyData || storyData.assets.length === 0) return null
    return storyData.assets[currentIndex]
  }, [storyData, currentIndex])

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Loading story...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !storyData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-6">
            <ImageOff className="h-7 w-7 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Story Not Available</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            This story link may have expired or been deactivated. Please contact the person who shared this with you.
          </p>
        </div>
      </div>
    )
  }

  // Empty story
  if (storyData.assets.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-6">
            <ImageOff className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-gray-500">This story has no assets</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'min-h-screen flex flex-col',
        isFullscreen ? 'bg-black' : 'bg-gray-50'
      )}
    >
      {/* Header */}
      <header className={cn(
        'sticky top-0 z-20 border-b transition-colors',
        isFullscreen
          ? 'bg-black/90 backdrop-blur-sm border-white/10'
          : 'bg-white border-gray-200'
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Story Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                {/* StoryStack Logo Mark */}
                <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10 shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
                    <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6"/>
                    <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6"/>
                    <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.3"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <h1 className={cn(
                    'text-base sm:text-lg font-semibold truncate',
                    isFullscreen ? 'text-white' : 'text-gray-900'
                  )}>
                    {storyData.story_name}
                  </h1>
                  {storyData.story_description && (
                    <p className={cn(
                      'text-sm truncate',
                      isFullscreen ? 'text-white/60' : 'text-gray-500'
                    )}>
                      {storyData.story_description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Counter Badge */}
              <div className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium',
                isFullscreen ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'
              )}>
                {currentIndex + 1} <span className={isFullscreen ? 'text-white/50' : 'text-gray-400'}>/</span> {storyData.assets.length}
              </div>

              {/* Grid Toggle */}
              <button
                onClick={() => setShowThumbnails((prev) => !prev)}
                className={cn(
                  'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isFullscreen
                    ? 'text-white/70 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <Grid className="h-4 w-4" />
                <span className="hidden md:inline">{showThumbnails ? 'Hide' : 'Show'}</span>
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
                  isFullscreen
                    ? 'text-white/70 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Asset Display */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="relative w-full max-w-5xl flex items-center justify-center">
            {/* Previous Button */}
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className={cn(
                'absolute left-0 sm:left-4 z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all',
                'disabled:opacity-0 disabled:pointer-events-none',
                isFullscreen
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-700 shadow-lg border border-gray-200'
              )}
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>

            {/* Asset Container */}
            {currentAsset && (
              <div className="relative w-full flex items-center justify-center">
                {currentAsset.asset_type === 'video' ? (
                  <video
                    key={currentAsset.id}
                    src={currentAsset.publicUrl}
                    className={cn(
                      'max-w-full max-h-[60vh] sm:max-h-[70vh] object-contain transition-all duration-300',
                      isFullscreen ? 'rounded-none' : 'rounded-xl shadow-elevated'
                    )}
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <div className="relative">
                    {/* Loading skeleton */}
                    {!imageLoaded && (
                      <div className={cn(
                        'absolute inset-0 animate-pulse',
                        isFullscreen ? 'bg-white/5 rounded-none' : 'bg-gray-200 rounded-xl'
                      )} />
                    )}
                    <img
                      key={currentAsset.id}
                      src={currentAsset.previewUrl || currentAsset.publicUrl}
                      alt={currentAsset.tags?.[0] || 'Story asset'}
                      onLoad={() => setImageLoaded(true)}
                      className={cn(
                        'max-w-full max-h-[60vh] sm:max-h-[70vh] object-contain transition-all duration-300',
                        isFullscreen ? 'rounded-none' : 'rounded-xl shadow-elevated',
                        !imageLoaded && 'opacity-0'
                      )}
                    />
                  </div>
                )}

                {/* Video Duration Badge */}
                {currentAsset.asset_type === 'video' && currentAsset.video_duration_seconds && (
                  <div className="absolute bottom-4 right-4 px-2.5 py-1 bg-black/70 text-white text-xs font-medium rounded-md backdrop-blur-sm">
                    {formatVideoDuration(currentAsset.video_duration_seconds)}
                  </div>
                )}
              </div>
            )}

            {/* Next Button */}
            <button
              onClick={goToNext}
              disabled={currentIndex === storyData.assets.length - 1}
              className={cn(
                'absolute right-0 sm:right-4 z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all',
                'disabled:opacity-0 disabled:pointer-events-none',
                isFullscreen
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-700 shadow-lg border border-gray-200'
              )}
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>

        {/* Thumbnail Strip */}
        {showThumbnails && (
          <div className={cn(
            'border-t py-4 px-4 sm:px-6 transition-colors',
            isFullscreen ? 'bg-black/50 border-white/10' : 'bg-white border-gray-200'
          )}>
            <div className="max-w-5xl mx-auto">
              <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300">
                {storyData.assets.map((asset: Asset, index: number) => (
                  <button
                    key={asset.id}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      'relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden transition-all',
                      index === currentIndex
                        ? 'ring-2 ring-accent ring-offset-2 ' + (isFullscreen ? 'ring-offset-black' : 'ring-offset-white')
                        : isFullscreen
                          ? 'opacity-40 hover:opacity-70'
                          : 'opacity-60 hover:opacity-100 border border-gray-200'
                    )}
                  >
                    <img
                      src={asset.thumbUrl || asset.previewUrl || asset.publicUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {asset.asset_type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Play className="h-4 w-4 text-white" fill="white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Branding */}
      <footer className={cn(
        'py-3 px-4 border-t transition-colors',
        isFullscreen ? 'bg-black/50 border-white/10' : 'bg-white border-gray-200'
      )}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs',
              isFullscreen ? 'text-white/40' : 'text-gray-400'
            )}>
              Shared via
            </span>
            <span className={cn(
              'text-xs font-semibold',
              isFullscreen ? 'text-white/60' : 'text-gray-600'
            )}>
              StoryStack
            </span>
          </div>
          <div className={cn(
            'text-xs hidden sm:block',
            isFullscreen ? 'text-white/30' : 'text-gray-400'
          )}>
            ← → Navigate • G Grid • F Fullscreen
          </div>
        </div>
      </footer>
    </div>
  )
}
