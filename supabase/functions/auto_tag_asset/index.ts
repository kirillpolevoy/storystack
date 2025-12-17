import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.2';

type AutoTagRequest = {
  assetId: string;
  imageUrl: string;
};

type AutoTagBatchRequest = {
  assets: AutoTagRequest[];
};

type TagResult = {
  assetId: string;
  tags: string[];
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_BATCH_API_URL = 'https://api.openai.com/v1/batches';
const OPENAI_FILES_API_URL = 'https://api.openai.com/v1/files';
const AI_TARGET_LONG_EDGE = 1024;
const BATCH_API_THRESHOLD = 20; // Use Batch API for 20+ images

// Default tag vocabulary (fallback if config not found)
const DEFAULT_TAG_VOCABULARY = [
  'Product',
  'Lifestyle',
  'Studio',
  'Bright',
  'Moody',
  'Onyx',
  'Layered Look',
  'Semi-Precious Stone',
  'Choker Statement',
  'Everyday Luxe',
  'Necklace Stack',
  // Legacy tags for backward compatibility
  'Necklace',
  'Earrings',
  'Rings',
  'Bracelets',
];

// Get tag vocabulary from Supabase config - ONLY use enabled tags, never fallback to defaults
// Now user-specific: gets tags for the user who owns the asset
async function getTagVocabulary(supabaseClient: any, userId: string): Promise<string[]> {
  try {
    console.log('[auto_tag_asset] 🔍 Fetching tag_config from database for user:', userId);
    console.log('[auto_tag_asset] 🔍 Query: SELECT auto_tags FROM tag_config WHERE user_id =', userId);
    
    const { data: config, error } = await supabaseClient
      .from('tag_config')
      .select('auto_tags, user_id')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('[auto_tag_asset] ❌ Failed to load tag config:', error);
      console.error('[auto_tag_asset] ❌ Error code:', error.code);
      console.error('[auto_tag_asset] ❌ Error message:', error.message);
      console.error('[auto_tag_asset] ❌ Error details:', JSON.stringify(error, null, 2));
      
      // If config doesn't exist (PGRST116), try to see if there are any tag_configs for this user
      if (error.code === 'PGRST116') {
        console.log('[auto_tag_asset] 🔍 No tag_config found for user. Checking if any tag_configs exist...');
        const { data: allConfigs, error: listError } = await supabaseClient
          .from('tag_config')
          .select('user_id, auto_tags')
          .limit(5);
        
        if (!listError && allConfigs) {
          console.log('[auto_tag_asset] 🔍 Found tag_configs for other users:', allConfigs.map((c: any) => ({
            user_id: c.user_id,
            auto_tags_count: Array.isArray(c.auto_tags) ? c.auto_tags.length : 'not array',
            auto_tags: c.auto_tags
          })));
        }
      }
      
      // If config doesn't exist, return empty array (no auto-tagging)
      return [];
    }
    
    console.log('[auto_tag_asset] 📦 Config retrieved:', JSON.stringify(config, null, 2));
    console.log('[auto_tag_asset] 📦 Config type:', typeof config);
    console.log('[auto_tag_asset] 📦 Config.auto_tags type:', typeof config?.auto_tags);
    console.log('[auto_tag_asset] 📦 Config.auto_tags is array?', Array.isArray(config?.auto_tags));
    console.log('[auto_tag_asset] 📦 Config.auto_tags value:', config?.auto_tags);
    
    if (config?.auto_tags && Array.isArray(config.auto_tags)) {
      // Only return enabled tags, even if empty (user disabled all tags)
      console.log('[auto_tag_asset] ✅ Loaded auto_tags from config:', config.auto_tags);
      console.log('[auto_tag_asset] ✅ Number of enabled tags:', config.auto_tags.length);
      console.log('[auto_tag_asset] ✅ Tag names:', config.auto_tags);
      
      if (config.auto_tags.length === 0) {
        console.log('[auto_tag_asset] ⚠️  No tags enabled - auto-tagging will be skipped');
      }
      return config.auto_tags;
    }
    
    // Config exists but auto_tags is null/undefined/empty - user has disabled all tags
    console.log('[auto_tag_asset] ⚠️  No auto_tags configured (null/undefined/empty) - auto-tagging disabled');
    console.log('[auto_tag_asset] ⚠️  Config object:', JSON.stringify(config, null, 2));
    return [];
  } catch (error) {
    console.error('[auto_tag_asset] ❌ Exception loading tag config:', error);
    console.error('[auto_tag_asset] ❌ Exception details:', error instanceof Error ? error.stack : String(error));
    // Return empty array instead of defaults - don't auto-tag if config can't be loaded
    return [];
  }
}

// Extract storage path from Supabase Storage URL
function extractStoragePath(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    // Supabase Storage URLs typically have format: /storage/v1/object/public/{bucket}/{path}
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    return null;
  } catch (error) {
    console.error('[auto_tag_asset] Failed to extract storage path:', error);
    return null;
  }
}

// Get A2 storage path from A1 storage path
function getA2StoragePath(a1Path: string): string {
  // A1: users/{userId}/campaigns/{campaignId}/{filename}
  // A2: users/{userId}/campaigns/{campaignId}/ai/{filename}
  const parts = a1Path.split('/');
  if (parts.length >= 4) {
    // Insert 'ai' before filename
    const filename = parts.pop();
    parts.push('ai', filename!);
    return parts.join('/');
  }
  // Fallback: add 'ai' prefix
  return `ai/${a1Path}`;
}

// Resize image to 1024px long edge using WASM image processing
async function resizeImageForAI(
  imageUrl: string,
  supabaseClient: any,
  quality: number = 70
): Promise<Uint8Array> {
  console.log('[auto_tag_asset] Resizing image for AI tagging (1024px long edge)');
  
  // Fetch the original image
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const imageBuffer = await response.arrayBuffer();
  const originalSizeMB = imageBuffer.byteLength / (1024 * 1024);
  const originalSizeKB = imageBuffer.byteLength / 1024;
  console.log(`[auto_tag_asset] Original image size: ${originalSizeKB.toFixed(0)} KB (${originalSizeMB.toFixed(2)} MB)`);
  
  // Always resize to ensure consistent 1024px long edge and optimal compression
  // Even if image is small, resizing ensures it's exactly 1024px and properly compressed
  // This guarantees consistent file sizes and better performance
  if (originalSizeKB < 200) {
    console.log(`[auto_tag_asset] ⚠️  Image already very small (${originalSizeKB.toFixed(0)} KB), but will still resize to ensure 1024px long edge`);
  }
  
  // Use Supabase Storage transforms - most reliable method for Edge Functions
  // This uses Supabase's built-in image transformation API
  try {
    console.log('[auto_tag_asset] Using Supabase Storage transforms for resizing...');
    
    // Get image dimensions first to calculate proper resize
    let originalWidth: number | null = null;
    let originalHeight: number | null = null;
    
    try {
      if (typeof createImageBitmap !== 'undefined') {
        const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
        const imageBitmap = await createImageBitmap(imageBlob);
        originalWidth = imageBitmap.width;
        originalHeight = imageBitmap.height;
        const longEdge = Math.max(originalWidth, originalHeight);
        
        console.log(`[auto_tag_asset] Original dimensions: ${originalWidth}x${originalHeight}, long edge: ${longEdge}px`);
        
        // If image is already ≤1024px on long edge, no resize needed
        if (longEdge <= AI_TARGET_LONG_EDGE) {
          console.log(`[auto_tag_asset] ✅ Image already ≤${AI_TARGET_LONG_EDGE}px, no resize needed`);
          imageBitmap.close();
          return new Uint8Array(imageBuffer);
        }
        
        imageBitmap.close();
      }
    } catch (dimError) {
      console.log('[auto_tag_asset] Could not get image dimensions, will use 1024px transform');
    }
    
    // Use Supabase Storage transform API
    // Format: ?width=1024&height=1024&resize=contain&quality=75
    const baseUrl = new URL(imageUrl);
    const transformUrl = new URL(baseUrl.toString());
    
    // Set transform parameters
    // Use lower quality to ensure images stay well under OpenAI's strict URL limits (<2MB)
    // OpenAI rejects URL-based images that exceed ~2-3MB, so we need aggressive compression
    // We'll convert to base64 if still too large (base64 has 20MB limit)
    transformUrl.searchParams.set('width', '1024');
    transformUrl.searchParams.set('height', '1024');
    transformUrl.searchParams.set('resize', 'contain'); // Maintain aspect ratio
    transformUrl.searchParams.set('quality', quality.toString()); // Adjustable quality to ensure <1.5MB for OpenAI URL limits
    
    const transformedUrl = transformUrl.toString();
    console.log('[auto_tag_asset] Fetching transformed image from:', transformedUrl.substring(0, 150));
    
    const transformResponse = await fetch(transformedUrl, { 
      signal: AbortSignal.timeout(15000),
      headers: { 'Accept': 'image/jpeg,image/*' }
    });
    
    if (!transformResponse.ok) {
      throw new Error(`Storage transform failed: ${transformResponse.status} ${transformResponse.statusText}`);
    }
    
    const contentType = transformResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('image')) {
      throw new Error(`Invalid content type from transform: ${contentType}`);
    }
    
    const arrayBuffer = await transformResponse.arrayBuffer();
    const resizedArray = new Uint8Array(arrayBuffer);
    const resizedSizeKB = resizedArray.length / 1024;
    const resizedSizeMB = resizedSizeKB / 1024;
    const compressionRatio = ((1 - resizedArray.length / imageBuffer.byteLength) * 100).toFixed(1);
    
    console.log(`[auto_tag_asset] ✅ Successfully resized using Supabase Storage transform:`);
    console.log(`[auto_tag_asset]    Size: ${resizedSizeKB.toFixed(0)} KB (${resizedSizeMB.toFixed(2)} MB)`);
    console.log(`[auto_tag_asset]    Compression: ${compressionRatio}% reduction`);
    console.log(`[auto_tag_asset]    Target range: 200-500 KB - ${resizedSizeKB >= 200 && resizedSizeKB <= 500 ? '✅ IN RANGE' : '⚠️ OUT OF RANGE'}`);
    
    return resizedArray;
  } catch (transformError) {
    console.error('[auto_tag_asset] Supabase Storage transform failed:', transformError);
    
    // Final fallback: use original A1 image (acceptable since it's <5MB and OpenAI accepts up to 20MB)
    console.warn(`[auto_tag_asset] ⚠️  Using A1 image as A2 (${originalSizeMB.toFixed(2)} MB) - all resize methods failed`);
    return new Uint8Array(imageBuffer);
  }
}

// Get or create A2 version of image for AI tagging
async function getOrCreateA2Version(
  imageUrl: string,
  storagePath: string,
  supabaseClient: any,
  forceRecreate: boolean = false
): Promise<string> {
  // Safety check: if storagePath is already A2, return the imageUrl directly
  if (storagePath.includes('/ai/')) {
    console.log('[auto_tag_asset] ⚠️  Storage path is already A2, returning imageUrl directly');
    return imageUrl;
  }
  
  const a2Path = getA2StoragePath(storagePath);
  console.log('[auto_tag_asset] 🔍 Checking for A2 version');
  console.log('[auto_tag_asset] A1 path:', storagePath);
  console.log('[auto_tag_asset] A2 path:', a2Path);
  
  let needsRecreate = false;
  
  // Check if A2 version exists by trying to get public URL and verify it's accessible
  try {
    const { data } = supabaseClient.storage.from('assets').getPublicUrl(a2Path);
    const a2PublicUrl = data.publicUrl;
    console.log('[auto_tag_asset] A2 public URL:', a2PublicUrl);
    
    // Try to fetch the file to verify it exists
    const headResponse = await fetch(a2PublicUrl, { 
      method: 'HEAD', 
      signal: AbortSignal.timeout(5000) 
    });
    
    if (headResponse.ok) {
      const contentLength = headResponse.headers.get('content-length');
      const fileSizeKB = contentLength ? parseInt(contentLength) / 1024 : null;
      const fileSizeMB = fileSizeKB ? fileSizeKB / 1024 : null;
      const sizeDisplay = fileSizeKB 
        ? `${fileSizeKB.toFixed(0)} KB (${fileSizeMB!.toFixed(2)} MB)`
        : 'unknown size';
      const inRange = fileSizeKB ? (fileSizeKB >= 200 && fileSizeKB <= 500) : false;
      const OPENAI_MAX_URL_SIZE_MB = 1.5; // OpenAI rejects URL-based images >2MB
      
      // If A2 exists but is too large for OpenAI, recreate it with better compression
      if (fileSizeMB && fileSizeMB > OPENAI_MAX_URL_SIZE_MB) {
        console.warn(`[auto_tag_asset] ⚠️  A2 version EXISTS but is too large (${fileSizeMB.toFixed(2)} MB > ${OPENAI_MAX_URL_SIZE_MB} MB)`);
        console.warn(`[auto_tag_asset] ⚠️  Will recreate A2 with better compression (lower quality)...`);
        // Delete the existing A2 so we can recreate it with better compression
        try {
          await supabaseClient.storage.from('assets').remove([a2Path]);
          console.log(`[auto_tag_asset] ✅ Deleted oversized A2 version, will recreate with better compression`);
        } catch (deleteError) {
          console.warn(`[auto_tag_asset] ⚠️  Failed to delete oversized A2, will overwrite:`, deleteError);
        }
        needsRecreate = true;
        // Fall through to recreate A2 with better compression
      } else {
        console.log(`[auto_tag_asset] ✅ A2 version EXISTS (${sizeDisplay})${inRange ? ' ✅ IN TARGET RANGE' : fileSizeKB ? ' ⚠️ OUT OF TARGET RANGE' : ''}, using:`, a2PublicUrl);
        return a2PublicUrl;
      }
    } else {
      console.log(`[auto_tag_asset] A2 version HEAD request returned status ${headResponse.status}, will create`);
    }
  } catch (error) {
    // File doesn't exist or error checking - will create it
    console.log('[auto_tag_asset] A2 version not found (will create). Error:', error instanceof Error ? error.message : String(error));
  }
  
  // A2 doesn't exist, create it (or recreate if forceRecreate is true or if we deleted an oversized one)
  const isRecreating = needsRecreate || forceRecreate;
  console.log(`[auto_tag_asset] 🚀 A2 version ${isRecreating ? 'recreating with better compression' : 'not found, creating'}...`);
  console.log('[auto_tag_asset] Fetching A1 image from:', imageUrl);
  
  try {
    // Resize image to 1024px long edge
    // Use lower quality (50%) if recreating due to size issues, otherwise 70%
    const quality = isRecreating ? 50 : 70;
    console.log(`[auto_tag_asset] Starting A2 resize process with quality=${quality}%...`);
    const resizedImage = await resizeImageForAI(imageUrl, supabaseClient, quality);
    const resizedSizeKB = resizedImage.length / 1024;
    const resizedSizeMB = resizedSizeKB / 1024;
    const inRange = resizedSizeKB >= 200 && resizedSizeKB <= 500;
    console.log(`[auto_tag_asset] ✅ Resized image ready:`);
    console.log(`[auto_tag_asset]    Size: ${resizedSizeKB.toFixed(0)} KB (${resizedSizeMB.toFixed(2)} MB)`);
    console.log(`[auto_tag_asset]    Target range: 200-500 KB - ${inRange ? '✅ IN RANGE' : '⚠️ OUT OF RANGE'}`);
    console.log(`[auto_tag_asset]    Uploading to:`, a2Path);
    
    // Upload A2 version
    const { error: uploadError } = await supabaseClient
      .storage
      .from('assets')
      .upload(a2Path, resizedImage, {
        contentType: 'image/jpeg',
        upsert: true, // Allow overwrite if exists
      });
    
    if (uploadError) {
      console.error('[auto_tag_asset] ❌ Failed to upload A2 version:', uploadError);
      console.error('[auto_tag_asset] Upload error details:', JSON.stringify(uploadError, null, 2));
      // Fallback to A1 if A2 upload fails
      console.warn('[auto_tag_asset] ⚠️  Falling back to A1 version due to upload failure');
      return imageUrl;
    }
    
    // Get public URL for A2
    const { data } = supabaseClient.storage.from('assets').getPublicUrl(a2Path);
    const a2PublicUrl = data.publicUrl;
    console.log('[auto_tag_asset] ✅✅✅ A2 version CREATED and uploaded successfully!');
    console.log('[auto_tag_asset] A2 public URL:', a2PublicUrl);
    
    // Verify the uploaded file
    try {
      const verifyResponse = await fetch(a2PublicUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      const verifySize = verifyResponse.headers.get('content-length');
      const verifySizeKB = verifySize ? parseInt(verifySize) / 1024 : null;
      const verifySizeMB = verifySizeKB ? verifySizeKB / 1024 : null;
      const verifyInRange = verifySizeKB ? (verifySizeKB >= 200 && verifySizeKB <= 500) : false;
      const verifyDisplay = verifySizeKB 
        ? `${verifySizeKB.toFixed(0)} KB (${verifySizeMB!.toFixed(2)} MB)`
        : 'unknown size';
      console.log(`[auto_tag_asset] ✅ Verified A2 upload: ${verifyDisplay}${verifyInRange ? ' ✅ IN TARGET RANGE' : verifySizeKB ? ' ⚠️ OUT OF TARGET RANGE' : ''}`);
    } catch (verifyError) {
      console.warn('[auto_tag_asset] Could not verify A2 upload:', verifyError);
    }
    
    return a2PublicUrl;
  } catch (error) {
    console.error('[auto_tag_asset] ❌ Error creating A2 version:', error);
    console.error('[auto_tag_asset] Error details:', error instanceof Error ? error.stack : String(error));
    // Fallback to A1 if A2 creation fails
    console.warn('[auto_tag_asset] ⚠️  Falling back to A1 version due to creation error');
    return imageUrl;
  }
}

// Helper function to convert image to base64
// If image is still too large, compress it further before converting
async function convertToBase64(imageUrl: string): Promise<string> {
  console.log('[auto_tag_asset] Converting image to base64:', imageUrl.substring(0, 100));
  
  // Try to compress the image further if it's a Supabase Storage URL
  let finalImageUrl = imageUrl;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  
  // If it's a Supabase Storage URL, try to get a more compressed version
  if (supabaseUrl && imageUrl.includes(supabaseUrl) && imageUrl.includes('/storage/')) {
    try {
      const baseUrl = new URL(imageUrl);
      const transformUrl = new URL(baseUrl.toString());
      
      // Remove existing transform params
      transformUrl.searchParams.delete('width');
      transformUrl.searchParams.delete('height');
      transformUrl.searchParams.delete('resize');
      transformUrl.searchParams.delete('quality');
      
      // Apply compression for base64 conversion (match compressImageForAI approach)
      transformUrl.searchParams.set('width', '1024');
      transformUrl.searchParams.set('height', '1024');
      transformUrl.searchParams.set('resize', 'contain');
      transformUrl.searchParams.set('quality', '75'); // Slightly lower quality for base64 if needed, but still reasonable
      
      const compressedUrl = transformUrl.toString();
      console.log('[auto_tag_asset] Attempting to fetch compressed version for base64 conversion...');
      
      const compressedResponse = await fetch(compressedUrl, { 
        signal: AbortSignal.timeout(10000),
        headers: { 'Accept': 'image/jpeg,image/*' }
      });
      
      if (compressedResponse.ok) {
        finalImageUrl = compressedUrl;
        console.log('[auto_tag_asset] ✅ Using compressed version for base64 conversion');
      }
    } catch (compressError) {
      console.warn('[auto_tag_asset] Could not compress image for base64, using original:', compressError);
    }
  }
  
  const imageResponse = await fetch(finalImageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }
  
  // Detect actual image MIME type from response headers or file signature
  let mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
  
  // Validate MIME type - OpenAI supports: image/jpeg, image/png, image/gif, image/webp
  const supportedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!supportedMimeTypes.some(type => mimeType.toLowerCase().includes(type.replace('image/', '')))) {
    console.warn(`[auto_tag_asset] ⚠️  Unsupported MIME type from headers: ${mimeType}, defaulting to image/jpeg`);
    mimeType = 'image/jpeg';
  } else {
    // Normalize MIME type
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      mimeType = 'image/jpeg';
    } else if (mimeType.includes('png')) {
      mimeType = 'image/png';
    } else if (mimeType.includes('gif')) {
      mimeType = 'image/gif';
    } else if (mimeType.includes('webp')) {
      mimeType = 'image/webp';
    }
  }
  
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBytes = new Uint8Array(imageBuffer);
  
  // Verify image format by checking file signature (magic bytes)
  // This is more reliable than trusting Content-Type header
  let detectedMimeType = mimeType;
  if (imageBytes.length >= 4) {
    // Check magic bytes
    const signature = Array.from(imageBytes.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    
    // JPEG: FF D8 FF
    if (imageBytes[0] === 0xFF && imageBytes[1] === 0xD8 && imageBytes[2] === 0xFF) {
      detectedMimeType = 'image/jpeg';
    }
    // PNG: 89 50 4E 47
    else if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4E && imageBytes[3] === 0x47) {
      detectedMimeType = 'image/png';
    }
    // GIF: 47 49 46 38
    else if (imageBytes[0] === 0x47 && imageBytes[1] === 0x49 && imageBytes[2] === 0x46 && imageBytes[3] === 0x38) {
      detectedMimeType = 'image/gif';
    }
    // WebP: Check for RIFF...WEBP (more complex, check first 12 bytes)
    else if (imageBytes.length >= 12 && 
             imageBytes[0] === 0x52 && imageBytes[1] === 0x49 && imageBytes[2] === 0x46 && imageBytes[3] === 0x46 &&
             imageBytes[8] === 0x57 && imageBytes[9] === 0x45 && imageBytes[10] === 0x42 && imageBytes[11] === 0x50) {
      detectedMimeType = 'image/webp';
    } else {
      console.warn(`[auto_tag_asset] ⚠️  Unknown image format signature: ${signature}, using detected MIME type: ${detectedMimeType}`);
    }
  }
  
  // Use detected MIME type (from file signature) if different from header
  if (detectedMimeType !== mimeType) {
    console.log(`[auto_tag_asset] 🔍 MIME type mismatch - Header: ${mimeType}, Detected: ${detectedMimeType}, using detected`);
    mimeType = detectedMimeType;
  }
  
  const originalSizeMB = imageBuffer.byteLength / (1024 * 1024);
  console.log('[auto_tag_asset] Image size before base64 conversion:', originalSizeMB.toFixed(2), 'MB');
  console.log('[auto_tag_asset] Detected image format:', mimeType);
  
  // Convert to base64 efficiently
  // For binary data (images), we need to convert bytes to base64 safely
  // Use chunk-based conversion to avoid Latin1 encoding issues with binary data
  const chunkSize = 8192; // Process 8KB at a time
  let base64 = '';
  
  for (let i = 0; i < imageBytes.length; i += chunkSize) {
    const chunk = imageBytes.slice(i, i + chunkSize);
    // Convert chunk to string using Latin1 (which maps 1:1 with bytes 0-255)
    // Build string safely to avoid encoding issues
    let chunkString = '';
    for (let j = 0; j < chunk.length; j++) {
      // Ensure byte value is in valid Latin1 range (0-255)
      const byte = chunk[j];
      chunkString += String.fromCharCode(byte);
    }
    base64 += btoa(chunkString);
  }
  
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const base64SizeMB = dataUrl.length / (1024 * 1024);
  console.log('[auto_tag_asset] ✅ Converted to base64 data URL (size:', base64SizeMB.toFixed(2), 'MB)');
  
  if (base64SizeMB > 20) {
    console.error('[auto_tag_asset] ❌ Base64 image exceeds 20MB limit:', base64SizeMB.toFixed(2), 'MB');
    console.error('[auto_tag_asset] Original image size was:', originalSizeMB.toFixed(2), 'MB');
    throw new Error(`Image too large even after maximum compression: ${base64SizeMB.toFixed(2)}MB exceeds 20MB limit`);
  }
  
  return dataUrl;
}

// Check if image format is supported by OpenAI and convert if needed
// Uses A2 version (1024px long edge) for AI tagging when available
async function ensureSupportedImageFormat(
  imageUrl: string,
  supabaseClient?: any
): Promise<string> {
  try {
    console.log('[auto_tag_asset] Checking image format for URL:', imageUrl);
    
    // Extract file extension from URL
    const urlPath = new URL(imageUrl).pathname;
    const extension = urlPath.split('.').pop()?.toLowerCase() || '';
    console.log('[auto_tag_asset] File extension from URL:', extension);
    
    // For Supabase Storage URLs, try to get or create A2 version
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (supabaseUrl && imageUrl.includes(supabaseUrl) && supabaseClient) {
      // Remove any existing transform params to get base URL
      const baseUrl = new URL(imageUrl);
      baseUrl.search = '';
      const originalUrl = baseUrl.toString();
      
      // Extract storage path
      const storagePath = extractStoragePath(originalUrl);
      if (storagePath) {
        console.log('[auto_tag_asset] Extracted storage path:', storagePath);
        
        // Check if this is already an A2 path (new imports store directly as A2)
        const isA2Path = storagePath.includes('/ai/');
        
        if (isA2Path) {
          // Already A2 - use directly (new import flow)
          console.log('[auto_tag_asset] ✅ Image is already A2 (stored directly in ai/ folder)');
          const a2Url = originalUrl;
          
          // Verify A2 image is accessible and check its size
          try {
            const headResponse = await fetch(a2Url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            
            // Check if A2 file actually exists
            if (!headResponse.ok) {
              console.error(`[auto_tag_asset] ❌ A2 file does not exist (status ${headResponse.status}) for path: ${storagePath}`);
              console.error(`[auto_tag_asset] ❌ A2 URL: ${a2Url}`);
              throw new Error(`A2 file not found: Storage path indicates A2 but file does not exist (status ${headResponse.status})`);
            }
            
            const contentType = headResponse.headers.get('content-type');
            const contentLength = headResponse.headers.get('content-length');
            const fileSizeKB = contentLength ? parseInt(contentLength) / 1024 : null;
            const fileSizeMB = fileSizeKB ? fileSizeKB / 1024 : null;
            const inRange = fileSizeKB ? (fileSizeKB >= 200 && fileSizeKB <= 500) : false;
            const sizeDisplay = fileSizeKB 
              ? `${fileSizeKB.toFixed(0)} KB (${fileSizeMB!.toFixed(2)} MB)`
              : 'unknown';
            
            console.log(`[auto_tag_asset] A2 image check - Content-Type: ${contentType}, Size: ${sizeDisplay}${inRange ? ' ✅ IN TARGET RANGE' : fileSizeKB ? ' ⚠️ OUT OF TARGET RANGE' : ''}`);
            
            // OpenAI has VERY strict limits on URL-based image sizes
            const OPENAI_MAX_URL_SIZE_MB = 1.5; // Very conservative limit for URL-based images (OpenAI rejects >2MB)
            const OPENAI_MAX_BASE64_SIZE_MB = 20; // Base64 limit
            
            console.log(`[auto_tag_asset] 📏 Size check: ${fileSizeMB ? fileSizeMB.toFixed(2) : 'unknown'} MB vs limit ${OPENAI_MAX_URL_SIZE_MB} MB`);
            
            // Always convert to base64 if image is too large for URL
            if (fileSizeMB && fileSizeMB > OPENAI_MAX_URL_SIZE_MB) {
              console.warn(`[auto_tag_asset] ⚠️  A2 image size (${fileSizeMB.toFixed(2)} MB) exceeds OpenAI URL limit (${OPENAI_MAX_URL_SIZE_MB} MB), converting to base64`);
              if (fileSizeMB > OPENAI_MAX_BASE64_SIZE_MB) {
                console.error(`[auto_tag_asset] ❌ A2 image size (${fileSizeMB.toFixed(2)} MB) exceeds OpenAI base64 limit (${OPENAI_MAX_BASE64_SIZE_MB} MB) - cannot process`);
                throw new Error(`Image too large for OpenAI: ${fileSizeMB.toFixed(2)}MB exceeds ${OPENAI_MAX_BASE64_SIZE_MB}MB limit`);
              }
              console.log('[auto_tag_asset] 🔄 Converting oversized A2 image to base64 to avoid OpenAI URL size limit...');
              const base64Result = await convertToBase64(a2Url);
              console.log('[auto_tag_asset] ✅ Converted to base64 successfully');
              return base64Result;
            }
            
            // Use A2 if it's JPEG format and within size limits
            if (contentType && (contentType.includes('jpeg') || contentType.includes('jpg'))) {
              console.log('[auto_tag_asset] ✅✅✅ USING A2 VERSION FOR OPENAI TAGGING ✅✅✅');
              console.log('[auto_tag_asset] A2 URL being sent to OpenAI:', a2Url);
              console.log('[auto_tag_asset] A2 size:', sizeDisplay);
              if (fileSizeKB) {
                console.log(`[auto_tag_asset] A2 compression check: ${fileSizeKB >= 200 && fileSizeKB <= 500 ? '✅ IN TARGET RANGE (200-500 KB)' : `⚠️ OUT OF TARGET RANGE (${fileSizeKB.toFixed(0)} KB)`}`);
                // Extra safety check: if over 1.5MB, convert to base64 even if we're here
                if (fileSizeMB && fileSizeMB > OPENAI_MAX_URL_SIZE_MB) {
                  console.warn(`[auto_tag_asset] ⚠️  A2 image is ${fileSizeMB.toFixed(2)} MB, converting to base64 for safety`);
                  return await convertToBase64(a2Url);
                }
              }
              return a2Url;
            } else {
              console.warn('[auto_tag_asset] A2 Content-Type is not JPEG, converting to base64');
              return await convertToBase64(a2Url);
            }
          } catch (headError) {
            // If HEAD fails, try to fetch the actual file to see if it exists
            console.error(`[auto_tag_asset] ❌ HEAD request failed for A2:`, headError);
            try {
              const fetchResponse = await fetch(a2Url, { method: 'GET', signal: AbortSignal.timeout(5000) });
              if (!fetchResponse.ok) {
                throw new Error(`A2 file does not exist: ${fetchResponse.status} ${fetchResponse.statusText}`);
              }
              // File exists but HEAD failed, try base64 conversion
              console.warn('[auto_tag_asset] HEAD failed but file exists, converting to base64:', headError);
              return await convertToBase64(a2Url);
            } catch (fetchError) {
              console.error(`[auto_tag_asset] ❌ A2 file does not exist or is inaccessible:`, fetchError);
              throw new Error(`A2 file not found or inaccessible: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
            }
          }
        } else {
          // A1 path (web uploads store here) - get or create A2 version as fallback
          console.log('[auto_tag_asset] ⚠️  A1 path detected (web upload or legacy asset) - will create A2 as fallback');
          console.log('[auto_tag_asset] ⚠️  Web uploads store full-size images in A1, so we MUST compress or convert to base64');
          
          try {
            const a2StartTime = Date.now();
            console.log('[auto_tag_asset] 🎯 Attempting to get or create A2 version from A1...');
            const a2Url = await getOrCreateA2Version(originalUrl, storagePath, supabaseClient);
            const a2Time = Date.now() - a2StartTime;
            
            // Check if we got A2 or fell back to A1
            if (a2Url === originalUrl) {
              console.error('[auto_tag_asset] ❌ getOrCreateA2Version returned A1 URL (fallback), A2 creation failed');
              console.error('[auto_tag_asset] ❌ Web uploads store uncompressed images - MUST convert to base64 to avoid OpenAI 400 errors');
              
              // For web uploads (A1 path), ALWAYS convert to base64 to avoid size issues
              // Web uploads don't compress images, so they're often too large for URL-based requests
              console.log('[auto_tag_asset] 🔄 A2 creation failed - converting A1 to base64 for safety (web uploads are uncompressed)');
              try {
                const base64Result = await convertToBase64(originalUrl);
                console.log('[auto_tag_asset] ✅ A1 converted to base64 successfully (web upload safety conversion)');
                return base64Result;
              } catch (base64Error) {
                console.error('[auto_tag_asset] ❌ Base64 conversion failed:', base64Error);
                throw new Error(`A2 creation failed and base64 conversion failed: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
              }
            } else {
              console.log(`[auto_tag_asset] ✅ Got A2 URL from getOrCreateA2Version (took ${a2Time}ms)`);
            }
            
            // Verify A2 image is accessible and check its size
            try {
              const headResponse = await fetch(a2Url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
              const contentType = headResponse.headers.get('content-type');
              const contentLength = headResponse.headers.get('content-length');
              const fileSizeKB = contentLength ? parseInt(contentLength) / 1024 : null;
              const fileSizeMB = fileSizeKB ? fileSizeKB / 1024 : null;
              const inRange = fileSizeKB ? (fileSizeKB >= 200 && fileSizeKB <= 500) : false;
              const sizeDisplay = fileSizeKB 
                ? `${fileSizeKB.toFixed(0)} KB (${fileSizeMB!.toFixed(2)} MB)`
                : 'unknown';
              
              console.log(`[auto_tag_asset] Final image check - Content-Type: ${contentType}, Size: ${sizeDisplay}${inRange ? ' ✅ IN TARGET RANGE' : fileSizeKB ? ' ⚠️ OUT OF TARGET RANGE' : ''}`);
              console.log(`[auto_tag_asset] Image URL: ${a2Url}`);
              console.log(`[auto_tag_asset] Is A2? ${a2Url !== originalUrl ? 'YES ✅' : 'NO ⚠️ (using A1)'}`);
              
              // OpenAI has VERY strict limits on URL-based image sizes
              // Based on errors, OpenAI rejects URL-based images that exceed ~2MB
              // Convert to base64 if image exceeds 1.5MB to be extra safe (base64 has 20MB limit)
              const OPENAI_MAX_URL_SIZE_MB = 1.5; // Very conservative limit for URL-based images (OpenAI rejects >2MB)
              const OPENAI_MAX_BASE64_SIZE_MB = 20; // Base64 limit
              
              console.log(`[auto_tag_asset] 📏 Size check: ${fileSizeMB ? fileSizeMB.toFixed(2) : 'unknown'} MB vs limit ${OPENAI_MAX_URL_SIZE_MB} MB`);
              
              // Always convert to base64 if image is too large for URL
              if (fileSizeMB && fileSizeMB > OPENAI_MAX_URL_SIZE_MB) {
                console.warn(`[auto_tag_asset] ⚠️  Image size (${fileSizeMB.toFixed(2)} MB) exceeds OpenAI URL limit (${OPENAI_MAX_URL_SIZE_MB} MB), converting to base64`);
                if (fileSizeMB > OPENAI_MAX_BASE64_SIZE_MB) {
                  console.error(`[auto_tag_asset] ❌ Image size (${fileSizeMB.toFixed(2)} MB) exceeds OpenAI base64 limit (${OPENAI_MAX_BASE64_SIZE_MB} MB) - cannot process`);
                  throw new Error(`Image too large for OpenAI: ${fileSizeMB.toFixed(2)}MB exceeds ${OPENAI_MAX_BASE64_SIZE_MB}MB limit`);
                }
                console.log('[auto_tag_asset] 🔄 Converting oversized image to base64 to avoid OpenAI URL size limit...');
                const base64Result = await convertToBase64(a2Url);
                console.log('[auto_tag_asset] ✅ Converted to base64 successfully');
                return base64Result;
              }
              
              // Use A2 if it's JPEG format and within size limits
              if (contentType && (contentType.includes('jpeg') || contentType.includes('jpg'))) {
                if (a2Url !== originalUrl) {
                  console.log('[auto_tag_asset] ✅✅✅ USING A2 VERSION FOR OPENAI TAGGING ✅✅✅');
                  console.log('[auto_tag_asset] A2 URL being sent to OpenAI:', a2Url);
                  console.log('[auto_tag_asset] A2 size:', sizeDisplay);
                  if (fileSizeKB) {
                    console.log(`[auto_tag_asset] A2 compression check: ${fileSizeKB >= 200 && fileSizeKB <= 500 ? '✅ IN TARGET RANGE (200-500 KB)' : `⚠️ OUT OF TARGET RANGE (${fileSizeKB.toFixed(0)} KB)`}`);
                    // Extra safety check: if over 1.5MB, convert to base64 even if we're here
                    if (fileSizeMB && fileSizeMB > OPENAI_MAX_URL_SIZE_MB) {
                      console.warn(`[auto_tag_asset] ⚠️  A2 image is ${fileSizeMB.toFixed(2)} MB, converting to base64 for safety`);
                      return await convertToBase64(a2Url);
                    }
                  }
                } else {
                  console.log('[auto_tag_asset] ⚠️  Using A1 version (A2 not available)');
                }
                return a2Url;
              } else {
                console.warn('[auto_tag_asset] Content-Type is not JPEG, converting to base64');
                return await convertToBase64(a2Url);
              }
            } catch (headError) {
              console.warn('[auto_tag_asset] HEAD request failed, converting to base64:', headError);
              return await convertToBase64(a2Url);
            }
          } catch (a2Error) {
            console.error('[auto_tag_asset] ❌ Failed to get/create A2 version, falling back to A1');
            console.error('[auto_tag_asset] Error:', a2Error instanceof Error ? a2Error.message : String(a2Error));
            console.error('[auto_tag_asset] Stack:', a2Error instanceof Error ? a2Error.stack : 'N/A');
            // Fall through to use A1
          }
          
          // Fallback: Use A1 version (original compressed image) - only for legacy A1 paths
          console.log('[auto_tag_asset] Using A1 version (fallback)');
      
      try {
        const headResponse = await fetch(originalUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        const contentType = headResponse.headers.get('content-type');
        const contentLength = headResponse.headers.get('content-length');
        const fileSizeMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : null;
        
        console.log(`[auto_tag_asset] A1 image - Content-Type: ${contentType}, Size: ${fileSizeMB ? fileSizeMB.toFixed(2) + ' MB' : 'unknown'}`);
        
        // OpenAI has strict limits - convert to base64 if too large
        // Use very conservative limit (1.5MB) for URL-based images to avoid OpenAI rejections
        const OPENAI_MAX_URL_SIZE_MB = 1.5; // Very conservative limit for URL-based images (OpenAI rejects >2MB)
        const OPENAI_MAX_BASE64_SIZE_MB = 20; // Base64 limit
        
        console.log(`[auto_tag_asset] 📏 A1 size check: ${fileSizeMB ? fileSizeMB.toFixed(2) : 'unknown'} MB vs limit ${OPENAI_MAX_URL_SIZE_MB} MB`);
        
        if (fileSizeMB && fileSizeMB > OPENAI_MAX_URL_SIZE_MB) {
          console.warn(`[auto_tag_asset] ⚠️  A1 image size (${fileSizeMB.toFixed(2)} MB) exceeds OpenAI URL limit (${OPENAI_MAX_URL_SIZE_MB} MB), converting to base64`);
          if (fileSizeMB > OPENAI_MAX_BASE64_SIZE_MB) {
            console.error(`[auto_tag_asset] ❌ A1 image size (${fileSizeMB.toFixed(2)} MB) exceeds OpenAI base64 limit (${OPENAI_MAX_BASE64_SIZE_MB} MB) - cannot process`);
            throw new Error(`Image too large for OpenAI: ${fileSizeMB.toFixed(2)}MB exceeds ${OPENAI_MAX_BASE64_SIZE_MB}MB limit`);
          }
          console.log('[auto_tag_asset] 🔄 Converting oversized A1 image to base64 to avoid OpenAI URL size limit...');
          const base64Result = await convertToBase64(originalUrl);
          console.log('[auto_tag_asset] ✅ A1 converted to base64 successfully');
          return base64Result;
        }
        
        // If it's JPEG and under size limit, use it directly
        if (contentType && (contentType.includes('jpeg') || contentType.includes('jpg'))) {
          if (fileSizeMB === null || fileSizeMB <= OPENAI_MAX_URL_SIZE_MB) {
            console.log('[auto_tag_asset] ✅ Using A1 compressed image URL');
            return originalUrl;
          } else {
            console.warn(`[auto_tag_asset] ⚠️  A1 image is ${fileSizeMB.toFixed(2)} MB, converting to base64 to avoid OpenAI limit`);
            return await convertToBase64(originalUrl);
          }
        } else {
          // Not JPEG, convert to base64
          console.warn('[auto_tag_asset] A1 Content-Type is not JPEG, converting to base64');
          return await convertToBase64(originalUrl);
        }
      } catch (headError) {
        // HEAD request failed or timed out - convert to base64 to avoid OpenAI timeout
        console.warn('[auto_tag_asset] HEAD request failed/timed out, converting to base64 to avoid OpenAI timeout:', headError);
        return await convertToBase64(originalUrl);
      }
    }
    }
    }
    
    // If not Supabase Storage URL or no client, try to use as-is or convert to base64
    console.warn('[auto_tag_asset] Not a Supabase Storage URL or missing client, attempting direct use');
    try {
      const headResponse = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (headResponse.ok) {
        return imageUrl;
      }
    } catch (error) {
      console.warn('[auto_tag_asset] Direct fetch failed, attempting base64 conversion');
      console.warn('[auto_tag_asset] Fetch error:', error instanceof Error ? error.message : String(error));
    }
    
    // Final fallback: try to convert to base64
    try {
      console.log('[auto_tag_asset] 🔄 Attempting base64 conversion as final fallback...');
      return await convertToBase64(imageUrl);
    } catch (base64Error) {
      console.error('[auto_tag_asset] ❌ Base64 conversion also failed:', base64Error);
      console.error('[auto_tag_asset] Image URL:', imageUrl);
      console.error('[auto_tag_asset] Base64 error:', base64Error instanceof Error ? base64Error.message : String(base64Error));
      throw new Error(`Failed to prepare image: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
    }
    
  } catch (error) {
    console.error('[auto_tag_asset] ❌❌❌ CRITICAL: Error in ensureSupportedImageFormat ❌❌❌');
    console.error('[auto_tag_asset] Image URL:', imageUrl);
    console.error('[auto_tag_asset] Error:', error instanceof Error ? error.message : String(error));
    console.error('[auto_tag_asset] Error stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('[auto_tag_asset] Supabase client available:', !!supabaseClient);
    if (supabaseClient) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      console.error('[auto_tag_asset] SUPABASE_URL:', supabaseUrl);
      console.error('[auto_tag_asset] Image URL contains SUPABASE_URL:', supabaseUrl ? imageUrl.includes(supabaseUrl) : 'N/A');
    }
    throw error;
  }
}

// Batch processing: Get tags for multiple images in a single API call
async function getSuggestedTagsBatch(
  requests: AutoTagRequest[],
  apiKey?: string,
  tagVocabulary: string[] = [],
  supabaseClient?: any
): Promise<TagResult[]> {
  if (!apiKey) {
    console.warn('[auto_tag_asset] Missing OPENAI_API_KEY. Cannot generate tags.');
    throw new Error('OpenAI API key not configured');
  }
  
  // Validate that tagVocabulary is provided and not empty
  if (!tagVocabulary || tagVocabulary.length === 0) {
    console.error('[auto_tag_asset] ❌ No tags provided in vocabulary - cannot generate tags');
    throw new Error('No tags enabled for auto-tagging');
  }
  
  if (requests.length === 0) {
    return [];
  }
  
  console.log(`[auto_tag_asset] Processing batch of ${requests.length} images`);
  console.log('[auto_tag_asset] Tag vocabulary for GPT-4:', tagVocabulary);
  
  // Prepare all images (using A2 versions for AI tagging)
  // Use Promise.allSettled so individual failures don't kill the entire batch
  console.log(`[auto_tag_asset] 🔄 Preparing ${requests.length} images for OpenAI...`);
  const imagePromises = requests.map((req, idx) => {
    console.log(`[auto_tag_asset]   Preparing image ${idx + 1}/${requests.length}: ${req.assetId}`);
    return ensureSupportedImageFormat(req.imageUrl, supabaseClient)
      .then(url => ({ success: true, url, index: idx, assetId: req.assetId }))
      .catch((error) => {
        console.error(`[auto_tag_asset] ❌ Failed to prepare image ${idx + 1} (${req.assetId}):`, error);
        console.error(`[auto_tag_asset] Error message:`, error instanceof Error ? error.message : String(error));
        console.error(`[auto_tag_asset] Error stack:`, error instanceof Error ? error.stack : 'N/A');
        return { success: false, error, index: idx, assetId: req.assetId };
      });
  });
  
  const preparationResults = await Promise.allSettled(imagePromises);
  
  // Process results - separate successful and failed
  const successful: Array<{ url: string; index: number; assetId: string }> = [];
  const failed: Array<{ index: number; assetId: string; error: any }> = [];
  
  preparationResults.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      const prepResult = result.value;
      if (prepResult.success) {
        successful.push({ url: prepResult.url, index: prepResult.index, assetId: prepResult.assetId });
      } else {
        failed.push({ index: prepResult.index, assetId: prepResult.assetId, error: prepResult.error });
      }
    } else {
      // Promise.allSettled shouldn't have rejected promises, but handle it anyway
      failed.push({ index: idx, assetId: requests[idx].assetId, error: result.reason });
    }
  });
  
  console.log(`[auto_tag_asset] ✅ Prepared ${successful.length}/${requests.length} images successfully`);
  if (failed.length > 0) {
    console.warn(`[auto_tag_asset] ⚠️  ${failed.length} images failed to prepare:`, failed.map(f => f.assetId));
    failed.forEach(f => {
      console.warn(`[auto_tag_asset]   - Asset ${f.assetId} (index ${f.index}): ${f.error instanceof Error ? f.error.message : String(f.error)}`);
    });
  }
  
  // If ALL images failed, throw error with detailed information
  if (successful.length === 0) {
    console.error(`[auto_tag_asset] ❌❌❌ ALL IMAGES FAILED PREPARATION ❌❌❌`);
    console.error(`[auto_tag_asset] Total requests: ${requests.length}`);
    console.error(`[auto_tag_asset] Failed images:`, failed.map(f => ({
      assetId: f.assetId,
      index: f.index,
      error: f.error instanceof Error ? f.error.message : String(f.error),
    })));
    
    // Provide more detailed error message
    const errorMessages = failed.map(f => 
      `Asset ${f.assetId}: ${f.error instanceof Error ? f.error.message : String(f.error)}`
    ).join('; ');
    
    throw new Error(`All ${requests.length} images failed preparation. Errors: ${errorMessages}`);
  }
  
  // If some failed, we'll process only the successful ones and return empty tags for failed ones
  // Sort successful by original index to maintain order
  successful.sort((a, b) => a.index - b.index);
  const supportedImageUrls = successful.map(s => s.url);
  const successfulIndices = new Set(successful.map(s => s.index));
  
  console.log(`[auto_tag_asset] ✅✅✅ Processing ${successful.length} successful images (${failed.length} failed) ✅✅✅`);
  
  // Build content array with text prompt and all images
  // Only include successful images in the OpenAI request
  const content: any[] = [
    {
      type: 'text',
      text: `Analyze ${successful.length} photos objectively and return tags for each photo from this vocabulary: ${tagVocabulary.join(', ')}.

AVAILABLE TAGS (you MUST use only these tags): ${JSON.stringify(tagVocabulary)}.

CRITICAL: Only tag what you ACTUALLY see in each image. Do NOT default to "Product" unless the image clearly shows a product photo.

PHOTO TYPE ANALYSIS:
1. Look at each image carefully - what does it actually show?
2. Is there a person visible? → Use "Lifestyle" tag
3. Is it just jewelry on a plain background? → Use "Product" tag
4. What jewelry is visible? (Necklace, Earrings, Rings, Bracelets)
5. What style/aesthetic? (Bright, Moody, Studio, Onyx, etc.)

TAGGING GUIDELINES:
- Person wearing jewelry → ["Lifestyle", "Necklace", ...]
- Product shot on plain background → ["Product", "Necklace", ...]
- Studio/lifestyle scene → ["Lifestyle", "Necklace", "Studio", ...]
- Only use "Product" if it's clearly a product photo, not a lifestyle photo

DO NOT:
- Default to "Product" if unsure
- Assume it's a product photo
- Add tags you cannot see

Return tags for each image in order (image 1, image 2, etc.). Each image should have 1-5 tags that accurately reflect what is in that specific image.`,
    },
  ];
  
  // Add only successful images to the content array and capture their sizes
  const imageSizes: Array<{ index: number; sizeKB: number; sizeMB: number; isA2: boolean; type: string; assetId: string }> = [];
  
  for (let i = 0; i < supportedImageUrls.length; i++) {
    const imageUrl = supportedImageUrls[i];
    const originalIndex = successful[i].index;
    const assetId = successful[i].assetId;
    const isA2 = imageUrl.includes('/ai/');
    const isBase64 = imageUrl.startsWith('data:');
    
    // Get image size
    let sizeKB = 0;
    let sizeMB = 0;
    
    if (isBase64) {
      // Calculate size from base64: base64 is ~33% larger than binary
      const base64Data = imageUrl.split(',')[1] || '';
      const binarySize = (base64Data.length * 3) / 4;
      sizeKB = binarySize / 1024;
      sizeMB = sizeKB / 1024;
    } else {
      // Fetch image to get actual size
      try {
        const headResponse = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (headResponse.ok) {
          const contentLength = headResponse.headers.get('content-length');
          if (contentLength) {
            sizeKB = parseInt(contentLength) / 1024;
            sizeMB = sizeKB / 1024;
            console.log(`[auto_tag_asset] 📏 Image ${i + 1} size from HEAD: ${sizeKB.toFixed(0)} KB (${sizeMB.toFixed(2)} MB)`);
          } else {
            console.warn(`[auto_tag_asset] ⚠️  No content-length header for image ${i + 1}, size unknown`);
          }
        } else {
          console.warn(`[auto_tag_asset] ⚠️  HEAD request failed for image ${i + 1}: ${headResponse.status}`);
        }
      } catch (sizeError) {
        console.warn(`[auto_tag_asset] ⚠️  Could not get size for image ${i + 1}:`, sizeError);
        // If we can't get size, assume it might be large and convert to base64 to be safe
        console.warn(`[auto_tag_asset] ⚠️  Will convert to base64 as safety measure since size is unknown`);
        sizeMB = 999; // Force conversion to base64
      }
    }
    
    console.log(`[auto_tag_asset] 📤 Adding image ${i + 1} (original index ${originalIndex + 1}, asset ${assetId}) to OpenAI request:`);
    console.log(`[auto_tag_asset]    URL: ${imageUrl.substring(0, 100)}...`);
    console.log(`[auto_tag_asset]    Is A2? ${isA2 ? 'YES ✅' : 'NO ⚠️'}`);
    console.log(`[auto_tag_asset]    Type: ${isBase64 ? 'base64' : 'URL'}`);
    console.log(`[auto_tag_asset]    Size: ${sizeKB > 0 ? `${sizeKB.toFixed(0)} KB (${sizeMB.toFixed(2)} MB)` : 'unknown'}`);
    console.log(`[auto_tag_asset]    Target range: ${sizeKB > 0 ? (sizeKB >= 200 && sizeKB <= 500 ? '✅ IN RANGE' : '⚠️ OUT OF RANGE') : 'unknown'}`);
    
    // Final size check before adding to content - convert to base64 if still too large
    // This is a safety net in case ensureSupportedImageFormat didn't catch it
    const OPENAI_MAX_URL_SIZE_MB = 1.5;
    let finalImageUrl = imageUrl;
    let finalType = isBase64 ? 'base64' : 'URL';
    let finalIsA2 = isA2;
    
    if (!isBase64 && sizeMB && sizeMB > OPENAI_MAX_URL_SIZE_MB) {
      console.warn(`[auto_tag_asset] ⚠️⚠️⚠️ CRITICAL: Image ${i + 1} is ${sizeMB.toFixed(2)} MB, exceeds ${OPENAI_MAX_URL_SIZE_MB} MB limit!`);
      console.warn(`[auto_tag_asset] ⚠️  Converting to base64 as final safety check...`);
      try {
        finalImageUrl = await convertToBase64(imageUrl);
        finalType = 'base64';
        // Recalculate size for base64
        const base64Data = finalImageUrl.split(',')[1] || '';
        const binarySize = (base64Data.length * 3) / 4;
        sizeKB = binarySize / 1024;
        sizeMB = sizeKB / 1024;
        console.log(`[auto_tag_asset] ✅ Image ${i + 1} converted to base64, new size: ${sizeMB.toFixed(2)} MB`);
      } catch (base64Error) {
        console.error(`[auto_tag_asset] ❌❌❌ Failed to convert image ${i + 1} to base64 ❌❌❌`);
        console.error(`[auto_tag_asset] Error:`, base64Error);
        throw new Error(`Failed to convert oversized image ${i + 1} to base64: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
      }
    } else if (!isBase64 && (!sizeMB || sizeMB === 0)) {
      // If we couldn't get size, convert to base64 to be safe
      console.warn(`[auto_tag_asset] ⚠️  Image ${i + 1} size unknown, converting to base64 for safety...`);
      try {
        finalImageUrl = await convertToBase64(imageUrl);
        finalType = 'base64';
        const base64Data = finalImageUrl.split(',')[1] || '';
        const binarySize = (base64Data.length * 3) / 4;
        sizeKB = binarySize / 1024;
        sizeMB = sizeKB / 1024;
        console.log(`[auto_tag_asset] ✅ Image ${i + 1} converted to base64 (size was unknown), new size: ${sizeMB.toFixed(2)} MB`);
      } catch (base64Error) {
        console.error(`[auto_tag_asset] ❌ Failed to convert image ${i + 1} to base64:`, base64Error);
        // Continue with URL if base64 conversion fails
      }
    }
    
    // Update imageSizes with final values (after potential base64 conversion)
    imageSizes.push({ index: originalIndex + 1, sizeKB, sizeMB, isA2: finalIsA2, type: finalType, assetId });
    
    content.push({
      type: 'image_url',
      image_url: {
        url: finalImageUrl,
      },
    });
    
    console.log(`[auto_tag_asset] ✅ Image ${i + 1} added to content array (type: ${finalType}, size: ${sizeMB > 0 ? `${sizeMB.toFixed(2)} MB` : 'unknown'})`);
  }
  
  // Summary of images being sent
  const a2Count = supportedImageUrls.filter(url => url.includes('/ai/')).length;
  const totalSizeKB = imageSizes.reduce((sum, img) => sum + img.sizeKB, 0);
  const avgSizeKB = imageSizes.length > 0 ? totalSizeKB / imageSizes.length : 0;
  
  console.log(`[auto_tag_asset] 📊 Summary: ${a2Count} of ${supportedImageUrls.length} images are A2 versions`);
  console.log(`[auto_tag_asset] 📊 Total size: ${totalSizeKB > 0 ? `${totalSizeKB.toFixed(0)} KB (${(totalSizeKB / 1024).toFixed(2)} MB)` : 'unknown'}`);
  console.log(`[auto_tag_asset] 📊 Average size: ${avgSizeKB > 0 ? `${avgSizeKB.toFixed(0)} KB` : 'unknown'} per image`);
  
  // Verify images are in content array
  const imageItems = content.filter(item => item.type === 'image_url');
  console.log(`[auto_tag_asset] ✅ VERIFICATION: ${imageItems.length} images added to content array`);
  console.log(`[auto_tag_asset] ✅ VERIFICATION: Content array has ${content.length} items (1 text + ${imageItems.length} images)`);
  console.log(`[auto_tag_asset] ✅ VERIFICATION: Expected ${successful.length} successful images, got ${imageItems.length} images`);
  console.log(`[auto_tag_asset] ✅ VERIFICATION: ${failed.length} images failed preparation and will get empty tags`);
  
  if (imageItems.length !== successful.length) {
    console.error(`[auto_tag_asset] ❌ CRITICAL ERROR: Image count mismatch! Expected ${successful.length} successful images, got ${imageItems.length}`);
    console.error(`[auto_tag_asset] Content array structure:`, JSON.stringify(content.map((item: any) => ({
      type: item.type,
      hasUrl: !!item.image_url?.url,
      urlPreview: item.image_url?.url?.substring(0, 100) || 'NO URL'
    })), null, 2));
    throw new Error(`Image count mismatch: expected ${successful.length} successful images, got ${imageItems.length}`);
  }
  
  // Verify each image has a valid URL
  imageItems.forEach((item: any, idx: number) => {
    if (!item.image_url?.url) {
      console.error(`[auto_tag_asset] ❌ CRITICAL ERROR: Image ${idx + 1} is missing URL!`);
      throw new Error(`Image ${idx + 1} is missing URL`);
    }
  });
  console.log(`[auto_tag_asset] ✅ VERIFICATION: All ${imageItems.length} images have valid URLs`);
  
  // Verify tag vocabulary is included
  const promptText = content.find(item => item.type === 'text')?.text || '';
  const tagsInPrompt = tagVocabulary.every(tag => promptText.includes(tag));
  console.log(`[auto_tag_asset] ✅ VERIFICATION: Tag vocabulary length: ${tagVocabulary.length}`);
  console.log(`[auto_tag_asset] ✅ VERIFICATION: All tags in prompt? ${tagsInPrompt ? 'YES' : 'NO'}`);
  console.log(`[auto_tag_asset] ✅ VERIFICATION: Tag vocabulary in prompt: ${promptText.includes(tagVocabulary.join(', ')) ? 'YES' : 'NO'}`);
  if (!tagsInPrompt) {
    console.error(`[auto_tag_asset] ❌ ERROR: Some tags missing from prompt!`);
    tagVocabulary.forEach(tag => {
      if (!promptText.includes(tag)) {
        console.error(`[auto_tag_asset] ❌ Missing tag: ${tag}`);
      }
    });
  }
  
  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert photo analyzer for a jewelry brand. Analyze each image objectively and return tags that accurately describe what you actually see. Do NOT default to "Product" - only use it if the image is clearly a product photo. Be honest about what each image shows.',
      },
      {
        role: 'user',
        content,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'batch_tag_response',
        schema: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tags: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: tagVocabulary,
                    },
                    minItems: 1,
                    maxItems: 5,
                    description: `Array of 1-5 tags that accurately describe what is shown in the image. Must be from: ${tagVocabulary.join(', ')}`,
                  },
                },
                required: ['tags'],
                additionalProperties: false,
              },
              description: `Array of ${successful.length} tag results, one for each image in order.`,
            },
          },
          required: ['results'],
          additionalProperties: false,
        },
        strict: true,
      },
    },
    temperature: 0.3,
    max_tokens: 1000, // Increased for batch responses
  };

  let response: Response;
  try {
    console.log(`[auto_tag_asset] Making OpenAI batch API request for ${requests.length} images...`);
    console.log(`[auto_tag_asset] 📋 Tag vocabulary being sent to OpenAI:`, JSON.stringify(tagVocabulary, null, 2));
    console.log(`[auto_tag_asset] 📋 Tag vocabulary length: ${tagVocabulary.length}`);
    console.log(`[auto_tag_asset] 📋 Number of images in content array:`, content.filter(item => item.type === 'image_url').length);
    console.log(`[auto_tag_asset] 📋 Total content items (text + images):`, content.length);
    
    // Verify payload structure
    const payloadImages = payload.messages[1].content.filter((item: any) => item.type === 'image_url').length;
    const payloadText = payload.messages[1].content.find((item: any) => item.type === 'text')?.text || '';
    console.log(`[auto_tag_asset] ✅ VERIFICATION: Payload has ${payloadImages} images`);
    console.log(`[auto_tag_asset] ✅ VERIFICATION: Payload text includes tags: ${payloadText.includes(tagVocabulary.join(', ')) ? 'YES' : 'NO'}`);
    console.log(`[auto_tag_asset] ✅ VERIFICATION: JSON schema enum has ${payload.response_format.json_schema.schema.properties.results.items.properties.tags.items.enum.length} tags`);
    
    if (tagVocabulary.length === 0) {
      console.error(`[auto_tag_asset] ❌ CRITICAL ERROR: Tag vocabulary is EMPTY! Cannot proceed with tagging.`);
      throw new Error('Tag vocabulary is empty - no tags enabled for autotagging');
    }
    
    if (payloadImages === 0) {
      console.error(`[auto_tag_asset] ❌ CRITICAL ERROR: No images in payload!`);
      throw new Error('No images in payload');
    }
    
    // Calculate payload size before sending
    const payloadString = JSON.stringify(payload);
    const payloadSizeKB = payloadString.length / 1024;
    const payloadSizeMB = payloadSizeKB / 1024;
    
    console.log(`[auto_tag_asset] 📋 Payload size: ${payloadSizeKB.toFixed(0)} KB (${payloadSizeMB.toFixed(2)} MB)`);
    console.log(`[auto_tag_asset] 📋 Payload preview (first 1000 chars):`, payloadString.substring(0, 1000));
    
    // Log actual image URLs being sent (for verification)
    const imageUrlsInPayload = payload.messages[1].content
      .filter((item: any) => item.type === 'image_url')
      .map((item: any) => item.image_url?.url?.substring(0, 150) || 'MISSING URL');
    console.log(`[auto_tag_asset] 📋 Image URLs being sent to OpenAI (${imageUrlsInPayload.length} images):`);
    imageUrlsInPayload.forEach((url: string, idx: number) => {
      console.log(`[auto_tag_asset]   Image ${idx + 1}: ${url}...`);
    });
    
    // Verify we're actually sending the request
    console.log(`[auto_tag_asset] 🚀🚀🚀 SENDING REQUEST TO OPENAI NOW 🚀🚀🚀`);
    console.log(`[auto_tag_asset] 🚀 URL: ${OPENAI_API_URL}`);
    console.log(`[auto_tag_asset] 🚀 Method: POST`);
    console.log(`[auto_tag_asset] 🚀 Images in payload: ${payloadImages}`);
    console.log(`[auto_tag_asset] 🚀 Total content items: ${payload.messages[1].content.length}`);
    console.log(`[auto_tag_asset] 🚀 API Key present: ${!!apiKey}`);
    console.log(`[auto_tag_asset] 🚀 API Key length: ${apiKey?.length || 0}`);
    
    const requestStartTime = Date.now();
    try {
      response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: payloadString,
      });
      const requestDuration = Date.now() - requestStartTime;
      console.log(`[auto_tag_asset] ✅✅✅ OpenAI request completed in ${requestDuration}ms ✅✅✅`);
      console.log(`[auto_tag_asset] ✅ Response status: ${response.status} ${response.statusText}`);
      console.log(`[auto_tag_asset] ✅ Response ok: ${response.ok}`);
    } catch (fetchError) {
      const requestDuration = Date.now() - requestStartTime;
      console.error(`[auto_tag_asset] ❌❌❌ FETCH FAILED after ${requestDuration}ms ❌❌❌`);
      console.error(`[auto_tag_asset] Fetch error:`, fetchError);
      console.error(`[auto_tag_asset] Fetch error message:`, fetchError instanceof Error ? fetchError.message : String(fetchError));
      console.error(`[auto_tag_asset] Fetch error stack:`, fetchError instanceof Error ? fetchError.stack : 'N/A');
      throw fetchError;
    }
  } catch (networkError) {
    console.error('[auto_tag_asset] Network error calling OpenAI:', networkError);
    throw new Error(`Network error: ${networkError instanceof Error ? networkError.message : String(networkError)}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson: any = {};
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // Not JSON, use text as-is
    }
    
    console.error('[auto_tag_asset] OpenAI API error - Status:', response.status);
    console.error('[auto_tag_asset] OpenAI API error - Response:', errorText);
    
    // Handle specific error types
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const errorType = errorJson?.error?.type || 'unknown';
      const errorCode = errorJson?.error?.code || 'unknown';
      
      if (errorCode === 'insufficient_quota' || errorType === 'insufficient_quota') {
        console.error('[auto_tag_asset] ❌ QUOTA EXCEEDED - OpenAI API key has exceeded its quota/billing limit.');
        console.error('[auto_tag_asset] Please check your OpenAI account billing and add payment method if needed.');
        throw new Error('OpenAI quota exceeded - please check billing');
      } else {
        // Rate limit - retryable, return proper response so queue can handle it
        console.error('[auto_tag_asset] Rate limit exceeded - too many requests');
        const rateLimitError: any = new Error('OpenAI rate limit exceeded - please try again later');
        rateLimitError.isRateLimit = true;
        rateLimitError.retryAfter = retryAfter;
        throw rateLimitError;
      }
    } else if (response.status === 401) {
      console.error('[auto_tag_asset] ❌ UNAUTHORIZED - Invalid OpenAI API key');
      throw new Error('Invalid OpenAI API key');
    } else if (response.status === 400) {
      // 400 errors often indicate a problem with a specific image (e.g., "Image size exceeds the limit")
      // If we have multiple images, try processing them individually as fallback
      const errorMessage = errorJson?.error?.message || errorText;
      const errorCode = errorJson?.error?.code || '';
      const isImageError = errorMessage?.toLowerCase().includes('image') || 
                          errorMessage?.toLowerCase().includes('invalid_image') ||
                          errorMessage?.includes('Image size') ||
                          errorCode === 'image_parse_error' ||
                          errorMessage?.toLowerCase().includes('unsupported image') ||
                          errorMessage?.toLowerCase().includes('image_parse');
      
      if (isImageError && successful.length > 1) {
        console.warn(`[auto_tag_asset] ⚠️  Batch failed with image error (${response.status}), falling back to individual processing`);
        console.warn(`[auto_tag_asset] Error message: ${errorMessage}`);
        console.warn(`[auto_tag_asset] Attempting to process ${successful.length} images individually...`);
        
        // Process each successful image individually
        const individualResults: TagResult[] = [];
        const failedAssetIds = new Set(failed.map(f => f.assetId));
        
        for (let i = 0; i < successful.length; i++) {
          const successItem = successful[i];
          const originalRequest = requests.find(r => r.assetId === successItem.assetId);
          
          if (!originalRequest) {
            console.error(`[auto_tag_asset] Could not find original request for ${successItem.assetId}`);
            individualResults.push({ assetId: successItem.assetId, tags: [] });
            continue;
          }
          
          try {
            console.log(`[auto_tag_asset] 🔄 Processing image ${i + 1}/${successful.length} individually: ${successItem.assetId}`);
            console.log(`[auto_tag_asset] Image URL: ${originalRequest.imageUrl.substring(0, 100)}...`);
            
            // Ensure image format is supported before processing individually
            const supportedUrl = await ensureSupportedImageFormat(originalRequest.imageUrl, supabaseClient);
            const updatedRequest = { ...originalRequest, imageUrl: supportedUrl };
            
            const singleResult = await getSuggestedTagsBatch(
              [updatedRequest],
              apiKey,
              tagVocabulary,
              supabaseClient
            );
            
            if (singleResult.length > 0 && singleResult[0].tags.length > 0) {
              individualResults.push(singleResult[0]);
              console.log(`[auto_tag_asset] ✅ Individual processing succeeded for ${successItem.assetId}: [${singleResult[0].tags.join(', ')}]`);
            } else {
              individualResults.push({ assetId: successItem.assetId, tags: [] });
              console.warn(`[auto_tag_asset] ⚠️  Individual processing returned empty tags for ${successItem.assetId}`);
            }
          } catch (individualError) {
            console.error(`[auto_tag_asset] ❌ Individual processing failed for ${successItem.assetId}:`, individualError);
            console.error(`[auto_tag_asset] Error details:`, individualError instanceof Error ? individualError.message : String(individualError));
            console.error(`[auto_tag_asset] Error stack:`, individualError instanceof Error ? individualError.stack : 'N/A');
            // Add empty tags for this failed image, but continue processing others
            individualResults.push({ assetId: successItem.assetId, tags: [] });
          }
        }
        
        // Combine individual results with failed images (which already have empty tags)
        const finalResults: TagResult[] = [];
        const individualResultsMap = new Map(individualResults.map(r => [r.assetId, r]));
        
        for (let i = 0; i < requests.length; i++) {
          const assetId = requests[i].assetId;
          
          if (failedAssetIds.has(assetId)) {
            // Image failed preparation - already handled
            finalResults.push({ assetId, tags: [] });
          } else if (individualResultsMap.has(assetId)) {
            // Image was processed individually
            finalResults.push(individualResultsMap.get(assetId)!);
          } else {
            // Shouldn't happen, but handle it
            console.warn(`[auto_tag_asset] ⚠️  Missing result for ${assetId}, adding empty tags`);
            finalResults.push({ assetId, tags: [] });
          }
        }
        
        const successCount = finalResults.filter(r => r.tags.length > 0).length;
        console.log(`[auto_tag_asset] ✅ Fallback processing complete: ${successCount}/${requests.length} succeeded`);
        console.log(`[auto_tag_asset] ✅ Returning ${finalResults.length} results (some may have empty tags)`);
        // Always return results, never throw - even if some failed
        return finalResults;
      } else {
        // Single image or non-image error - for single images, return empty tags instead of throwing
        if (successful.length === 1) {
          console.warn(`[auto_tag_asset] ⚠️  Single image failed with 400 error, returning empty tags`);
          const failedAssetIds = new Set(failed.map(f => f.assetId));
          const results: TagResult[] = [];
          for (let i = 0; i < requests.length; i++) {
            const assetId = requests[i].assetId;
            if (failedAssetIds.has(assetId)) {
              results.push({ assetId, tags: [] });
            } else {
              // The single successful image failed - return empty tags
              results.push({ assetId, tags: [] });
            }
          }
          return results;
        }
        // Multiple images but non-image error - throw normally
        throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
      }
    } else {
      // Non-400 errors - if we have multiple images, try individual processing as last resort
      if (successful.length > 1) {
        console.warn(`[auto_tag_asset] ⚠️  Batch failed with ${response.status} error, falling back to individual processing`);
        const individualResults: TagResult[] = [];
        const failedAssetIds = new Set(failed.map(f => f.assetId));
        
        for (let i = 0; i < successful.length; i++) {
          const successItem = successful[i];
          const originalRequest = requests.find(r => r.assetId === successItem.assetId);
          
          if (!originalRequest) {
            individualResults.push({ assetId: successItem.assetId, tags: [] });
            continue;
          }
          
          try {
            console.log(`[auto_tag_asset] 🔄 Processing image ${i + 1}/${successful.length} individually: ${successItem.assetId}`);
            const singleResult = await getSuggestedTagsBatch(
              [originalRequest],
              apiKey,
              tagVocabulary,
              supabaseClient
            );
            
            if (singleResult.length > 0 && singleResult[0].tags.length > 0) {
              individualResults.push(singleResult[0]);
            } else {
              individualResults.push({ assetId: successItem.assetId, tags: [] });
            }
          } catch (individualError) {
            console.error(`[auto_tag_asset] ❌ Individual processing failed for ${successItem.assetId}:`, individualError);
            individualResults.push({ assetId: successItem.assetId, tags: [] });
          }
        }
        
        const finalResults: TagResult[] = [];
        const individualResultsMap = new Map(individualResults.map(r => [r.assetId, r]));
        
        for (let i = 0; i < requests.length; i++) {
          const assetId = requests[i].assetId;
          if (failedAssetIds.has(assetId)) {
            finalResults.push({ assetId, tags: [] });
          } else if (individualResultsMap.has(assetId)) {
            finalResults.push(individualResultsMap.get(assetId)!);
          } else {
            finalResults.push({ assetId, tags: [] });
          }
        }
        
        const successCount = finalResults.filter(r => r.tags.length > 0).length;
        console.log(`[auto_tag_asset] ✅ Fallback processing complete: ${successCount}/${requests.length} succeeded`);
        return finalResults;
      }
      throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
    }
  }

  const json = await response.json();
  const responseContent = json.choices?.[0]?.message?.content ?? '{}';
  console.log('[auto_tag_asset] Raw OpenAI batch response:', JSON.stringify(json, null, 2));
  console.log('[auto_tag_asset] Parsed content:', responseContent);
  
  // Check if response is empty or malformed
  if (!responseContent || responseContent === '{}' || responseContent.trim() === '') {
    console.error('[auto_tag_asset] ❌ Empty or invalid response content from OpenAI');
    console.error('[auto_tag_asset] Full response:', JSON.stringify(json, null, 2));
    throw new Error('Empty response from OpenAI');
  }
  
  let parsed;
  try {
    parsed = JSON.parse(responseContent);
  } catch (e) {
    console.error('[auto_tag_asset] Failed to parse JSON:', e);
    console.error('[auto_tag_asset] Raw content:', responseContent);
    console.error('[auto_tag_asset] Content type:', typeof responseContent);
    console.error('[auto_tag_asset] Content length:', responseContent.length);
    throw new Error('Invalid JSON response from OpenAI');
  }
  
  console.log('[auto_tag_asset] Parsed JSON structure:', JSON.stringify(parsed, null, 2));
  const results = Array.isArray(parsed.results) ? parsed.results : [];
  
  // Results should match the number of successful images, not all requests
  const expectedResults = successful.length;
  if (results.length !== expectedResults) {
    console.error(`[auto_tag_asset] ❌ Expected ${expectedResults} results (for ${successful.length} successful images), got ${results.length}`);
    console.error(`[auto_tag_asset] Total requests: ${requests.length}, Successful: ${successful.length}, Failed: ${failed.length}`);
    console.error(`[auto_tag_asset] Parsed object keys:`, Object.keys(parsed));
    console.error(`[auto_tag_asset] Results array:`, JSON.stringify(results, null, 2));
    
    // Instead of throwing, process partial results to avoid losing all progress
    // This handles cases where OpenAI returns fewer results than expected
    console.warn(`[auto_tag_asset] ⚠️  Processing partial results: got ${results.length} of ${expectedResults} expected results`);
    // Continue with partial results - we'll handle missing results in the mapping loop
  }
  
  // Check if all results have empty tags
  const emptyResults = results.filter((r: any) => !r?.tags || !Array.isArray(r.tags) || r.tags.length === 0);
  if (emptyResults.length === results.length) {
    console.warn(`[auto_tag_asset] ⚠️  All ${results.length} results have empty tags arrays!`);
    console.warn(`[auto_tag_asset] This suggests OpenAI returned empty tags or the response format is wrong`);
  }
  
  console.log(`[auto_tag_asset] 📊 Processing ${results.length} results from OpenAI...`);
  console.log(`[auto_tag_asset] Tag vocabulary: [${tagVocabulary.join(', ')}]`);
  console.log(`[auto_tag_asset] Tag vocabulary length: ${tagVocabulary.length}`);
  console.log(`[auto_tag_asset] Full results array:`, JSON.stringify(results, null, 2));
  
  // Map results back to asset IDs
  // Note: results array corresponds to successful images only, in the order they were sent
  // We need to map them back to the original request order
  const tagResults: TagResult[] = [];
  const failedAssetIds = new Set(failed.map(f => f.assetId));
  
  // Create a map of successful images by their original index
  const successfulByIndex = new Map(successful.map(s => [s.index, s]));
  
  // Process all requests in order, using results for successful ones
  let resultIndex = 0; // Index into results array (only successful images)
  
  for (let i = 0; i < requests.length; i++) {
    const assetId = requests[i].assetId;
    
    if (failedAssetIds.has(assetId)) {
      // This image failed preparation - return empty tags
      console.warn(`[auto_tag_asset] ⚠️  Asset ${assetId} (index ${i}) failed preparation, returning empty tags`);
      tagResults.push({
        assetId: assetId,
        tags: [],
      });
      continue;
    }
    
    // This image succeeded - get its result from OpenAI
    // Handle case where OpenAI returned fewer results than expected
    if (resultIndex >= results.length) {
      console.error(`[auto_tag_asset] ❌ CRITICAL: Result index ${resultIndex} out of bounds (results.length=${results.length}) for asset ${assetId}`);
      console.error(`[auto_tag_asset] This means OpenAI returned fewer results than expected`);
      console.error(`[auto_tag_asset] Expected ${successful.length} results, got ${results.length}`);
      // Add empty tags for this asset and continue
      tagResults.push({
        assetId: assetId,
        tags: [],
      });
      continue;
    }
    
    const result = results[resultIndex];
    resultIndex++;
    
    console.log(`[auto_tag_asset] Processing result ${resultIndex}/${results.length} for asset ${assetId} (original index ${i}):`, JSON.stringify(result, null, 2));
    
    // Defensive check: ensure result exists and has expected structure
    if (!result || typeof result !== 'object') {
      console.error(`[auto_tag_asset] ❌ Invalid result object for asset ${assetId}:`, result);
      tagResults.push({
        assetId: assetId,
        tags: [],
      });
      continue;
    }
    
    const rawTags = Array.isArray(result?.tags) ? result.tags : [];
    console.log(`[auto_tag_asset] Image ${i + 1} (${assetId}): raw tags from OpenAI: [${rawTags.join(', ')}]`);
    console.log(`[auto_tag_asset] Raw tags array length: ${rawTags.length}`);
    console.log(`[auto_tag_asset] Raw tags type check: Array.isArray=${Array.isArray(rawTags)}, typeof=${typeof rawTags}`);
    
    if (rawTags.length === 0) {
      console.error(`[auto_tag_asset] ❌ Image ${i + 1} (${assetId}) has EMPTY tags array from OpenAI!`);
      console.error(`[auto_tag_asset] This violates the schema requirement of minItems: 1`);
      console.error(`[auto_tag_asset] Result object:`, JSON.stringify(result, null, 2));
    }
    
    // Validate tags are in the vocabulary
    const validTags = rawTags.filter(tag => tagVocabulary.includes(tag)).slice(0, 5);
    const invalidTags = rawTags.filter(tag => !tagVocabulary.includes(tag));
    
    if (invalidTags.length > 0) {
      console.warn(`[auto_tag_asset] ⚠️  Image ${i + 1} (${assetId}) has invalid tags (not in vocabulary): [${invalidTags.join(', ')}]`);
      console.warn(`[auto_tag_asset]   Vocabulary contains: [${tagVocabulary.join(', ')}]`);
    }
    
    if (validTags.length === 0) {
      console.error(`[auto_tag_asset] ❌ No valid tags for image ${i + 1} (${assetId}) after filtering`);
      console.error(`[auto_tag_asset]   Raw tags were: [${rawTags.join(', ')}]`);
      console.error(`[auto_tag_asset]   Vocabulary has: [${tagVocabulary.join(', ')}]`);
      console.error(`[auto_tag_asset]   This means OpenAI either returned empty tags OR all tags were filtered out`);
    } else {
      console.log(`[auto_tag_asset] ✅ Image ${i + 1} (${assetId}): valid tags: [${validTags.join(', ')}]`);
    }
    
    tagResults.push({
      assetId: assetId,
      tags: validTags,
    });
  }
  
  // Verify we have results for all requests
  if (tagResults.length !== requests.length) {
    console.error(`[auto_tag_asset] ❌ CRITICAL: Expected ${requests.length} results, got ${tagResults.length}!`);
    console.error(`[auto_tag_asset] Successful: ${successful.length}, Failed: ${failed.length}, Results processed: ${resultIndex}`);
    throw new Error(`Result count mismatch: expected ${requests.length}, got ${tagResults.length}`);
  }
  
  console.log(`[auto_tag_asset] ✅ Mapped ${tagResults.length} results (${successful.length} successful, ${failed.length} failed)`);
  
  const totalTags = tagResults.reduce((sum, r) => sum + r.tags.length, 0);
  console.log(`[auto_tag_asset] ✅ Batch processing complete: ${tagResults.length} results, ${totalTags} total tags`);
  return tagResults;
}

// OpenAI Batch API: Create batch job for 20+ images (async, 50% cost savings)
async function createOpenAIBatch(
  requests: AutoTagRequest[],
  apiKey: string,
  tagVocabulary: string[],
  supabaseClient: any,
  userId: string
): Promise<{ batchId: string; fileId: string }> {
  console.log(`[auto_tag_asset] 🚀 Creating OpenAI Batch API job for ${requests.length} images...`);
  
  if (requests.length < BATCH_API_THRESHOLD) {
    throw new Error(`Batch API requires at least ${BATCH_API_THRESHOLD} images, got ${requests.length}`);
  }
  
  // Step 1: Prepare all images (using A2 versions)
  console.log(`[auto_tag_asset] 🔄 Preparing ${requests.length} images for Batch API...`);
  const imagePromises = requests.map(async (req, idx) => {
    try {
      const url = await ensureSupportedImageFormat(req.imageUrl, supabaseClient);
      return { success: true, url, assetId: req.assetId, index: idx };
    } catch (error) {
      console.error(`[auto_tag_asset] ❌ Failed to prepare image ${idx + 1} (${req.assetId}):`, error);
      return { success: false, error, assetId: req.assetId, index: idx };
    }
  });
  
  const preparationResults = await Promise.allSettled(imagePromises);
  const successful: Array<{ url: string; assetId: string; index: number }> = [];
  const failed: Array<{ assetId: string; index: number; error: any }> = [];
  
  preparationResults.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      const prepResult = result.value;
      if (prepResult.success && 'url' in prepResult) {
        successful.push({ url: prepResult.url, assetId: prepResult.assetId, index: prepResult.index });
      } else if ('error' in prepResult) {
        failed.push({ 
          assetId: prepResult.assetId, 
          index: prepResult.index, 
          error: prepResult.error 
        });
      }
    } else {
      failed.push({ 
        assetId: requests[idx].assetId, 
        index: idx, 
        error: result.reason 
      });
    }
  });
  
  console.log(`[auto_tag_asset] ✅ Prepared ${successful.length}/${requests.length} images successfully`);
  if (failed.length > 0) {
    console.warn(`[auto_tag_asset] ⚠️  ${failed.length} images failed preparation`);
  }
  
  if (successful.length === 0) {
    throw new Error(`All ${requests.length} images failed preparation`);
  }
  
  // Step 2: Create JSONL file content (one request per line)
  console.log(`[auto_tag_asset] 📝 Creating JSONL file with ${successful.length} requests...`);
  const jsonlLines: string[] = [];
  
  for (const img of successful) {
    const content: any[] = [
      {
        type: 'text',
        text: `Analyze this photo and return tags from this vocabulary: ${tagVocabulary.join(', ')}.

AVAILABLE TAGS (you MUST use only these tags): ${JSON.stringify(tagVocabulary)}.

CRITICAL: Only tag what you ACTUALLY see in the image. Do NOT default to "Product" unless the image clearly shows a product photo.

Return tags for this image. The image should have 1-5 tags that accurately reflect what is in the image.`,
      },
      {
        type: 'image_url',
        image_url: { url: img.url },
      },
    ];
    
    const batchRequest = {
      custom_id: img.assetId, // Use assetId as custom_id for mapping results back
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert photo analyzer for a jewelry brand. Analyze each image objectively and return tags that accurately describe what you actually see. Do NOT default to "Product" - only use it if the image is clearly a product photo.',
          },
          {
            role: 'user',
            content,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'tag_response',
            schema: {
              type: 'object',
              properties: {
                tags: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: tagVocabulary,
                  },
                  minItems: 1,
                  maxItems: 5,
                  description: `Array of 1-5 tags that accurately describe what is shown in the image. Must be from: ${tagVocabulary.join(', ')}`,
                },
              },
              required: ['tags'],
              additionalProperties: false,
            },
            strict: true,
          },
        },
        temperature: 0.3,
        max_tokens: 200,
      },
    };
    
    jsonlLines.push(JSON.stringify(batchRequest));
  }
  
  if (jsonlLines.length === 0) {
    throw new Error('No valid requests to include in batch');
  }
  
  const jsonlContent = jsonlLines.join('\n');
  console.log(`[auto_tag_asset] ✅ Created JSONL file (${jsonlContent.length} bytes, ${jsonlLines.length} lines)`);
  
  // Step 3: Upload file to OpenAI
  console.log(`[auto_tag_asset] 📤 Uploading JSONL file to OpenAI...`);
  const fileBlob = new Blob([jsonlContent], { type: 'application/jsonl' });
  const formData = new FormData();
  formData.append('file', fileBlob, 'batch_input.jsonl');
  formData.append('purpose', 'batch');
  
  const uploadResponse = await fetch(OPENAI_FILES_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error(`[auto_tag_asset] ❌ Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`);
    console.error(`[auto_tag_asset] Error: ${errorText}`);
    throw new Error(`Failed to upload batch file: ${uploadResponse.status} ${errorText}`);
  }
  
  const uploadResult = await uploadResponse.json();
  const fileId = uploadResult.id;
  console.log(`[auto_tag_asset] ✅ File uploaded successfully: ${fileId}`);
  
  // Step 4: Create batch job
  console.log(`[auto_tag_asset] 🚀 Creating batch job...`);
  const batchResponse = await fetch(OPENAI_BATCH_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input_file_id: fileId,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
    }),
  });
  
  if (!batchResponse.ok) {
    const errorText = await batchResponse.text();
    console.error(`[auto_tag_asset] ❌ Failed to create batch: ${batchResponse.status} ${batchResponse.statusText}`);
    console.error(`[auto_tag_asset] Error: ${errorText}`);
    throw new Error(`Failed to create batch: ${batchResponse.status} ${errorText}`);
  }
  
  const batchResult = await batchResponse.json();
  const batchId = batchResult.id;
  console.log(`[auto_tag_asset] ✅ Batch job created successfully: ${batchId}`);
  console.log(`[auto_tag_asset] Batch status: ${batchResult.status}`);
  
  // Step 5: Store batch_id in database for polling
  console.log(`[auto_tag_asset] 💾 Storing batch_id in database...`);
  const assetIds = successful.map(img => img.assetId);
  const failedAssetIds = failed.map(f => f.assetId);
  
  // Update assets with batch_id and mark as pending
  const { error: updateError } = await supabaseClient
    .from('assets')
    .update({
      openai_batch_id: batchId,
      auto_tag_status: 'pending',
    })
    .in('id', assetIds);
  
  if (updateError) {
    console.error(`[auto_tag_asset] ❌ Failed to store batch_id:`, updateError);
    // Don't throw - batch was created successfully, we can still poll
  } else {
    console.log(`[auto_tag_asset] ✅ Stored batch_id for ${assetIds.length} assets`);
  }
  
  // Mark failed assets as failed
  if (failedAssetIds.length > 0) {
    await supabaseClient
      .from('assets')
      .update({ auto_tag_status: 'failed' })
      .in('id', failedAssetIds);
    console.log(`[auto_tag_asset] ✅ Marked ${failedAssetIds.length} failed assets`);
  }
  
  return { batchId, fileId };
}

// Process completed OpenAI Batch API results
async function processBatchResults(
  batchId: string,
  apiKey: string,
  supabaseClient: any
): Promise<void> {
  console.log(`[auto_tag_asset] 🔍 Processing batch results for batch: ${batchId}`);
  
  // Step 1: Check batch status
  const statusResponse = await fetch(`${OPENAI_BATCH_API_URL}/${batchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  
  if (!statusResponse.ok) {
    const errorText = await statusResponse.text();
    throw new Error(`Failed to check batch status: ${statusResponse.status} ${errorText}`);
  }
  
  const batchStatus = await statusResponse.json();
  console.log(`[auto_tag_asset] Batch status: ${batchStatus.status}`);
  
  if (batchStatus.status !== 'completed') {
    console.log(`[auto_tag_asset] Batch not yet completed (status: ${batchStatus.status}), skipping processing`);
    return;
  }
  
  if (!batchStatus.output_file_id) {
    console.error(`[auto_tag_asset] ❌ Batch completed but no output_file_id`);
    throw new Error('Batch completed but no output file');
  }
  
  // Step 2: Download output file
  console.log(`[auto_tag_asset] 📥 Downloading batch results from file: ${batchStatus.output_file_id}`);
  const outputResponse = await fetch(`${OPENAI_FILES_API_URL}/${batchStatus.output_file_id}/content`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  
  if (!outputResponse.ok) {
    const errorText = await outputResponse.text();
    throw new Error(`Failed to download batch results: ${outputResponse.status} ${errorText}`);
  }
  
  const outputText = await outputResponse.text();
  const outputLines = outputText.trim().split('\n').filter(line => line.trim());
  console.log(`[auto_tag_asset] ✅ Downloaded ${outputLines.length} results`);
  
  // Step 3: Process results and update assets
  const resultsMap = new Map<string, string[]>(); // assetId -> tags
  
  for (const line of outputLines) {
    try {
      const result = JSON.parse(line);
      const customId = result.custom_id; // This is the assetId we set
      const response = result.response;
      
      if (!customId) {
        console.warn(`[auto_tag_asset] ⚠️  Result missing custom_id:`, result);
        continue;
      }
      
      if (response?.status_code !== 200) {
        console.error(`[auto_tag_asset] ❌ Request failed for asset ${customId}:`, response);
        resultsMap.set(customId, []); // Empty tags for failed requests
        continue;
      }
      
      // Parse tags from response body
      const responseBody = response.body;
      let tags: string[] = [];
      
      if (typeof responseBody === 'string') {
        const parsed = JSON.parse(responseBody);
        const content = parsed.choices?.[0]?.message?.content;
        if (content) {
          const tagData = JSON.parse(content);
          tags = Array.isArray(tagData.tags) ? tagData.tags : [];
        }
      } else if (responseBody?.choices?.[0]?.message?.content) {
        const content = responseBody.choices[0].message.content;
        const tagData = JSON.parse(content);
        tags = Array.isArray(tagData.tags) ? tagData.tags : [];
      }
      
      resultsMap.set(customId, tags);
      console.log(`[auto_tag_asset] ✅ Processed result for asset ${customId}: [${tags.join(', ')}]`);
    } catch (error) {
      console.error(`[auto_tag_asset] ❌ Failed to process result line:`, error);
      console.error(`[auto_tag_asset] Line:`, line.substring(0, 200));
    }
  }
  
  // Step 4: Update assets in database
  console.log(`[auto_tag_asset] 💾 Updating ${resultsMap.size} assets with tags...`);
  
  for (const [assetId, aiTags] of resultsMap.entries()) {
    // Location is now stored in separate column, so we just update tags directly
    // No need to preserve location from tags anymore
    const { error } = await supabaseClient
      .from('assets')
      .update({
        tags: aiTags,
        auto_tag_status: aiTags.length > 0 ? 'completed' : 'failed',
        openai_batch_id: null, // Clear batch_id after processing
      })
      .eq('id', assetId);
    
    if (error) {
      console.error(`[auto_tag_asset] ❌ Failed to update asset ${assetId}:`, error);
    } else {
      console.log(`[auto_tag_asset] ✅ Updated asset ${assetId} with ${aiTags.length} AI tags`);
    }
  }
  
  // Mark any assets with batch_id but no results as failed
  const { data: assetsWithBatchId } = await supabaseClient
    .from('assets')
    .select('id')
    .eq('openai_batch_id', batchId);
  
  if (assetsWithBatchId) {
    const processedAssetIds = new Set(resultsMap.keys());
    const unprocessedAssets = assetsWithBatchId
      .filter((a: any) => !processedAssetIds.has(a.id))
      .map((a: any) => a.id);
    
    if (unprocessedAssets.length > 0) {
      console.warn(`[auto_tag_asset] ⚠️  ${unprocessedAssets.length} assets in batch but no results, marking as failed`);
      await supabaseClient
        .from('assets')
        .update({
          auto_tag_status: 'failed',
          openai_batch_id: null,
        })
        .in('id', unprocessedAssets);
    }
  }
  
  console.log(`[auto_tag_asset] ✅ Batch processing complete for batch: ${batchId}`);
}

// Single image processing (kept for backward compatibility)
async function getSuggestedTags(
  { imageUrl }: AutoTagRequest,
  apiKey?: string,
  tagVocabulary: string[] = [],
  supabaseClient?: any
): Promise<string[]> {
  if (!apiKey) {
    console.warn('[auto_tag_asset] Missing OPENAI_API_KEY. Cannot generate tags.');
    throw new Error('OpenAI API key not configured');
  }
  
  // Validate that tagVocabulary is provided and not empty
  if (!tagVocabulary || tagVocabulary.length === 0) {
    console.error('[auto_tag_asset] ❌ No tags provided in vocabulary - cannot generate tags');
    throw new Error('No tags enabled for auto-tagging');
  }
  
  console.log('[auto_tag_asset] Tag vocabulary for GPT-4:', tagVocabulary);
  
  // Ensure image format is supported (using A2 version for AI tagging)
  const supportedImageUrl = await ensureSupportedImageFormat(imageUrl, supabaseClient);

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert photo analyzer for a jewelry brand. Analyze the image objectively and return tags that accurately describe what you actually see. Do NOT default to "Product" - only use it if the image is clearly a product photo. Be honest about what the image shows.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this photo objectively and return 1-5 tags from this vocabulary: ${tagVocabulary.join(', ')}.

CRITICAL: Only tag what you ACTUALLY see in the image. Do NOT default to "Product" unless the image clearly shows a product photo.

PHOTO TYPE ANALYSIS:
1. Look at the image carefully - what does it actually show?
2. Is there a person visible? → Use "Lifestyle" tag
3. Is it just jewelry on a plain background? → Use "Product" tag
4. What jewelry is visible? (Necklace, Earrings, Rings, Bracelets)
5. What style/aesthetic? (Bright, Moody, Studio, Onyx, etc.)

TAGGING GUIDELINES:
- Person wearing jewelry → ["Lifestyle", "Necklace", ...]
- Product shot on plain background → ["Product", "Necklace", ...]
- Studio/lifestyle scene → ["Lifestyle", "Necklace", "Studio", ...]
- Only use "Product" if it's clearly a product photo, not a lifestyle photo

DO NOT:
- Default to "Product" if unsure
- Assume it's a product photo
- Add tags you cannot see

Return tags that accurately reflect what is in the image.`,
          },
          {
            type: 'image_url',
            image_url: {
              // If it's a data URL, use it directly; otherwise use url property
              ...(supportedImageUrl.startsWith('data:') 
                ? { url: supportedImageUrl }
                : { url: supportedImageUrl }
              ),
            },
          },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'tag_response',
        schema: {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
                  items: {
                    type: 'string',
                    enum: tagVocabulary,
                  },
              minItems: 1,
              maxItems: 5,
              description: 'Array of 1-5 tags that accurately describe what is shown in the image. For product photos, include "Product" plus jewelry type. For lifestyle photos, include "Lifestyle" plus jewelry type.',
            },
          },
          required: ['tags'],
          additionalProperties: false,
        },
        strict: true,
      },
    },
    temperature: 0.3, // Lower temperature for more consistent, structured responses
    max_tokens: 200,
  };

  let response: Response;
  try {
    const isA2 = supportedImageUrl.includes('/ai/');
    const isBase64 = supportedImageUrl.startsWith('data:');
    const openaiStartTime = Date.now();
    
    // Get final image size being sent to OpenAI
    let finalSizeKB = 0;
    let finalSizeMB = 0;
    
    if (isBase64) {
      // Calculate size from base64
      const base64Data = supportedImageUrl.split(',')[1] || '';
      const binarySize = (base64Data.length * 3) / 4;
      finalSizeKB = binarySize / 1024;
      finalSizeMB = finalSizeKB / 1024;
    } else {
      // Fetch image to get actual size
      try {
        const headResponse = await fetch(supportedImageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        const contentLength = headResponse.headers.get('content-length');
        if (contentLength) {
          finalSizeKB = parseInt(contentLength) / 1024;
          finalSizeMB = finalSizeKB / 1024;
        }
      } catch (sizeError) {
        console.warn('[auto_tag_asset] Could not get final image size:', sizeError);
      }
    }
    
    console.log('[auto_tag_asset] 📤 Making OpenAI API request...');
    console.log('[auto_tag_asset]    Image URL:', supportedImageUrl.substring(0, 150));
    console.log('[auto_tag_asset]    Is A2?', isA2 ? 'YES ✅' : 'NO ⚠️ (PERFORMANCE IMPACT: Using larger A1 image)');
    console.log('[auto_tag_asset]    Type:', isBase64 ? 'base64' : 'URL');
    console.log('[auto_tag_asset]    Final size sent to OpenAI:', finalSizeKB > 0 ? `${finalSizeKB.toFixed(0)} KB (${finalSizeMB.toFixed(2)} MB)` : 'unknown');
    console.log('[auto_tag_asset]    Target range: 200-500 KB -', finalSizeKB > 0 ? (finalSizeKB >= 200 && finalSizeKB <= 500 ? '✅ IN RANGE' : `⚠️ OUT OF RANGE (${finalSizeKB.toFixed(0)} KB)`) : 'unknown');
    console.log('[auto_tag_asset]    API Key present:', !!apiKey);
    console.log('[auto_tag_asset]    API Key length:', apiKey?.length || 0);
    
    if (!isA2) {
      console.warn('[auto_tag_asset] ⚠️⚠️⚠️ PERFORMANCE WARNING: Not using A2 compression! This will be slower. ⚠️⚠️⚠️');
    }
    
    if (finalSizeKB > 0 && finalSizeKB > 500) {
      console.warn(`[auto_tag_asset] ⚠️  Image size (${finalSizeKB.toFixed(0)} KB) exceeds target range - may impact performance`);
    }
    
    response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    console.error('[auto_tag_asset] Network error calling OpenAI:', networkError);
    throw new Error(`Network error: ${networkError instanceof Error ? networkError.message : String(networkError)}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson: any = {};
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // Not JSON, use text as-is
    }
    
    console.error('[auto_tag_asset] OpenAI API error - Status:', response.status);
    console.error('[auto_tag_asset] OpenAI API error - Response:', errorText);
    
    // Handle specific error types
    if (response.status === 429) {
      const errorType = errorJson?.error?.type || 'unknown';
      const errorCode = errorJson?.error?.code || 'unknown';
      
      if (errorCode === 'insufficient_quota' || errorType === 'insufficient_quota') {
        console.error('[auto_tag_asset] ❌ QUOTA EXCEEDED - OpenAI API key has exceeded its quota/billing limit.');
        console.error('[auto_tag_asset] Please check your OpenAI account billing and add payment method if needed.');
        throw new Error('OpenAI quota exceeded - please check billing');
      } else {
        console.error('[auto_tag_asset] Rate limit exceeded - too many requests');
        throw new Error('OpenAI rate limit exceeded - please try again later');
      }
    } else if (response.status === 401) {
      console.error('[auto_tag_asset] ❌ UNAUTHORIZED - Invalid OpenAI API key');
      throw new Error('Invalid OpenAI API key');
    } else {
      throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
    }
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? '{}';
  console.log('[auto_tag_asset] Raw OpenAI response:', JSON.stringify(json, null, 2));
  console.log('[auto_tag_asset] Parsed content:', content);
  
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error('[auto_tag_asset] Failed to parse JSON:', e);
    console.error('[auto_tag_asset] Raw content:', content);
    throw new Error('Invalid JSON response from OpenAI');
  }
  
  const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  
  if (tags.length === 0) {
    console.error('[auto_tag_asset] ❌ No tags returned from OpenAI');
    console.error('[auto_tag_asset] Parsed object:', JSON.stringify(parsed, null, 2));
    throw new Error('No tags returned from OpenAI');
  }
  
  // Validate tags are in the vocabulary (strict mode should prevent this, but check anyway)
  const invalidTags = tags.filter(tag => !tagVocabulary.includes(tag));
  if (invalidTags.length > 0) {
    console.error('[auto_tag_asset] ❌ Invalid tags returned (not in vocabulary):', invalidTags);
    console.error('[auto_tag_asset] Valid vocabulary:', tagVocabulary);
    console.error('[auto_tag_asset] Received tags:', tags);
    // Filter out invalid tags instead of failing completely
    const validTags = tags.filter(tag => tagVocabulary.includes(tag));
    console.log('[auto_tag_asset] Filtered to valid tags:', validTags);
    if (validTags.length === 0) {
      throw new Error('No valid tags returned (all tags were invalid)');
    }
    return validTags.slice(0, 5);
  }
  
  console.log('[auto_tag_asset] ✅ Final tags (all valid):', tags);
  return tags.slice(0, 5); // Ensure max 5 tags
}

Deno.serve(async (req) => {
  const functionStartTime = Date.now();
  
  // CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  
  // Support GET for batch polling
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const batchId = url.searchParams.get('batch_id');
    
    if (!batchId) {
      return new Response(JSON.stringify({ error: 'batch_id parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Supabase configuration missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    try {
      await processBatchResults(batchId, openAiKey, supabaseClient);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Batch results processed successfully' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error(`[auto_tag_asset] ❌ Failed to process batch ${batchId}:`, error);
      return new Response(JSON.stringify({ 
        error: 'Failed to process batch results',
        details: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    
    // Check if this is a batch request
    const isBatchRequest = body?.assets && Array.isArray(body.assets);
    
    if (isBatchRequest) {
      // Handle batch request
      const batchBody = body as AutoTagBatchRequest;
      
      if (!batchBody.assets || batchBody.assets.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid batch payload - assets array required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Validate all assets have required fields
      for (const asset of batchBody.assets) {
        if (!asset?.assetId || !asset?.imageUrl) {
          return new Response(JSON.stringify({ error: 'Invalid batch payload - all assets must have assetId and imageUrl' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !serviceKey) {
        console.error('[auto_tag_asset] Missing Supabase env vars');
        return new Response(JSON.stringify({ error: 'Configuration error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const supabaseClient = createClient(supabaseUrl, serviceKey);
      const openAiKey = Deno.env.get('OPENAI_API_KEY');
      
      // Get user_id from first asset (all assets should belong to same user)
      // Try to get all assets to validate they exist and have user_id
      // Retry logic to handle race conditions where assets might not be committed yet
      // Use exponential backoff with longer delays
      const assetIds = batchBody.assets.map(a => a.assetId);
      let assets: any[] | null = null;
      let assetsError: any = null;
      const maxRetries = 8; // Increased retries
      const baseRetryDelay = 500; // 500ms base delay
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = baseRetryDelay * Math.pow(1.5, attempt - 1); // Exponential: 500ms, 750ms, 1125ms, etc.
          console.log(`[auto_tag_asset] Retry attempt ${attempt + 1}/${maxRetries} to find assets (waiting ${delay.toFixed(0)}ms)...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const result = await supabaseClient
          .from('assets')
          .select('id, user_id')
          .in('id', assetIds);
        
        assetsError = result.error;
        assets = result.data;
        
        // Check if we found all requested assets
        if (!assetsError && assets) {
          const foundAssetIds = new Set(assets.map((a: any) => a.id));
          const missingAssetIds = assetIds.filter(id => !foundAssetIds.has(id));
          
          if (missingAssetIds.length === 0) {
            // Found all assets, exit retry loop
            break;
          } else if (attempt < maxRetries - 1) {
            // Still missing some, will retry
            console.log(`[auto_tag_asset] Missing ${missingAssetIds.length} assets, will retry...`);
          }
        }
      }
      
      if (assetsError) {
        console.error('[auto_tag_asset] Failed to query assets after retries:', assetsError);
        return new Response(JSON.stringify({ error: 'Failed to query assets', details: assetsError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (!assets || assets.length === 0) {
        console.error('[auto_tag_asset] No assets found for IDs after retries:', assetIds);
        return new Response(JSON.stringify({ error: 'Assets not found', assetIds }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Check if all assets have user_id
      const assetsWithoutUserId = assets.filter(a => !a.user_id);
      if (assetsWithoutUserId.length > 0) {
        console.error('[auto_tag_asset] Some assets missing user_id:', assetsWithoutUserId.map(a => a.id));
        return new Response(JSON.stringify({ 
          error: 'Some assets are missing user_id', 
          assetIds: assetsWithoutUserId.map(a => a.id) 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Check if we found all requested assets
      const foundAssetIds = new Set(assets.map(a => a.id));
      const missingAssetIds = assetIds.filter(id => !foundAssetIds.has(id));
      if (missingAssetIds.length > 0) {
        console.warn(`[auto_tag_asset] ⚠️  Some assets not found after retries (${missingAssetIds.length} of ${assetIds.length}):`, missingAssetIds);
        console.warn(`[auto_tag_asset] ⚠️  Will process ${foundAssetIds.size} found assets and return empty tags for missing ones`);
        // Don't fail the entire batch - process what we have and return empty tags for missing assets
        // This handles race conditions during bulk imports where some assets aren't committed yet
      }
      
      // Get user_id from first found asset (all assets should belong to same user)
      // Filter to only process assets that were found
      const foundAssets = assets.filter((a: any) => foundAssetIds.has(a.id));
      if (foundAssets.length === 0) {
        console.error('[auto_tag_asset] No valid assets found after filtering');
        return new Response(JSON.stringify({ error: 'No valid assets found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const userId = foundAssets[0].user_id;
      if (!userId) {
        console.error('[auto_tag_asset] First asset missing user_id');
        return new Response(JSON.stringify({ error: 'Asset missing user_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.log(`[auto_tag_asset] Processing batch of ${batchBody.assets.length} assets (${foundAssets.length} found, ${missingAssetIds.length} missing) for user:`, userId);
      console.log(`[auto_tag_asset] Found asset user_ids:`, foundAssets.map((a: any) => a.user_id));
      
      // Filter batchBody.assets to only include found assets for processing
      // We'll add empty results for missing assets later
      const assetsToProcess = batchBody.assets.filter(a => foundAssetIds.has(a.assetId));
      
      // Get tag vocabulary from config
      const tagVocabulary = await getTagVocabulary(supabaseClient, userId);
      console.log('[auto_tag_asset] Using tag vocabulary (enabled tags only):', tagVocabulary);
      console.log('[auto_tag_asset] Number of enabled tags:', tagVocabulary.length);
      console.log('[auto_tag_asset] Tag vocabulary details:', JSON.stringify(tagVocabulary, null, 2));
      
      // If no tags are enabled, skip auto-tagging
      if (!tagVocabulary || tagVocabulary.length === 0) {
        console.log('[auto_tag_asset] No tags enabled for AI auto-tagging - skipping batch');
        // Return empty tags for all assets (both found and missing)
        const emptyResults = batchBody.assets.map(a => ({ assetId: a.assetId, tags: [] }));
        return new Response(JSON.stringify({ results: emptyResults }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      let tagResults: TagResult[] = [];

      try {
        // Check if we should use Batch API (20+ images)
        // Use original batchBody.assets.length, not assetsToProcess.length, because:
        // - User requested 20+ images, so we should use Batch API
        // - assetsToProcess might be < 20 if some assets aren't committed yet (race condition)
        // - Missing assets will get empty tags anyway
        if (batchBody.assets.length >= BATCH_API_THRESHOLD) {
          console.log(`[auto_tag_asset] 🚀 Using OpenAI Batch API for ${batchBody.assets.length} requested images (${assetsToProcess.length} found, ${missingAssetIds.length} missing, threshold: ${BATCH_API_THRESHOLD})...`);
          console.log(`[auto_tag_asset] 🚀 Batch API provides 50% cost savings and async processing`);
          
          // Only create batch if we have at least some assets to process
          if (assetsToProcess.length === 0) {
            console.warn(`[auto_tag_asset] ⚠️  No assets found to process, but Batch API was requested for ${batchBody.assets.length} images`);
            // Return empty tags for all requested assets
            tagResults = batchBody.assets.map(asset => ({ assetId: asset.assetId, tags: [] }));
            return new Response(JSON.stringify({ results: tagResults }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          try {
            const { batchId, fileId } = await createOpenAIBatch(
              assetsToProcess,
              openAiKey!,
              tagVocabulary,
              supabaseClient,
              userId
            );
            
            console.log(`[auto_tag_asset] ✅ Batch API job created: ${batchId}`);
            console.log(`[auto_tag_asset] ⏳ Batch processing will complete asynchronously (up to 24h)`);
            console.log(`[auto_tag_asset] 📋 Results will be processed when batch completes`);
            
            // Return empty tags for now - results will be processed when batch completes
            // The polling function will update assets with tags when batch finishes
            tagResults = batchBody.assets.map(asset => ({
              assetId: asset.assetId,
              tags: [], // Empty for now, will be filled when batch completes
            }));
            
            // Return success response indicating batch was created
            return new Response(JSON.stringify({ 
              results: tagResults,
              batchId,
              message: 'Batch API job created successfully. Results will be processed asynchronously.',
            }), {
              status: 202, // Accepted (async processing)
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (batchError) {
            console.error(`[auto_tag_asset] ❌ Batch API failed:`, batchError);
            console.error(`[auto_tag_asset] Falling back to regular chat/completions API...`);
            // Fall through to regular processing
          }
        }
        
        // Regular processing for < 20 images or if Batch API failed
        console.log(`[auto_tag_asset] 🎯 CALLING getSuggestedTagsBatch with ${assetsToProcess.length} found assets (${missingAssetIds.length} missing)...`);
        console.log(`[auto_tag_asset] 🎯 OpenAI API key present: ${!!openAiKey}`);
        console.log(`[auto_tag_asset] 🎯 Tag vocabulary length: ${tagVocabulary.length}`);
        // Only process assets that were found in the database
        const processingResults = assetsToProcess.length > 0 
          ? await getSuggestedTagsBatch(assetsToProcess, openAiKey, tagVocabulary, supabaseClient)
          : [];
        
        // Create a map of results by assetId for easy lookup
        const resultsMap = new Map(processingResults.map(r => [r.assetId, r]));
        
        // Verify all processing results have valid assetIds
        const invalidResults = processingResults.filter(r => !r.assetId || !batchBody.assets.find(a => a.assetId === r.assetId));
        if (invalidResults.length > 0) {
          console.error(`[auto_tag_asset] ❌ Found ${invalidResults.length} results with invalid assetIds:`, invalidResults);
        }
        
        // Map results back to original batchBody.assets order
        // This preserves the order expected by the queue
        tagResults = batchBody.assets.map(asset => {
          if (missingAssetIds.includes(asset.assetId)) {
            // Missing asset - return empty tags
            return { assetId: asset.assetId, tags: [] };
          } else {
            // Found asset - get result from map
            const result = resultsMap.get(asset.assetId);
            if (!result) {
              console.warn(`[auto_tag_asset] ⚠️  No result found for asset ${asset.assetId} in resultsMap`);
              console.warn(`[auto_tag_asset] Available assetIds in resultsMap:`, Array.from(resultsMap.keys()));
            }
            return result || { assetId: asset.assetId, tags: [] };
          }
        });
        
        // Verify we have results for all assets
        if (tagResults.length !== batchBody.assets.length) {
          console.error(`[auto_tag_asset] ❌ CRITICAL: Result count mismatch! Expected ${batchBody.assets.length}, got ${tagResults.length}`);
          console.error(`[auto_tag_asset] Batch assetIds:`, batchBody.assets.map(a => a.assetId));
          console.error(`[auto_tag_asset] Result assetIds:`, tagResults.map(r => r.assetId));
        }
        
        console.log(`[auto_tag_asset] ✅ getSuggestedTagsBatch returned ${tagResults.length} results`);
        console.log(`[auto_tag_asset] ✅ Results:`, JSON.stringify(tagResults, null, 2));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRateLimit = (error as any)?.isRateLimit === true;
        const retryAfter = (error as any)?.retryAfter;

        console.error('[auto_tag_asset] ❌❌❌ Batch tagging FAILED ❌❌❌');
        console.error('[auto_tag_asset] Error message:', errorMessage);
        console.error('[auto_tag_asset] Error stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('[auto_tag_asset] Error type:', typeof error);
        console.error('[auto_tag_asset] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        // Handle rate limit errors - return proper response so queue can retry
        if (isRateLimit || errorMessage.includes('rate limit')) {
          console.error('[auto_tag_asset] ⚠️  Batch auto-tagging skipped due to rate limit.');
          return new Response(JSON.stringify({ 
            error: 'OpenAI rate limit exceeded - please try again later',
            code: 'RATE_LIMIT',
            retryAfter: retryAfter ? parseInt(retryAfter, 10) : null,
          }), {
            status: 429,
            headers: { 
              'Content-Type': 'application/json',
              'Retry-After': retryAfter || '60',
            },
          });
        }
        
        // CRITICAL FIX: If we have multiple assets, try individual processing as last resort
        // This ensures partial success even if batch fails
        // Only process assets that were found (skip missing ones)
        if (assetsToProcess && assetsToProcess.length > 1 && !errorMessage.includes('quota exceeded')) {
          console.warn(`[auto_tag_asset] ⚠️  Batch failed, attempting individual processing as last resort...`);
          const individualResults: TagResult[] = [];
          
          // Add empty tags for missing assets first
          const missingResults = (missingAssetIds || []).map((assetId: string) => ({ assetId, tags: [] }));
          individualResults.push(...missingResults);
          
          for (const asset of assetsToProcess) {
            try {
              console.log(`[auto_tag_asset] 🔄 Processing asset ${asset.assetId} individually as fallback...`);
              const singleResult = await getSuggestedTagsBatch(
                [asset],
                openAiKey,
                tagVocabulary,
                supabaseClient
              );
              
              if (singleResult.length > 0 && singleResult[0].tags.length > 0) {
                individualResults.push(singleResult[0]);
                console.log(`[auto_tag_asset] ✅ Individual fallback succeeded for ${asset.assetId}`);
              } else {
                individualResults.push({ assetId: asset.assetId, tags: [] });
                console.warn(`[auto_tag_asset] ⚠️  Individual fallback returned empty tags for ${asset.assetId}`);
              }
            } catch (individualError) {
              console.error(`[auto_tag_asset] ❌ Individual fallback failed for ${asset.assetId}:`, individualError);
              individualResults.push({ assetId: asset.assetId, tags: [] });
            }
          }
          
          const successCount = individualResults.filter(r => r.tags.length > 0).length;
          console.log(`[auto_tag_asset] ✅ Individual fallback complete: ${successCount}/${batchBody.assets.length} succeeded`);
          
          // Map individual results back to original batchBody.assets order
          const individualResultsMap = new Map(individualResults.map(r => [r.assetId, r]));
          tagResults = batchBody.assets.map(asset => {
            const result = individualResultsMap.get(asset.assetId);
            return result || { assetId: asset.assetId, tags: [] };
          });
        } else {
          // For quota errors or single assets, return empty tags for all assets and mark as failed
          if (errorMessage.includes('quota exceeded')) {
            console.error('[auto_tag_asset] ⚠️  Batch auto-tagging skipped due to OpenAI quota limit.');
          } else {
            console.error('[auto_tag_asset] ⚠️  Batch failed and fallback not applicable (single asset or quota error)');
          }
          // Return empty tags for all requested assets (preserving original order)
          tagResults = batchBody.assets.map(a => ({ assetId: a.assetId, tags: [] }));
          // Mark all as failed
          await Promise.allSettled(
            batchBody.assets.map(asset =>
              supabaseClient
                .from('assets')
                .update({ auto_tag_status: 'failed' })
                .eq('id', asset.assetId)
            )
          );
        }
      }

      // Ensure we have results for all requested assets
      if (tagResults.length !== batchBody.assets.length) {
        console.error(`[auto_tag_asset] ❌ CRITICAL: tagResults length (${tagResults.length}) doesn't match batchBody.assets length (${batchBody.assets.length})`);
        console.error(`[auto_tag_asset] Batch assetIds:`, batchBody.assets.map(a => a.assetId));
        console.error(`[auto_tag_asset] Result assetIds:`, tagResults.map(r => r.assetId));
        
        // Fix: ensure we have results for all assets
        const resultAssetIds = new Set(tagResults.map(r => r.assetId));
        const missingResults = batchBody.assets
          .filter(a => !resultAssetIds.has(a.assetId))
          .map(a => ({ assetId: a.assetId, tags: [] }));
        tagResults = [...tagResults, ...missingResults];
        console.log(`[auto_tag_asset] ✅ Fixed: Added ${missingResults.length} missing results`);
      }
      
      // Update all assets with their tags and status
      console.log(`[auto_tag_asset] 📝 Updating ${tagResults.length} assets with tags...`);
      tagResults.forEach((result, idx) => {
        console.log(`[auto_tag_asset] Asset ${idx + 1}/${tagResults.length}: ${result.assetId} -> tags: [${result.tags.join(', ')}]`);
      });
      
      const updatePromises = tagResults.map(result => 
        supabaseClient
          .from('assets')
          .update({ 
            tags: result.tags,
            auto_tag_status: result.tags.length > 0 ? 'completed' : 'failed'
          })
          .eq('id', result.assetId)
      );
      
      const updateResults = await Promise.allSettled(updatePromises);
      
      // Check for update errors
      const updateErrors = updateResults
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.status === 'rejected');
      
      if (updateErrors.length > 0) {
        console.error(`[auto_tag_asset] ⚠️  Failed to update ${updateErrors.length} assets`);
        updateErrors.forEach(({ index }) => {
          console.error(`[auto_tag_asset] Failed to update asset: ${tagResults[index].assetId}`);
          const error = updateResults[index];
          if (error.status === 'rejected') {
            console.error(`[auto_tag_asset] Error details:`, error.reason);
          }
        });
      } else {
        console.log(`[auto_tag_asset] ✅ Successfully updated all ${tagResults.length} assets in database`);
      }
      
      // Verify updates by querying back
      const verifiedAssetIds = tagResults.map(r => r.assetId);
      const { data: verifiedAssets, error: verifyError } = await supabaseClient
        .from('assets')
        .select('id, tags, auto_tag_status')
        .in('id', verifiedAssetIds);
      
      if (verifyError) {
        console.error(`[auto_tag_asset] ⚠️  Failed to verify updates:`, verifyError);
      } else {
        console.log(`[auto_tag_asset] ✅ Verified ${verifiedAssets?.length || 0} assets in database:`);
        verifiedAssets?.forEach((asset: any) => {
          const expectedTags = tagResults.find(r => r.assetId === asset.id)?.tags || [];
          console.log(`[auto_tag_asset]   - ${asset.id}: tags=[${asset.tags?.join(', ') || 'none'}], status=${asset.auto_tag_status}, expected=[${expectedTags.join(', ')}]`);
          if (JSON.stringify(asset.tags || []) !== JSON.stringify(expectedTags)) {
            console.error(`[auto_tag_asset] ⚠️  MISMATCH for asset ${asset.id}! Expected ${JSON.stringify(expectedTags)}, got ${JSON.stringify(asset.tags || [])}`);
          }
        });
      }
      
      console.log(`[auto_tag_asset] ✅ Batch processing complete: ${tagResults.length} assets updated`);

      const functionTime = Date.now() - functionStartTime;
      const a2Count = tagResults.filter((_, idx) => {
        // Check if A2 was used by looking at the image URLs that were processed
        // This is approximate - we log it during processing
        return true; // We'll log this separately
      }).length;
      
      console.log(`[auto_tag_asset] ⏱️  Total function execution time: ${functionTime}ms`);
      console.log(`[auto_tag_asset] 📊 Processed ${tagResults.length} images in ${functionTime}ms (avg: ${(functionTime / tagResults.length).toFixed(0)}ms per image)`);
      
      // Final verification before returning
      const responsePayload = { results: tagResults };
      console.log(`[auto_tag_asset] 📤 Returning response with ${tagResults.length} results`);
      console.log(`[auto_tag_asset] 📤 Response payload:`, JSON.stringify(responsePayload, null, 2));
      console.log(`[auto_tag_asset] 📤 Total tags across all results: ${tagResults.reduce((sum, r) => sum + r.tags.length, 0)}`);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auto_tag_asset/index.ts:1870',message:'Returning batch response',data:{resultsCount:tagResults.length,expectedCount:batchBody.assets.length,results:tagResults.map(r=>({assetId:r.assetId,tagsCount:r.tags.length})),totalTags:tagResults.reduce((sum,r)=>sum+r.tags.length,0)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } else {
      // Handle single request (backward compatibility)
      const singleBody = body as AutoTagRequest;
      if (!singleBody?.assetId || !singleBody?.imageUrl) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !serviceKey) {
        console.error('[auto_tag_asset] Missing Supabase env vars');
        return new Response(JSON.stringify({ error: 'Configuration error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const supabaseClient = createClient(supabaseUrl, serviceKey);
      const openAiKey = Deno.env.get('OPENAI_API_KEY');
      
      // Get the asset to find the user_id
      // Retry logic to handle race conditions where asset might not be committed yet
      // Use exponential backoff with longer delays
      let asset: any = null;
      let assetError: any = null;
      const maxRetries = 8; // Increased retries
      const baseRetryDelay = 500; // 500ms base delay
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = baseRetryDelay * Math.pow(1.5, attempt - 1); // Exponential: 500ms, 750ms, 1125ms, etc.
          console.log(`[auto_tag_asset] Retry attempt ${attempt + 1}/${maxRetries} to find asset ${singleBody.assetId} (waiting ${delay.toFixed(0)}ms)...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const result = await supabaseClient
          .from('assets')
          .select('id, user_id')
          .eq('id', singleBody.assetId)
          .single();
        
        assetError = result.error;
        asset = result.data;
        
        if (!assetError && asset) {
          console.log(`[auto_tag_asset] ✅ Found asset ${singleBody.assetId} on attempt ${attempt + 1}`);
          break; // Found asset, exit retry loop
        } else if (attempt < maxRetries - 1) {
          console.log(`[auto_tag_asset] Asset ${singleBody.assetId} not found, will retry...`);
        }
      }
      
      if (assetError) {
        console.error('[auto_tag_asset] Failed to query asset after retries:', assetError);
        console.error('[auto_tag_asset] Asset ID:', singleBody.assetId);
        console.error('[auto_tag_asset] Error code:', assetError.code);
        console.error('[auto_tag_asset] Error message:', assetError.message);
        return new Response(JSON.stringify({ 
          error: 'Failed to query asset', 
          details: assetError.message,
          assetId: singleBody.assetId 
        }), {
          status: assetError.code === 'PGRST116' ? 404 : 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (!asset) {
        console.error('[auto_tag_asset] Asset not found after retries:', singleBody.assetId);
        return new Response(JSON.stringify({ 
          error: 'Asset not found', 
          assetId: singleBody.assetId 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (!asset.user_id) {
        console.error('[auto_tag_asset] Asset missing user_id:', singleBody.assetId);
        console.error('[auto_tag_asset] Asset data:', asset);
        return new Response(JSON.stringify({ 
          error: 'Asset missing user_id', 
          assetId: singleBody.assetId 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const userId = asset.user_id;
      console.log('[auto_tag_asset] Asset belongs to user:', userId);
      
      // Get tag vocabulary from config - ONLY enabled tags for this user
      const tagVocabulary = await getTagVocabulary(supabaseClient, userId);
      console.log('[auto_tag_asset] Using tag vocabulary (enabled tags only):', tagVocabulary);
      console.log('[auto_tag_asset] Number of enabled tags:', tagVocabulary.length);
      
      // If no tags are enabled, skip auto-tagging
      if (!tagVocabulary || tagVocabulary.length === 0) {
        console.log('[auto_tag_asset] No tags enabled for AI auto-tagging - skipping');
        return new Response(JSON.stringify({ assetId: singleBody.assetId, tags: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      let tags: string[] = [];

      try {
        tags = await getSuggestedTags(singleBody, openAiKey, tagVocabulary, supabaseClient);
        if (!tags || tags.length === 0) {
          console.error('[auto_tag_asset] No tags returned from GPT-4');
          tags = [];
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRateLimit = (error as any)?.isRateLimit === true;
        const retryAfter = (error as any)?.retryAfter;
        
        console.error('[auto_tag_asset] Tagging failed:', errorMessage);
        
        // Handle rate limit errors - return proper response so queue can retry
        if (isRateLimit || errorMessage.includes('rate limit')) {
          console.error('[auto_tag_asset] ⚠️  Photo imported but auto-tagging skipped due to rate limit.');
          return new Response(JSON.stringify({ 
            error: 'OpenAI rate limit exceeded - please try again later',
            code: 'RATE_LIMIT',
            retryAfter: retryAfter ? parseInt(retryAfter, 10) : null,
          }), {
            status: 429,
            headers: { 
              'Content-Type': 'application/json',
              'Retry-After': retryAfter || '60',
            },
          });
        }
        
        // Log specific error types for easier debugging
        if (errorMessage.includes('quota exceeded')) {
          console.error('[auto_tag_asset] ⚠️  Photo imported but auto-tagging skipped due to OpenAI quota limit.');
          console.error('[auto_tag_asset] ⚠️  User can manually tag photos. Fix OpenAI billing to re-enable auto-tagging.');
          tags = [];
          // Mark as failed
          await supabaseClient
            .from('assets')
            .update({ auto_tag_status: 'failed' })
            .eq('id', singleBody.assetId);
        } else if (errorMessage.includes('Invalid OpenAI API key')) {
          console.error('[auto_tag_asset] ⚠️  Photo imported but auto-tagging skipped - invalid API key.');
          tags = [];
          // Mark as failed
          await supabaseClient
            .from('assets')
            .update({ auto_tag_status: 'failed' })
            .eq('id', singleBody.assetId);
        } else {
          tags = [];
          // Mark as failed
          await supabaseClient
            .from('assets')
            .update({ auto_tag_status: 'failed' })
            .eq('id', singleBody.assetId);
        }
      }

      // Location is now stored in separate column, so we just update tags directly
      // No need to preserve location from tags anymore
      // Update with tags and status (empty array if tagging failed - user can tag manually)
      console.log('[auto_tag_asset] Updating asset with tags:', tags);
      console.log('[auto_tag_asset] Asset ID:', singleBody.assetId);
      const { data: updatedAsset, error } = await supabaseClient
        .from('assets')
        .update({ 
          tags: tags,
          auto_tag_status: tags.length > 0 ? 'completed' : 'failed'
        })
        .eq('id', singleBody.assetId)
        .select('id, tags')
        .single();
      
      if (error) {
        console.error('[auto_tag_asset] ❌ Supabase update failed', error);
        console.error('[auto_tag_asset] Error details:', JSON.stringify(error, null, 2));
        throw new Error(`Unable to update asset tags: ${error.message}`);
      }
      
      console.log('[auto_tag_asset] ✅ Asset updated successfully');
      console.log('[auto_tag_asset] Updated asset tags:', updatedAsset?.tags);

      const functionTime = Date.now() - functionStartTime;
      console.log(`[auto_tag_asset] ⏱️  Total function execution time: ${functionTime}ms`);
      
      return new Response(JSON.stringify({ assetId: singleBody.assetId, tags }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  } catch (error) {
    const functionTime = Date.now() - functionStartTime;
    console.error(`[auto_tag_asset] ⏱️  Function failed after ${functionTime}ms`);
    console.error('[auto_tag_asset] Unhandled error', error);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
