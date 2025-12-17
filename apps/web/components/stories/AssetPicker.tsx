'use client'

import { useState } from 'react'
import { useAssets } from '@/hooks/useAssets'
import { Asset } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AssetTile } from '@/components/library/AssetTile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface AssetPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (asset: Asset) => void
  excludeAssetIds?: string[]
}

export function AssetPicker({
  open,
  onClose,
  onSelect,
  excludeAssetIds = [],
}: AssetPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAssets(searchQuery)

  const assets =
    data?.pages.flatMap((page: { assets: Asset[] }) => page.assets).filter(
      (asset: Asset) => !excludeAssetIds.includes(asset.id)
    ) || []

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle>Select Asset</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {assets.map((asset: Asset) => (
                <div
                  key={asset.id}
                  onClick={() => {
                    onSelect(asset)
                    onClose()
                  }}
                >
                  <AssetTile asset={asset} onClick={() => {}} />
                </div>
              ))}
            </div>
          </div>
          {hasNextPage && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

