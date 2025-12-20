import { supabase } from '@/lib/supabase';
import { Asset } from '@/types';

/**
 * Move an asset to another workspace
 * Only allowed if asset is NOT referenced by any stories in source workspace
 * Moves storage file and updates workspace_id
 * Tags are re-mapped (created if missing in target workspace)
 */
export async function moveAssetToWorkspace(
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
      .select('workspace_id')
      .eq('id', assetId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !sourceAsset) {
      throw new Error('Source asset not found');
    }

    const sourceWorkspaceId = sourceAsset.workspace_id;
    if (sourceWorkspaceId === targetWorkspaceId) {
      throw new Error('Asset is already in the target workspace');
    }

    // 2. Check if asset is referenced by any stories in source workspace
    const { data: storyReferences, error: storyError } = await supabase
      .from('story_assets')
      .select('story_id, stories!inner(workspace_id)')
      .eq('asset_id', assetId);

    if (storyError) {
      throw new Error(`Failed to check story references: ${storyError.message}`);
    }

    const storiesInSourceWorkspace = (storyReferences || []).filter(
      (ref: any) => ref.stories?.workspace_id === sourceWorkspaceId
    );

    if (storiesInSourceWorkspace.length > 0) {
      throw new Error(
        `Cannot move asset: it is used in ${storiesInSourceWorkspace.length} story/stories. Remove it from stories first or use Copy instead.`
      );
    }

    // 3. Get full asset data
    const { data: fullAsset, error: fullFetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (fullFetchError || !fullAsset) {
      throw new Error('Failed to fetch asset data');
    }

    // 4. Generate new storage path for target workspace
    const sourcePath = fullAsset.storage_path;
    const fileName = sourcePath.split('/').pop() || `asset-${Date.now()}.jpg`;
    const newStoragePath = `workspaces/${targetWorkspaceId}/assets/${assetId}/${fileName}`;

    // 5. Move storage file (copy then delete)
    const { data: sourceUrl } = supabase.storage.from('assets').getPublicUrl(sourcePath);
    const response = await fetch(sourceUrl.publicUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch source asset');
    }
    const blob = await response.arrayBuffer();

    // Upload to new location
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(newStoragePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to move storage file: ${uploadError.message}`);
    }

    // Delete old storage file
    const { error: deleteError } = await supabase.storage.from('assets').remove([sourcePath]);
    if (deleteError) {
      console.warn('[moveAsset] Failed to delete old storage file:', deleteError);
      // Continue even if delete fails - file is copied
    }

    // 6. Update asset workspace_id and storage_path
    const { data: updatedAsset, error: updateError } = await supabase
      .from('assets')
      .update({
        workspace_id: targetWorkspaceId,
        storage_path: newStoragePath,
      })
      .eq('id', assetId)
      .select()
      .single();

    if (updateError || !updatedAsset) {
      // Try to clean up new file if update fails
      await supabase.storage.from('assets').remove([newStoragePath]);
      throw new Error(`Failed to update asset: ${updateError?.message}`);
    }

    // 7. Re-map tags (remove old tags, create/add tags in target workspace)
    // Get current tags
    const { data: currentTags } = await supabase
      .from('asset_tags')
      .select('tag_id, tags(name)')
      .eq('asset_id', assetId);

    // Remove all current tag associations
    if (currentTags && currentTags.length > 0) {
      await supabase.from('asset_tags').delete().eq('asset_id', assetId);
    }

    // Re-create tags in target workspace
    if (currentTags && currentTags.length > 0) {
      for (const assetTag of currentTags) {
        const tagName = (assetTag.tags as any)?.name;
        if (!tagName) continue;

        // Get or create tag in target workspace
        let targetTagId: string | null = null;

        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('workspace_id', targetWorkspaceId)
          .eq('name', tagName)
          .single();

        if (existingTag) {
          targetTagId = existingTag.id;
        } else {
          const { data: newTag, error: tagError } = await supabase
            .from('tags')
            .insert({
              workspace_id: targetWorkspaceId,
              name: tagName,
            })
            .select('id')
            .single();

          if (tagError || !newTag) {
            console.warn(`[moveAsset] Failed to create tag ${tagName} in target workspace`);
            continue;
          }
          targetTagId = newTag.id;
        }

        // Link asset to tag
        await supabase.from('asset_tags').insert({
          asset_id: assetId,
          tag_id: targetTagId,
          created_by: userId,
        });
      }
    }

    // 8. Remove asset from any stories in source workspace (shouldn't happen due to check, but safety)
    await supabase
      .from('story_assets')
      .delete()
      .eq('asset_id', assetId)
      .in('story_id', (storyReferences || []).map((ref: any) => ref.story_id));

    // 9. Get public URL for updated asset
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(newStoragePath);

    return {
      ...updatedAsset,
      publicUrl: urlData.publicUrl,
    } as Asset;
  } catch (error) {
    console.error('[moveAssetToWorkspace] Error:', error);
    throw error;
  }
}



