import * as ImageManipulator from 'expo-image-manipulator';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Compresses an image to ensure it's under 5MB
 * Tries progressively smaller dimensions until file size is acceptable
 */
export async function compressImageForUpload(
  imageUri: string,
  maxWidth: number = 2048,
  quality: number = 0.8
): Promise<{ uri: string; width: number; height: number; size: number }> {
  console.log('[compressImage] Starting compression for:', imageUri.substring(0, 50));
  
  // Try progressively smaller dimensions until under 5MB
  const widths = [maxWidth, 1536, 1024, 768, 512, 384, 256];
  const qualities = [quality, 0.7, 0.6, 0.5];
  
  for (const width of widths) {
    for (const q of qualities) {
      try {
        // Resize and compress
        const manipulated = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width } }],
          {
            compress: q,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        
        // Actually fetch the file to check real size
        const response = await fetch(manipulated.uri);
        const blob = await response.blob();
        const actualSizeBytes = blob.size;
        const actualSizeMB = actualSizeBytes / (1024 * 1024);
        
        console.log(`[compressImage] Trying ${width}px @ ${(q * 100).toFixed(0)}% quality - size: ${actualSizeMB.toFixed(2)} MB`);
        
        if (actualSizeBytes <= MAX_FILE_SIZE_BYTES) {
          console.log(`[compressImage] ✅ Successfully compressed to ${actualSizeMB.toFixed(2)} MB (${width}px @ ${(q * 100).toFixed(0)}% quality)`);
          return {
            uri: manipulated.uri,
            width: manipulated.width,
            height: manipulated.height,
            size: actualSizeBytes,
          };
        }
        
        // If still too large and this is the last quality, try next width
        if (q === qualities[qualities.length - 1]) {
          console.log(`[compressImage] ${width}px still too large (${actualSizeMB.toFixed(2)} MB), trying smaller width...`);
        }
      } catch (error) {
        console.warn(`[compressImage] Failed to compress at ${width}px @ ${(q * 100).toFixed(0)}%:`, error);
        // Continue to next quality/width
        continue;
      }
    }
  }
  
  // If we get here, even the smallest size is too large - use minimum anyway
  console.warn('[compressImage] ⚠️  Could not compress below 5MB, using minimum size');
  const final = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 256 } }],
    {
      compress: 0.5,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  
  const finalResponse = await fetch(final.uri);
  const finalBlob = await finalResponse.blob();
  const finalSizeMB = finalBlob.size / (1024 * 1024);
  console.log(`[compressImage] Using minimum size: ${finalSizeMB.toFixed(2)} MB`);
  
  return {
    uri: final.uri,
    width: final.width,
    height: final.height,
    size: finalBlob.size,
  };
}

