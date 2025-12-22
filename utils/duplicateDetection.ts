import * as Crypto from 'expo-crypto';
import { encode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

/**
 * Computes SHA-256 hash of an image file
 * Converts image to base64 string first since expo-crypto requires string input
 */
export async function computeImageHash(imageUri: string): Promise<string> {
  try {
    // Fetch the image file
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    
    // Convert ArrayBuffer to base64 string using base64-arraybuffer
    const base64String = encode(arrayBuffer);
    
    // Compute SHA-256 hash from base64 string
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64String
    );
    
    return hash;
  } catch (error) {
    console.error('[duplicateDetection] Failed to compute hash:', error);
    throw error;
  }
}

/**
 * Checks if photos with the same hash already exist for a user/workspace
 * Returns array of indices (from imageHashes array) that are duplicates
 * Works with or without file_hash column in database
 * 
 * @param userId - User ID (required for backward compatibility)
 * @param imageHashes - Array of image hashes to check
 * @param workspaceId - Optional workspace ID to scope duplicate check to workspace
 */
export async function checkForDuplicates(
  userId: string,
  imageHashes: string[],
  workspaceId?: string
): Promise<number[]> {
  if (!supabase || !imageHashes.length) {
    return [];
  }

  try {
    // Build query to fetch existing assets with file_hash column
    // Filter out soft-deleted assets and scope to workspace if provided
    let query = supabase
      .from('assets')
      .select('id, file_hash')
      .is('deleted_at', null); // Exclude soft-deleted assets

    // Scope to workspace if provided, otherwise fall back to user_id
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: existingAssets, error } = await query;

    if (error) {
      console.error('[duplicateDetection] Failed to fetch existing assets:', error);
      // If error is due to missing column, continue without duplicate check
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.warn('[duplicateDetection] file_hash column does not exist, skipping duplicate check');
        return [];
      }
      return [];
    }

    if (!existingAssets || existingAssets.length === 0) {
      return [];
    }

    // Check if any existing assets have matching hashes
    const existingHashes = new Set(
      existingAssets
        .map((asset) => (asset as any).file_hash)
        .filter((hash): hash is string => Boolean(hash))
    );

    // Return indices of duplicate hashes
    const duplicateIndices: number[] = [];
    imageHashes.forEach((hash, index) => {
      if (existingHashes.has(hash)) {
        duplicateIndices.push(index);
      }
    });

    return duplicateIndices;
  } catch (error) {
    console.error('[duplicateDetection] Error checking duplicates:', error);
    // On error, return empty array to allow import to proceed
    return [];
  }
}

