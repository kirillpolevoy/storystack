import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { batchSize = 10, workspaceId } = await req.json().catch(() => ({ batchSize: 10 }))

    console.log(`[regenerate_thumbnails] Starting regeneration for batch size: ${batchSize}`)

    // Get assets that need thumbnail regeneration
    const { data: assets, error: fetchError } = await supabase
      .rpc('get_assets_needing_thumbnail_regeneration', {
        batch_size: batchSize,
        workspace_id_filter: workspaceId || null,
      })

    if (fetchError) {
      console.error('[regenerate_thumbnails] Error fetching assets:', fetchError)
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No assets need thumbnail regeneration', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[regenerate_thumbnails] Found ${assets.length} assets to process`)

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Process each asset
    for (const asset of assets) {
      try {
        console.log(`[regenerate_thumbnails] Processing asset ${asset.id}`)

        // Download the original image (use A2/storage_path, or fallback to preview)
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('assets')
          .download(asset.storage_path)

        if (downloadError || !imageData) {
          console.error(`[regenerate_thumbnails] Failed to download image for ${asset.id}:`, downloadError)
          results.failed++
          results.errors.push(`Asset ${asset.id}: Failed to download image`)
          continue
        }

        // Convert blob to array buffer for processing
        const arrayBuffer = await imageData.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        // Note: Deno doesn't have built-in image processing like Canvas API
        // We'll need to use a different approach - either:
        // 1. Use a WASM image processing library
        // 2. Call an external service
        // 3. Use Sharp via a different method

        // For now, we'll mark this as a placeholder that needs implementation
        // The actual thumbnail regeneration should be done client-side or via a different service
        // This edge function structure is ready, but image processing needs to be added

        console.log(`[regenerate_thumbnails] ⚠️  Image processing not yet implemented for asset ${asset.id}`)
        results.failed++
        results.errors.push(`Asset ${asset.id}: Image processing not implemented`)

      } catch (error) {
        console.error(`[regenerate_thumbnails] Error processing asset ${asset.id}:`, error)
        results.failed++
        results.errors.push(`Asset ${asset.id}: ${error instanceof Error ? error.message : String(error)}`)
      }

      results.processed++
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.processed} assets`,
        succeeded: results.succeeded,
        failed: results.failed,
        errors: results.errors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[regenerate_thumbnails] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

