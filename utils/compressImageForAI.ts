import * as ImageManipulator from 'expo-image-manipulator';

const AI_TARGET_LONG_EDGE = 1024;

/**
 * Compresses an image to 1024px long edge (maintaining aspect ratio) for AI tagging
 * This is A2 compression - used only for OpenAI tagging
 * Returns the compressed image URI and dimensions
 */
export async function compressImageForAI(
  imageUri: string
): Promise<{ uri: string; width: number; height: number; size: number }> {
  console.log('[compressImageForAI] Starting A2 compression for:', imageUri.substring(0, 50));
  
  try {
    // Get image dimensions first
    const imageInfo = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );
    
    const originalWidth = imageInfo.width;
    const originalHeight = imageInfo.height;
    const longEdge = Math.max(originalWidth, originalHeight);
    
    console.log(`[compressImageForAI] Original dimensions: ${originalWidth}x${originalHeight}, long edge: ${longEdge}px`);
    
    // If image is already ≤1024px on long edge, return original (no compression needed)
    if (longEdge <= AI_TARGET_LONG_EDGE) {
      console.log(`[compressImageForAI] ✅ Image already ≤${AI_TARGET_LONG_EDGE}px, no compression needed`);
      const response = await fetch(imageUri);
      const blob = await response.blob();
      return {
        uri: imageUri,
        width: originalWidth,
        height: originalHeight,
        size: blob.size,
      };
    }
    
    // Calculate new dimensions maintaining aspect ratio
    const scale = AI_TARGET_LONG_EDGE / longEdge;
    const newWidth = Math.round(originalWidth * scale);
    const newHeight = Math.round(originalHeight * scale);
    
    console.log(`[compressImageForAI] Resizing to ${newWidth}x${newHeight} (${AI_TARGET_LONG_EDGE}px long edge)`);
    
    // Resize to 1024px long edge, maintain aspect ratio
    // Target 200-500KB file size (same as Edge Function A2 compression)
    // Try progressively lower quality if file is too large
    const qualities = [0.85, 0.75, 0.65, 0.55, 0.50];
    const TARGET_MAX_KB = 500;
    const TARGET_MIN_KB = 200;
    
    let manipulated: ImageManipulator.ImageResult | null = null;
    let actualSizeBytes = 0;
    let actualSizeMB = 0;
    let usedQuality = 0.85;
    
    for (const quality of qualities) {
      manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: newWidth, height: newHeight } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      // Get actual file size
      const response = await fetch(manipulated.uri);
      const blob = await response.blob();
      actualSizeBytes = blob.size;
      actualSizeMB = actualSizeBytes / (1024 * 1024);
      const actualSizeKB = actualSizeBytes / 1024;
      
      usedQuality = quality;
      
      // If within target range or below max, use this quality
      if (actualSizeKB <= TARGET_MAX_KB) {
        console.log(`[compressImageForAI] ✅ A2 compression complete: ${newWidth}x${newHeight}, ${actualSizeKB.toFixed(0)} KB (${actualSizeMB.toFixed(2)} MB) @ ${(quality * 100).toFixed(0)}% quality`);
        break;
      }
      
      // If this is the last quality and still too large, use it anyway (Edge Function will handle base64 conversion)
      if (quality === qualities[qualities.length - 1]) {
        console.log(`[compressImageForAI] ⚠️  A2 compression: ${newWidth}x${newHeight}, ${actualSizeKB.toFixed(0)} KB (${actualSizeMB.toFixed(2)} MB) @ ${(quality * 100).toFixed(0)}% quality - larger than target but will use (Edge Function will convert to base64 if needed)`);
        break;
      }
      
      console.log(`[compressImageForAI] Trying quality ${(quality * 100).toFixed(0)}%: ${actualSizeKB.toFixed(0)} KB (too large, trying lower quality...)`);
    }
    
    if (!manipulated) {
      throw new Error('Failed to compress image');
    }
    
    return {
      uri: manipulated.uri,
      width: manipulated.width,
      height: manipulated.height,
      size: actualSizeBytes,
    };
  } catch (error) {
    console.error('[compressImageForAI] ❌ Compression failed:', error);
    throw error;
  }
}








