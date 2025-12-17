import { createClient } from '@/lib/supabase/client'

/**
 * Computes SHA-256 hash of an image file using Web Crypto API
 * Works in browser environment
 */
export async function computeImageHash(file: File): Promise<string> {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Compute SHA-256 hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    
    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return hashHex
  } catch (error) {
    console.error('[duplicateDetection] Failed to compute hash:', error)
    throw error
  }
}

/**
 * Checks if photos with the same hash already exist for a user
 * Returns array of indices (from imageHashes array) that are duplicates
 * Works with or without file_hash column in database
 */
export async function checkForDuplicates(
  userId: string,
  imageHashes: string[]
): Promise<number[]> {
  if (!imageHashes.length) {
    return []
  }

  const supabase = createClient()

  try {
    // Try to fetch existing assets with file_hash column
    // If column doesn't exist, the query will still work but file_hash will be null
    const { data: existingAssets, error } = await supabase
      .from('assets')
      .select('id, file_hash')
      .eq('user_id', userId)

    if (error) {
      console.error('[duplicateDetection] Failed to fetch existing assets:', error)
      // If error is due to missing column, continue without duplicate check
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.warn('[duplicateDetection] file_hash column does not exist, skipping duplicate check')
        return []
      }
      return []
    }

    if (!existingAssets || existingAssets.length === 0) {
      return []
    }

    // Check if any existing assets have matching hashes
    const existingHashes = new Set(
      existingAssets
        .map((asset) => (asset as any).file_hash)
        .filter((hash): hash is string => Boolean(hash))
    )

    // Return indices of duplicate hashes
    const duplicateIndices: number[] = []
    imageHashes.forEach((hash, index) => {
      if (existingHashes.has(hash)) {
        duplicateIndices.push(index)
      }
    })

    return duplicateIndices
  } catch (error) {
    console.error('[duplicateDetection] Error checking duplicates:', error)
    // On error, return empty array to allow import to proceed
    return []
  }
}

