/**
 * Script to regenerate thumbnails for existing assets
 * This fixes pixelation by regenerating thumbnails at 800px instead of 400px
 * 
 * Usage: Run this from the browser console or as a one-time script
 */

import { createClient } from '@/lib/supabase/client'
import { generateThumbnails } from '@/utils/imageProcessing'

export async function regenerateThumbnailsForAssets(
  batchSize: number = 10,
  workspaceId?: string
): Promise<{ processed: number; succeeded: number; failed: number; errors: string[] }> {
  const supabase = createClient()
  
  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Not authenticated')
  }

  console.log(`[regenerateThumbnails] Starting regeneration (batch size: ${batchSize})`)

  // Get assets that need thumbnail regeneration
  const { data: assets, error: fetchError } = await supabase
    .rpc('get_assets_needing_thumbnail_regeneration', {
      batch_size: batchSize,
      workspace_id_filter: workspaceId || null,
    })

  if (fetchError) {
    throw new Error(`Failed to fetch assets: ${fetchError.message}`)
  }

  if (!assets || assets.length === 0) {
    console.log('[regenerateThumbnails] No assets need regeneration')
    return { processed: 0, succeeded: 0, failed: 0, errors: [] }
  }

  console.log(`[regenerateThumbnails] Found ${assets.length} assets to process`)

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as string[],
  }

  // Process each asset
  for (const asset of assets) {
    try {
      console.log(`[regenerateThumbnails] Processing asset ${asset.id}...`)

      // Download the original image (use storage_path which is the A2 compressed version)
      const { data: imageBlob, error: downloadError } = await supabase.storage
        .from('assets')
        .download(asset.storage_path)

      if (downloadError || !imageBlob) {
        console.error(`[regenerateThumbnails] Failed to download image:`, downloadError)
        results.failed++
        results.errors.push(`Asset ${asset.id}: Failed to download image`)
        continue
      }

      // Convert blob to File for imageProcessing
      const file = new File([imageBlob], 'image.jpg', { type: 'image/jpeg' })

      // Generate new thumbnails (800px) using existing utility
      const { thumb } = await generateThumbnails(file)
      console.log(`[regenerateThumbnails] Generated new thumbnail for ${asset.id}`)

      // Upload new thumbnail
      const thumbArrayBuffer = await thumb.arrayBuffer()
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(asset.storage_path_thumb, thumbArrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true, // Overwrite existing thumbnail
        })

      if (uploadError) {
        console.error(`[regenerateThumbnails] Failed to upload thumbnail:`, uploadError)
        results.failed++
        results.errors.push(`Asset ${asset.id}: Failed to upload thumbnail`)
        continue
      }

      // Mark as regenerated
      const { error: markError } = await supabase.rpc('mark_thumbnail_regenerated', {
        asset_id: asset.id,
      })

      if (markError) {
        console.error(`[regenerateThumbnails] Failed to mark as regenerated:`, markError)
        // Don't fail the whole operation, but log it
      }

      console.log(`[regenerateThumbnails] ✅ Successfully regenerated thumbnail for ${asset.id}`)
      results.succeeded++

    } catch (error) {
      console.error(`[regenerateThumbnails] Error processing asset ${asset.id}:`, error)
      results.failed++
      results.errors.push(`Asset ${asset.id}: ${error instanceof Error ? error.message : String(error)}`)
    }

    results.processed++
  }

  console.log(`[regenerateThumbnails] Complete: ${results.succeeded} succeeded, ${results.failed} failed`)
  return results
}

// Export a convenience function for running from browser console
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.regenerateThumbnails = regenerateThumbnailsForAssets
}

