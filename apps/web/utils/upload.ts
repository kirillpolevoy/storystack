import { createClient } from '@/lib/supabase/client'
import { generateThumbnails } from './imageProcessing'
import { Asset } from '@/types'
import exifr from 'exifr'
import { computeImageHash } from './duplicateDetection'

export interface UploadProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error'
  error?: string
  asset?: Asset
}

export async function uploadAsset(
  file: File,
  onProgress?: (progress: number) => void
): Promise<Asset> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  onProgress?.(5)

  // Compute file hash for duplicate detection
  let fileHash: string | null = null
  try {
    fileHash = await computeImageHash(file)
  } catch (error) {
    console.warn('[upload] Failed to compute file hash:', error)
    // Continue without hash - duplicate check will be skipped
  }

  onProgress?.(10)

  // Extract EXIF date (when photo was taken)
  let dateTaken: Date | null = null
  try {
    const exifData = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    })
    
    // Try DateTimeOriginal first (most accurate), then CreateDate, then ModifyDate
    const dateString = exifData?.DateTimeOriginal || exifData?.CreateDate || exifData?.ModifyDate
    
    if (dateString) {
      // Handle different EXIF date formats
      if (typeof dateString === 'string') {
        // EXIF dates are typically in format: "YYYY:MM:DD HH:MM:SS"
        // Convert to ISO format: "YYYY-MM-DDTHH:MM:SS"
        const isoString = dateString.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
        const parsed = new Date(isoString)
        if (!isNaN(parsed.getTime())) {
          dateTaken = parsed
        }
      } else if (dateString instanceof Date) {
        dateTaken = dateString
      }
    }
  } catch (error) {
    console.warn('Failed to extract EXIF date:', error)
    // Continue without date_taken - will fall back to created_at
  }

  // Generate thumbnails
  const { preview, thumb } = await generateThumbnails(file)
  onProgress?.(30)

  // Generate unique file paths
  // Preserve original filename for display, but use unique name for storage to avoid conflicts
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const originalFileName = file.name
  const fileExtension = originalFileName.split('.').pop() || 'jpg'
  const baseFileName = `${timestamp}-${random}.${fileExtension}`

  const originalPath = `users/${user.id}/assets/${baseFileName}`
  const previewPath = `users/${user.id}/assets/preview/${baseFileName}`
  const thumbPath = `users/${user.id}/assets/thumb/${baseFileName}`

  // Upload original
  const originalArrayBuffer = await file.arrayBuffer()
  const { error: originalError } = await supabase.storage
    .from('assets')
    .upload(originalPath, originalArrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (originalError) throw originalError
  onProgress?.(50)

  // Upload preview
  const previewArrayBuffer = await preview.arrayBuffer()
  const { error: previewError } = await supabase.storage
    .from('assets')
    .upload(previewPath, previewArrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (previewError) throw previewError
  onProgress?.(70)

  // Upload thumb
  const thumbArrayBuffer = await thumb.arrayBuffer()
  const { error: thumbError } = await supabase.storage
    .from('assets')
    .upload(thumbPath, thumbArrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (thumbError) throw thumbError
  onProgress?.(90)

  // Insert into database
  // Use 'local' as source to match mobile app behavior
  // The database constraint allows: 'local', 'imported', 'generated'
  // Note: campaign_id may be nullable based on v0 requirements
  const insertData: any = {
    user_id: user.id,
    storage_path: originalPath,
    storage_path_preview: previewPath,
    storage_path_thumb: thumbPath,
    source: 'local', // Use 'local' to match mobile app and ensure constraint compliance
    tags: [],
    date_taken: dateTaken ? dateTaken.toISOString() : null,
    auto_tag_status: 'pending', // Set to pending to trigger auto-tagging
    original_filename: originalFileName, // Store original filename for display
  }

  // Add file_hash if available (column may not exist yet)
  if (fileHash) {
    insertData.file_hash = fileHash
  }

  const { data: inserted, error: insertError } = await supabase
    .from('assets')
    .insert(insertData)
    .select('*')
    .single()

  if (insertError) throw insertError
  onProgress?.(95)

  // Map with URLs
  const thumbUrl = supabase.storage.from('assets').getPublicUrl(thumbPath).data.publicUrl
  const previewUrl = supabase.storage.from('assets').getPublicUrl(previewPath).data.publicUrl
  const publicUrl = supabase.storage.from('assets').getPublicUrl(originalPath).data.publicUrl

  // Trigger auto-tagging after successful upload (similar to mobile app)
  // Use a small delay to ensure the database transaction is committed
  setTimeout(async () => {
    try {
      // Use Supabase client's functions.invoke for proper authentication
      const { data, error } = await supabase.functions.invoke('auto_tag_asset', {
        body: {
          assets: [
            {
              assetId: inserted.id,
              imageUrl: publicUrl,
            },
          ],
        },
      })

      if (error) {
        console.error('[upload] Auto-tagging failed:', error)
        // Don't throw - asset upload succeeded, tagging can retry later
      } else {
        console.log('[upload] Auto-tagging triggered successfully for asset:', inserted.id)
      }
    } catch (error) {
      console.error('[upload] Failed to trigger auto-tagging:', error)
      // Don't throw - asset upload succeeded, tagging can retry later
    }
  }, 500) // 500ms delay to ensure database transaction is committed

  onProgress?.(100)

  return {
    ...inserted,
    publicUrl,
    previewUrl,
    thumbUrl,
  } as Asset
}

