import JSZip from 'jszip'
import { Asset } from '@/types'

/**
 * Downloads story assets as a ZIP file
 * @param assets Array of assets in the story (ordered by order_index)
 * @param storyName Name of the story (used as zip filename)
 * @param postText Optional post text content to include as a text file
 */
export async function downloadStoryAsZip(assets: Asset[], storyName: string, postText?: string | null): Promise<void> {
  if (!assets || assets.length === 0) {
    throw new Error('No assets to download')
  }

  const zip = new JSZip()
  const errors: string[] = []

  // Download and add each asset to the zip
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    try {
      // Get public URL
      let publicUrl = asset.publicUrl
      if (!publicUrl && asset.storage_path) {
        throw new Error('Public URL not available')
      }

      if (!publicUrl) {
        throw new Error(`No public URL available for asset ${asset.id}`)
      }

      // Determine file extension
      let extension = 'jpg'
      if (asset.original_filename) {
        const match = asset.original_filename.match(/\.([a-zA-Z0-9]+)$/i)
        if (match) {
          extension = match[1].toLowerCase()
        }
      } else if (asset.storage_path) {
        const match = asset.storage_path.match(/\.([a-zA-Z0-9]+)$/i)
        if (match) {
          extension = match[1].toLowerCase()
        }
      }

      // Normalize extension
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(extension)) {
        extension = 'jpg'
      }

      // Fetch the image
      const response = await fetch(publicUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`)
      }

      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()

      // Create filename with zero-padded index to maintain order
      const index = String(i + 1).padStart(3, '0')
      const filename = `${index}_${asset.original_filename || `image_${i + 1}.${extension}`}`

      // Add to zip
      zip.file(filename, arrayBuffer)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[DownloadStory] Failed to download asset ${asset.id}:`, errorMsg)
      errors.push(`Asset ${i + 1}: ${errorMsg}`)
    }
  }

  // Add post text file if provided
  if (postText && postText.trim()) {
    // Sanitize story name for filename (same logic as zip filename)
    const sanitizedName = storyName
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50) || 'story'
    
    const textFileName = `${sanitizedName}_copy.txt`
    zip.file(textFileName, postText.trim())
  }

  // Generate zip file
  const zipBlob = await zip.generateAsync({ type: 'blob' })

  // Create download link
  const url = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = url
  
  // Sanitize story name for filename
  const sanitizedName = storyName
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50) || 'story'
  
  link.download = `${sanitizedName}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  // Show errors if any
  if (errors.length > 0) {
    const successCount = assets.length - errors.length
    if (successCount === 0) {
      throw new Error(`Failed to download all assets.\n\nErrors:\n${errors.join('\n')}`)
    } else {
      console.warn(`[DownloadStory] Partial download: ${successCount} of ${assets.length} assets downloaded.\nErrors:\n${errors.join('\n')}`)
    }
  }
}



