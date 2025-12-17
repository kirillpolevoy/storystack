'use client'

import { useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AssetTile } from './AssetTile'
import { Asset } from '@/types'

interface AssetGridProps {
  assets: Asset[]
  onAssetClick: (asset: Asset) => void
  hasNextPage: boolean
  fetchNextPage: () => void
  selectedAssetIds?: Set<string>
  onAssetSelect?: (assetId: string, selected: boolean) => void
  onAddToStory?: (asset: Asset) => void
  onEditTags?: (asset: Asset) => void
  retaggingAssetIds?: Set<string>
  completedRetaggingAssetIds?: Set<string>
}

// Responsive column counts
const getColumnCount = (width: number) => {
  if (width < 640) return 2
  if (width < 1024) return 3
  if (width < 1280) return 4
  if (width < 1536) return 5
  return 6
}

const GAP = 20 // Increased vertical spacing for breathing room
const PADDING = 32

export function AssetGrid({
  assets,
  onAssetClick,
  hasNextPage,
  fetchNextPage,
  selectedAssetIds = new Set(),
  onAssetSelect,
  onAddToStory,
  onEditTags,
  retaggingAssetIds = new Set(),
  completedRetaggingAssetIds = new Set(),
}: AssetGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(4)
  const [tileSize, setTileSize] = useState(200)
  const [isReady, setIsReady] = useState(false)

  // Calculate column count and tile size
  useEffect(() => {
    const updateLayout = () => {
      if (!parentRef.current) return
      
      const containerWidth = parentRef.current.offsetWidth
      if (containerWidth === 0) {
        // Container not ready yet, retry on next frame
        requestAnimationFrame(updateLayout)
        return
      }
      
      const newCount = getColumnCount(containerWidth)
      setColumnCount(newCount)
      
      // Calculate tile size: (container width - padding - gaps) / columns
      const availableWidth = containerWidth - (PADDING * 2)
      const calculatedTileSize = (availableWidth - (GAP * (newCount - 1))) / newCount
      setTileSize(calculatedTileSize)
      setIsReady(true)
    }

    // Try immediately
    updateLayout()
    
    // Also try after mount to ensure container is ready
    const timeoutId = setTimeout(updateLayout, 0)
    
    const resizeObserver = new ResizeObserver(updateLayout)
    if (parentRef.current) {
      resizeObserver.observe(parentRef.current)
    }

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [])

  const rowCount = Math.ceil(assets.length / columnCount)
  const rowHeight = tileSize + GAP // Tile height + gap

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  })
  
  // Force virtualizer to recalculate when tileSize or columnCount changes
  useEffect(() => {
    if (tileSize > 0 && columnCount > 0) {
      rowVirtualizer.measure()
    }
  }, [tileSize, columnCount, rowVirtualizer])

  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse()

    if (!lastItem) {
      return
    }

    if (
      lastItem.index >= rowCount - 1 &&
      hasNextPage
    ) {
      fetchNextPage()
    }
  }, [
    hasNextPage,
    fetchNextPage,
    rowCount,
    rowVirtualizer.getVirtualItems(),
  ])

  // Don't render grid until we have valid dimensions
  if (!isReady || tileSize <= 0) {
    return (
      <div
        ref={parentRef}
        className="h-full overflow-auto"
        style={{ 
          padding: `${PADDING}px`,
          boxSizing: 'border-box',
        }}
      >
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
      style={{ 
        padding: `${PADDING}px`,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
          minHeight: '100%',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount
          const endIndex = Math.min(startIndex + columnCount, assets.length)
          const rowAssets = assets.slice(startIndex, endIndex)

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: `${GAP}px`,
              }}
            >
              <div
                className="grid w-full"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, ${tileSize}px)`,
                  gap: `${GAP}px`,
                  justifyContent: 'start',
                }}
              >
                {rowAssets.map((asset) => (
                  <div 
                    key={asset.id} 
                    style={{ 
                      width: `${tileSize}px`,
                      height: `${tileSize}px`,
                    }}
                  >
                    <AssetTile
                      asset={asset}
                      onClick={() => onAssetClick(asset)}
                      isSelected={selectedAssetIds.has(asset.id)}
                      onSelectChange={(selected) => onAssetSelect?.(asset.id, selected)}
                      onAddToStory={() => onAddToStory?.(asset)}
                      onEditTags={() => onEditTags?.(asset)}
                      isRetagging={retaggingAssetIds.has(asset.id)}
                      isCompleted={completedRetaggingAssetIds.has(asset.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
