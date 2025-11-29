import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.2';

type AutoTagRequest = {
  assetId: string;
  imageUrl: string;
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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
    console.log('[auto_tag_asset] Fetching tag_config from database for user:', userId);
    const { data: config, error } = await supabaseClient
      .from('tag_config')
      .select('auto_tags')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('[auto_tag_asset] ❌ Failed to load tag config:', error);
      console.error('[auto_tag_asset] Error code:', error.code);
      console.error('[auto_tag_asset] Error message:', error.message);
      // If config doesn't exist, return empty array (no auto-tagging)
      return [];
    }
    
    console.log('[auto_tag_asset] Config retrieved:', config);
    
    if (config?.auto_tags && Array.isArray(config.auto_tags)) {
      // Only return enabled tags, even if empty (user disabled all tags)
      console.log('[auto_tag_asset] ✅ Loaded auto_tags from config:', config.auto_tags);
      console.log('[auto_tag_asset] Number of enabled tags:', config.auto_tags.length);
      if (config.auto_tags.length === 0) {
        console.log('[auto_tag_asset] ⚠️  No tags enabled - auto-tagging will be skipped');
      }
      return config.auto_tags;
    }
    
    // Config exists but auto_tags is null/undefined/empty - user has disabled all tags
    console.log('[auto_tag_asset] ⚠️  No auto_tags configured (null/undefined/empty) - auto-tagging disabled');
    return [];
  } catch (error) {
    console.error('[auto_tag_asset] ❌ Exception loading tag config:', error);
    // Return empty array instead of defaults - don't auto-tag if config can't be loaded
    return [];
  }
}

// Helper function to convert image to base64
async function convertToBase64(imageUrl: string): Promise<string> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBytes = new Uint8Array(imageBuffer);
  
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...imageBytes));
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  const base64SizeMB = dataUrl.length / (1024 * 1024);
  console.log('[auto_tag_asset] ✅ Converted to base64 data URL (size:', base64SizeMB.toFixed(2), 'MB)');
  
  if (base64SizeMB > 20) {
    console.error('[auto_tag_asset] ❌ Base64 image exceeds 20MB limit:', base64SizeMB.toFixed(2), 'MB');
    throw new Error(`Image too large even after maximum compression: ${base64SizeMB.toFixed(2)}MB`);
  }
  
  return dataUrl;
}

// Check if image format is supported by OpenAI and convert if needed
// Since images are now compressed at upload time (<5MB), we can use them directly
// or convert to base64 if URL access fails
async function ensureSupportedImageFormat(imageUrl: string): Promise<string> {
  try {
    console.log('[auto_tag_asset] Checking image format for URL:', imageUrl);
    
    // Extract file extension from URL
    const urlPath = new URL(imageUrl).pathname;
    const extension = urlPath.split('.').pop()?.toLowerCase() || '';
    console.log('[auto_tag_asset] File extension from URL:', extension);
    
    // For Supabase Storage URLs, images are already compressed at upload (<5MB)
    // Try using the original URL first, convert to base64 if it fails or times out
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (supabaseUrl && imageUrl.includes(supabaseUrl)) {
      // Remove any existing transform params - use original compressed image
      const baseUrl = new URL(imageUrl);
      baseUrl.search = ''; // Remove query params to use original compressed image
      const originalUrl = baseUrl.toString();
      
      console.log('[auto_tag_asset] Using original compressed image (no transforms needed)');
      
      // Check if it's JPEG format
      try {
        const headResponse = await fetch(originalUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        const contentType = headResponse.headers.get('content-type');
        const contentLength = headResponse.headers.get('content-length');
        const fileSizeMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : null;
        
        console.log(`[auto_tag_asset] Original image - Content-Type: ${contentType}, Size: ${fileSizeMB ? fileSizeMB.toFixed(2) + ' MB' : 'unknown'}`);
        
        // If it's JPEG and under 5MB, use it directly
        if (contentType && (contentType.includes('jpeg') || contentType.includes('jpg'))) {
          if (fileSizeMB === null || fileSizeMB <= 5) {
            console.log('[auto_tag_asset] ✅ Using original compressed image URL');
            return originalUrl;
          } else {
            console.warn(`[auto_tag_asset] ⚠️  Image is ${fileSizeMB.toFixed(2)} MB, converting to base64 to avoid timeout`);
            return await convertToBase64(originalUrl);
          }
        } else {
          // Not JPEG, convert to base64
          console.warn('[auto_tag_asset] Content-Type is not JPEG, converting to base64');
          return await convertToBase64(originalUrl);
        }
      } catch (headError) {
        // HEAD request failed or timed out - convert to base64 to avoid OpenAI timeout
        console.warn('[auto_tag_asset] HEAD request failed/timed out, converting to base64 to avoid OpenAI timeout:', headError);
        return await convertToBase64(originalUrl);
      }
    }
    
    // If transform not available, throw error with helpful message
    throw new Error(`Unsupported image format: ${extension}. OpenAI only supports PNG, JPEG, GIF, and WEBP.`);
    
  } catch (error) {
    console.error('[auto_tag_asset] Error checking/converting image format:', error);
    throw error;
  }
}

async function getSuggestedTags({ imageUrl }: AutoTagRequest, apiKey?: string, tagVocabulary: string[] = []): Promise<string[]> {
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
  
  // Ensure image format is supported
  const supportedImageUrl = await ensureSupportedImageFormat(imageUrl);

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
    console.log('[auto_tag_asset] Making OpenAI API request...');
    console.log('[auto_tag_asset] Image URL:', imageUrl);
    console.log('[auto_tag_asset] API Key present:', !!apiKey);
    console.log('[auto_tag_asset] API Key length:', apiKey?.length || 0);
    
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
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as AutoTagRequest;
    if (!body?.assetId || !body?.imageUrl) {
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
    const { data: asset, error: assetError } = await supabaseClient
      .from('assets')
      .select('user_id')
      .eq('id', body.assetId)
      .single();
    
    if (assetError || !asset?.user_id) {
      console.error('[auto_tag_asset] Failed to get asset or user_id:', assetError);
      return new Response(JSON.stringify({ error: 'Asset not found or missing user_id' }), {
        status: 404,
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
      return new Response(JSON.stringify({ assetId: body.assetId, tags: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    let tags: string[] = [];

    try {
      tags = await getSuggestedTags(body, openAiKey, tagVocabulary);
      if (!tags || tags.length === 0) {
        console.error('[auto_tag_asset] No tags returned from GPT-4');
        // Return empty tags array - don't default to anything
        tags = [];
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[auto_tag_asset] Tagging failed:', errorMessage);
      
      // Log specific error types for easier debugging
      if (errorMessage.includes('quota exceeded')) {
        console.error('[auto_tag_asset] ⚠️  Photo imported but auto-tagging skipped due to OpenAI quota limit.');
        console.error('[auto_tag_asset] ⚠️  User can manually tag photos. Fix OpenAI billing to re-enable auto-tagging.');
      } else if (errorMessage.includes('rate limit')) {
        console.error('[auto_tag_asset] ⚠️  Photo imported but auto-tagging skipped due to rate limit.');
      } else if (errorMessage.includes('Invalid OpenAI API key')) {
        console.error('[auto_tag_asset] ⚠️  Photo imported but auto-tagging skipped - invalid API key.');
      }
      
      // Return empty tags array instead of defaulting to "Product"
      // This way the photo is imported but not auto-tagged
      tags = [];
    }

    // Update with tags (empty array if tagging failed - user can tag manually)
    console.log('[auto_tag_asset] Updating asset with tags:', tags);
    console.log('[auto_tag_asset] Asset ID:', body.assetId);
    const { data: updatedAsset, error } = await supabaseClient
      .from('assets')
      .update({ tags })
      .eq('id', body.assetId)
      .select('id, tags')
      .single();
    
    if (error) {
      console.error('[auto_tag_asset] ❌ Supabase update failed', error);
      console.error('[auto_tag_asset] Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Unable to update asset tags: ${error.message}`);
    }
    
    console.log('[auto_tag_asset] ✅ Asset updated successfully');
    console.log('[auto_tag_asset] Updated asset tags:', updatedAsset?.tags);

    return new Response(JSON.stringify({ assetId: body.assetId, tags }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[auto_tag_asset] Unhandled error', error);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
