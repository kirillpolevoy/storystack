import { supabase } from '@/lib/supabase';
import { Asset } from '@/types';

/**
 * Copy an asset to another workspace
 * Creates a new asset row in the target workspace and copies the storage file
 * Tags are copied by name (created if missing in target workspace)
 * Story memberships are NOT copied
 */
export async function copyAssetToWorkspace(
  assetId: string,
  targetWorkspaceId: string,
  userId: string
): Promise<Asset | null> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  try {
    // 1. Get the source asset
    const { data: sourceAsset, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !sourceAsset) {
      throw new Error('Source asset not found');
    }

    // 2. Generate new storage path for target workspace
    const sourcePath = sourceAsset.storage_path;
    const fileName = sourcePath.split('/').pop() || `asset-${Date.now()}.jpg`;
    const newAssetId = crypto.randomUUID();
    const newStoragePath = `workspaces/${targetWorkspaceId}/assets/${newAssetId}/${fileName}`;

    // 3. Copy storage file (requires server-side function or direct copy)
    // For now, we'll fetch and re-upload
    const { data: sourceUrl } = supabase.storage.from('assets').getPublicUrl(sourcePath);
    const response = await fetch(sourceUrl.publicUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch source asset');
    }
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Upload to new location
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(newStoragePath, arrayBuffer, {
        contentType: blob.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to copy storage file: ${uploadError.message}`);
    }

    // 4. Create new asset row in target workspace
    const newAssetData: any = {
      user_id: userId,
      workspace_id: targetWorkspaceId,
      storage_path: newStoragePath,
      source: sourceAsset.source,
      location: sourceAsset.location,
      date_taken: sourceAsset.date_taken,
      auto_tag_status: null, // Reset auto-tag status for new asset
    };

    // Copy file_hash if present
    if (sourceAsset.file_hash) {
      newAssetData.file_hash = sourceAsset.file_hash;
    }

    const { data: newAsset, error: insertError } = await supabase
      .from('assets')
      .insert(newAssetData)
      .select()
      .single();

    if (insertError || !newAsset) {
      // Clean up uploaded file if insert fails
      await supabase.storage.from('assets').remove([newStoragePath]);
      throw new Error(`Failed to create asset: ${insertError?.message}`);
    }

    // 5. Copy tags by name (create if missing in target workspace)
    // Get tags for source asset
    const { data: sourceTags } = await supabase
      .from('asset_tags')
      .select('tag_id, tags(name)')
      .eq('asset_id', assetId);

    if (sourceTags && sourceTags.length > 0) {
      for (const assetTag of sourceTags) {
        const tagName = (assetTag.tags as any)?.name;
        if (!tagName) continue;

        // Get or create tag in target workspace
        let targetTagId: string | null = null;

        // Check if tag exists in target workspace
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('workspace_id', targetWorkspaceId)
          .eq('name', tagName)
          .single();

        if (existingTag) {
          targetTagId = existingTag.id;
        } else {
          // Create tag in target workspace
          const { data: newTag, error: tagError } = await supabase
            .from('tags')
            .insert({
              workspace_id: targetWorkspaceId,
              name: tagName,
            })
            .select('id')
            .single();

          if (tagError || !newTag) {
            console.warn(`[copyAsset] Failed to create tag ${tagName} in target workspace`);
            continue;
          }
          targetTagId = newTag.id;
        }

        // Link asset to tag
        await supabase.from('asset_tags').insert({
          asset_id: newAsset.id,
          tag_id: targetTagId,
          created_by: userId,
        });
      }
    }

    // 6. Get public URL for new asset
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(newStoragePath);

    return {
      ...newAsset,
      publicUrl: urlData.publicUrl,
    } as Asset;
  } catch (error) {
    console.error('[copyAssetToWorkspace] Error:', error);
    throw error;
  }
}



