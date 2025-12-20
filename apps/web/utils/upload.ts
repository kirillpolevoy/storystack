import { createClient } from '@/lib/supabase/client'
import { generateThumbnails, compressImageForAI } from './imageProcessing'
import { Asset } from '@/types'
import exifr from 'exifr'
import { computeImageHash } from './duplicateDetection'
import { extractLocationFromEXIF } from './extractLocationFromEXIF'
// @ts-ignore - heic2any doesn't have TypeScript types
import convert from 'heic2any'

export interface UploadProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error'
  error?: string
  asset?: Asset
}

/**
 * Convert HEIC/HEIF files to JPEG using heic2any library
 * Matches mobile app behavior (converts unsupported formats to JPEG)
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  const fileName = file.name.toLowerCase()
  const isHeic = fileName.endsWith('.heic') || 
                 fileName.endsWith('.heif') || 
                 file.type === 'image/heic' || 
                 file.type === 'image/heif'
  
  if (!isHeic) {
    return file // Not HEIC, return as-is
  }
  
  console.log('[upload] Converting HEIC file to JPEG:', file.name)
  
  try {
    // Use heic2any library for cross-browser HEIC conversion
    const convertedBlobs = await convert({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    })
    
    // heic2any returns an array, take the first result
    const jpegBlob = Array.isArray(convertedBlobs) ? convertedBlobs[0] : convertedBlobs
    
    if (!jpegBlob || !(jpegBlob instanceof Blob)) {
      throw new Error('HEIC conversion returned invalid result')
    }
    
    // Create new File with .jpg extension
    const jpegFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    const jpegFile = new File([jpegBlob], jpegFileName, { type: 'image/jpeg' })
    console.log('[upload] ✅ Converted HEIC to JPEG:', jpegFileName, `(${(jpegBlob.size / 1024).toFixed(0)} KB)`)
    return jpegFile
  } catch (error) {
    console.error('[upload] ❌ HEIC conversion failed:', error)
    // Throw error instead of returning original - HEIC files won't work without conversion
    throw new Error(`Failed to convert HEIC file: ${error instanceof Error ? error.message : String(error)}. Please convert HEIC files to JPEG before uploading.`)
  }
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

  // Extract EXIF data from ORIGINAL file BEFORE conversion
  // HEIC conversion may strip EXIF data, so we need to extract it first
  let dateTaken: Date | null = null
  let location: string | null = null

  // Check if file is HEIC - if so, try to extract EXIF before conversion
  const isHeic = file.name.toLowerCase().endsWith('.heic') || 
                 file.name.toLowerCase().endsWith('.heif') || 
                 file.type === 'image/heic' || 
                 file.type === 'image/heif'

  // Extract EXIF date and location from original file (before HEIC conversion)
  try {
    console.log(`[upload] Extracting EXIF from ${isHeic ? 'HEIC' : 'regular'} file: ${file.name}`)
    
    const exifData = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef', 'GPS'],
      translateKeys: false,
    })
    
    // Extract date
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
          console.log(`[upload] ✅ Extracted date from EXIF: ${dateTaken.toISOString()}`)
        }
      } else if (dateString instanceof Date) {
        dateTaken = dateString
        console.log(`[upload] ✅ Extracted date from EXIF: ${dateTaken.toISOString()}`)
      }
    }

    // Extract location from EXIF using the same implementation as mobile app
    // Extract from original file to preserve EXIF data
    location = await extractLocationFromEXIF(file)
    if (location) {
      console.log(`[upload] ✅ Extracted location from EXIF: ${location}`)
    } else {
      console.log(`[upload] No location found in EXIF data from original file`)
    }
  } catch (error) {
    console.warn('[upload] Failed to extract EXIF data from original file:', error)
    // Try to extract location separately if date extraction failed
    try {
      location = await extractLocationFromEXIF(file)
    } catch (locError) {
      console.warn('[upload] Failed to extract location from EXIF:', locError)
    }
  }

  onProgress?.(10)

  // Convert HEIC/HEIF files to JPEG before processing (matches mobile app)
  // Do this AFTER extracting EXIF data, as conversion may strip EXIF
  const processedFile = await convertHeicToJpeg(file)
  if (processedFile !== file) {
    console.log('[upload] ✅ File converted from HEIC to JPEG')
    
    // If we didn't get location from original HEIC file, try the converted JPEG
    // Some HEIC converters preserve EXIF data
    if (!location) {
      console.log('[upload] Trying to extract location from converted JPEG file...')
      try {
        const fallbackLocation = await extractLocationFromEXIF(processedFile)
        if (fallbackLocation) {
          location = fallbackLocation
          console.log(`[upload] ✅ Extracted location from converted JPEG: ${location}`)
        }
      } catch (error) {
        console.warn('[upload] Failed to extract location from converted JPEG:', error)
      }
    }
  }

  // Compute file hash for duplicate detection (use processed file)
  let fileHash: string | null = null
  try {
    fileHash = await computeImageHash(processedFile)
  } catch (error) {
    console.warn('[upload] Failed to compute file hash:', error)
    // Continue without hash - duplicate check will be skipped
  }

  // Compress image to A2 format (1024px long edge) for AI tagging - matches mobile app
  // Use processed file (HEIC converted to JPEG if needed)
  console.log('[upload] Compressing image to A2 format (1024px long edge)...')
  const a2CompressedBlob = await compressImageForAI(processedFile)
  const a2ArrayBuffer = await a2CompressedBlob.arrayBuffer()
  const a2SizeKB = a2ArrayBuffer.byteLength / 1024
  const a2SizeMB = a2SizeKB / 1024
  console.log(`[upload] ✅ A2 compression complete: ${a2SizeKB.toFixed(0)} KB (${a2SizeMB.toFixed(2)} MB)`)
  onProgress?.(20)

  // Generate thumbnails (use processed file)
  const { preview, thumb } = await generateThumbnails(processedFile)
  onProgress?.(30)

  // Get active workspace ID from localStorage (matches mobile app behavior)
  let workspaceId: string | null = null;
  if (typeof window !== 'undefined') {
    workspaceId = localStorage.getItem('@storystack:active_workspace_id');
  }
  
  // If no active workspace in localStorage, get user's first workspace
  if (!workspaceId) {
    try {
      const { data: members } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      
      workspaceId = members?.workspace_id || null;
      
      // Store in localStorage for future use
      if (workspaceId && typeof window !== 'undefined') {
        localStorage.setItem('@storystack:active_workspace_id', workspaceId);
      }
    } catch (error) {
      console.error('[upload] Error getting workspace:', error);
    }
  }
  
  if (!workspaceId) {
    throw new Error('No workspace found. Please select or create a workspace.');
  }

  // Generate unique file paths using new workspace-based structure
  // New format: workspaces/{workspace_id}/assets/{asset_id}/{filename}
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const originalFileName = file.name // Keep original filename for display
  const fileExtension = 'jpg' // A2 is always JPEG
  const baseFileName = `${timestamp}-${random}.${fileExtension}`
  
  // We'll use a temporary asset_id for the path, then update after insert
  const tempAssetId = `${timestamp}-${random}`
  const a2Path = `workspaces/${workspaceId}/assets/${tempAssetId}/${baseFileName}`
  const previewPath = `workspaces/${workspaceId}/assets/${tempAssetId}/preview/${baseFileName}`
  const thumbPath = `workspaces/${workspaceId}/assets/${tempAssetId}/thumb/${baseFileName}`

  // Upload A2 compressed image (this is what will be used for AI tagging)
  const { error: a2Error } = await supabase.storage
    .from('assets')
    .upload(a2Path, a2ArrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (a2Error) throw a2Error
  console.log(`[upload] ✅ Uploaded A2 compressed image to: ${a2Path}`)
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
  console.log(`[upload] Preparing database insert with workspace_id: ${workspaceId}, location: ${location || 'null'}`)
  
  const insertData: any = {
    user_id: user.id,
    workspace_id: workspaceId, // Required - workspace owns the asset
    storage_path: a2Path, // Use A2 compressed image path
    storage_path_preview: previewPath,
    storage_path_thumb: thumbPath,
    source: 'local', // Use 'local' to match mobile app and ensure constraint compliance
    location: location || null, // Location extracted from EXIF GPS coordinates (explicitly set null if empty)
    date_taken: dateTaken ? dateTaken.toISOString() : null,
    auto_tag_status: 'pending', // Set to pending to trigger auto-tagging
    original_filename: originalFileName, // Store original filename for display
  }
  
  console.log(`[upload] Insert data location field:`, insertData.location)

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

  // Update storage paths with actual asset_id (if different from temp)
  // Note: If the asset_id is different, we'd need to move files, but typically it matches
  const actualAssetId = inserted.id
  if (actualAssetId !== tempAssetId) {
    // Asset ID doesn't match temp ID - update paths
    // This is rare but can happen if UUIDs are used
    const newA2Path = `workspaces/${workspaceId}/assets/${actualAssetId}/${baseFileName}`
    const newPreviewPath = `workspaces/${workspaceId}/assets/${actualAssetId}/preview/${baseFileName}`
    const newThumbPath = `workspaces/${workspaceId}/assets/${actualAssetId}/thumb/${baseFileName}`
    
    // Move files (this would require a server-side function in production)
    // For now, we'll update the database paths
    // In production, implement a storage move function
    console.warn('[upload] Asset ID mismatch - storage paths may need to be updated')
  }

  // Map with URLs - use A2 path for publicUrl
  const thumbUrl = supabase.storage.from('assets').getPublicUrl(thumbPath).data.publicUrl
  const previewUrl = supabase.storage.from('assets').getPublicUrl(previewPath).data.publicUrl
  const publicUrl = supabase.storage.from('assets').getPublicUrl(a2Path).data.publicUrl // Use A2 path

  // Note: Auto-tagging is now handled in batches by the UploadZone component
  // This prevents individual API calls for each file during large imports
  // The UploadZone will batch all uploaded assets and trigger tagging efficiently

  onProgress?.(100)

  return {
    ...inserted,
    publicUrl,
    previewUrl,
    thumbUrl,
  } as Asset
}

