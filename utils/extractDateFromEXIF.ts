import * as ImagePicker from 'expo-image-picker';

/**
 * Extracts date taken from EXIF metadata
 * Returns Date object if available, null otherwise
 * Matches web app implementation (DateTimeOriginal, CreateDate, ModifyDate)
 */
export function extractDateFromEXIF(
  asset: ImagePicker.ImagePickerAsset
): Date | null {
  try {
    const exif = asset.exif;
    
    if (!exif) {
      return null;
    }
    
    // Try DateTimeOriginal first (most accurate - when photo was actually taken)
    // Then CreateDate (when file was created)
    // Then ModifyDate (when file was last modified)
    const dateString = 
      (exif as any).DateTimeOriginal || 
      (exif as any).CreateDate || 
      (exif as any).ModifyDate ||
      (exif as any).DateTime ||
      (exif as any).DateTimeDigitized;
    
    if (!dateString) {
      return null;
    }
    
    // Handle different EXIF date formats
    if (typeof dateString === 'string') {
      // EXIF dates are typically in format: "YYYY:MM:DD HH:MM:SS"
      // Convert to ISO format: "YYYY-MM-DDTHH:MM:SS"
      const isoString = dateString.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const parsed = new Date(isoString);
      if (!isNaN(parsed.getTime())) {
        console.log(`[extractDateFromEXIF] ✅ Extracted date from EXIF: ${parsed.toISOString()}`);
        return parsed;
      } else {
        console.warn(`[extractDateFromEXIF] ⚠️  Failed to parse date string: ${dateString}`);
      }
    } else if (dateString instanceof Date) {
      console.log(`[extractDateFromEXIF] ✅ Extracted date from EXIF: ${dateString.toISOString()}`);
      return dateString;
    }
    
    return null;
  } catch (error) {
    console.error('[extractDateFromEXIF] Error extracting date:', error);
    return null;
  }
}

