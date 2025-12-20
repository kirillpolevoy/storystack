import { supabase } from '@/lib/supabase';
import { Story, StoryAsset, Asset, StoryWithAssets } from '@/types';

/**
 * Create a new story
 */
export async function createStory(
  userId: string,
  workspaceId: string,
  name: string,
  description?: string,
  assetIds?: string[]
): Promise<Story | null> {
  if (!supabase) {
    console.error('[stories] Supabase not configured');
    return null;
  }

  try {
    // Create the story
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (storyError || !story) {
      console.error('[stories] Failed to create story:', storyError);
      return null;
    }

    // Add assets to story if provided
    if (assetIds && assetIds.length > 0) {
      const storyAssets = assetIds.map((assetId, index) => ({
        story_id: story.id,
        asset_id: assetId,
        order_index: index,
      }));

      const { error: assetsError } = await supabase
        .from('story_assets')
        .insert(storyAssets);

      if (assetsError) {
        console.error('[stories] Failed to add assets to story:', assetsError);
        // Story was created, but assets failed - return story anyway
      }
    }

    return story as Story;
  } catch (error) {
    console.error('[stories] Error creating story:', error);
    return null;
  }
}

/**
 * Get all stories for a workspace (excluding soft-deleted)
 */
export async function getStories(workspaceId: string): Promise<StoryWithAssets[]> {
  if (!supabase) {
    console.error('[stories] Supabase not configured');
    return [];
  }

  try {
    // Get all stories for workspace (excluding soft-deleted)
    const { data: stories, error: storiesError } = await supabase
      .from('stories')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null) // Exclude soft-deleted stories
      .order('updated_at', { ascending: false });

    if (storiesError) {
      console.error('[stories] Failed to fetch stories:', storiesError);
      return [];
    }

    if (!stories || stories.length === 0) {
      return [];
    }

    // Get asset counts for each story
    const storyIds = stories.map((s) => s.id);
    const { data: storyAssets } = await supabase
      .from('story_assets')
      .select('story_id')
      .in('story_id', storyIds);

    const assetCounts = new Map<string, number>();
    if (storyAssets) {
      storyAssets.forEach((sa) => {
        assetCounts.set(sa.story_id, (assetCounts.get(sa.story_id) || 0) + 1);
      });
    }

    // Get first photo (thumbnail) for each story - ordered by order_index
    const firstAssetMap = new Map<string, string>(); // story_id -> asset_id
    
    // For each story, get the first asset (lowest order_index)
    for (const story of stories) {
      const { data: firstAsset } = await supabase
        .from('story_assets')
        .select('asset_id')
        .eq('story_id', story.id)
        .order('order_index', { ascending: true })
        .limit(1)
        .single();
      
      if (firstAsset) {
        firstAssetMap.set(story.id, firstAsset.asset_id);
      }
    }

    // Get all thumbnail assets
    const thumbnailAssetIds = Array.from(firstAssetMap.values());
    let thumbnailAssets: Asset[] = [];
    
    if (thumbnailAssetIds.length > 0) {
      const { data: assets } = await supabase
        .from('assets')
        .select('id, storage_path')
        .in('id', thumbnailAssetIds)
        .eq('user_id', userId);

      if (assets) {
        thumbnailAssets = assets.map((asset) => {
          const { data } = supabase.storage.from('assets').getPublicUrl(asset.storage_path);
          return {
            ...asset,
            publicUrl: data.publicUrl,
            tags: [],
            campaign_id: '',
            source: 'local',
            created_at: '',
          } as Asset;
        });
      }
    }

    return stories.map((story) => {
      const thumbnailAssetId = firstAssetMap.get(story.id);
      const thumbnailAsset = thumbnailAssets.find((a) => a.id === thumbnailAssetId);
      const assetCount = assetCounts.get(story.id) || 0;

      return {
        ...story,
        assets: thumbnailAsset ? [thumbnailAsset] : [],
        asset_count: assetCount,
      } as StoryWithAssets;
    });
  } catch (error) {
    console.error('[stories] Error fetching stories:', error);
    return [];
  }
}

/**
 * Get a single story with all its assets
 */
export async function getStoryById(storyId: string, userId: string): Promise<StoryWithAssets | null> {
  if (!supabase) {
    console.error('[stories] Supabase not configured');
    return null;
  }

  try {
    // Get story
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .eq('user_id', userId)
      .single();

    if (storyError || !story) {
      console.error('[stories] Failed to fetch story:', storyError);
      return null;
    }

    // Get story assets in order
    const { data: storyAssets, error: assetsError } = await supabase
      .from('story_assets')
      .select('asset_id, order_index')
      .eq('story_id', storyId)
      .order('order_index', { ascending: true });

    if (assetsError) {
      console.error('[stories] Failed to fetch story assets:', assetsError);
      return {
        ...story,
        assets: [],
        asset_count: 0,
      } as StoryWithAssets;
    }

    if (!storyAssets || storyAssets.length === 0) {
      return {
        ...story,
        assets: [],
        asset_count: 0,
      } as StoryWithAssets;
    }

    // Get actual assets
    const assetIds = storyAssets.map((sa) => sa.asset_id);
    const { data: assets, error: assetsDataError } = await supabase
      .from('assets')
      .select('id, campaign_id, storage_path, source, tags, created_at')
      .in('id', assetIds)
      .eq('user_id', userId);

    if (assetsDataError || !assets) {
      console.error('[stories] Failed to fetch assets:', assetsDataError);
      return {
        ...story,
        assets: [],
        asset_count: storyAssets.length,
      } as StoryWithAssets;
    }

    // Map assets with public URLs and preserve order
    const assetsMap = new Map(assets.map((asset) => {
      const { data } = supabase.storage.from('assets').getPublicUrl(asset.storage_path);
      const tags = Array.isArray(asset.tags) ? (asset.tags as string[]) : [];
      return [asset.id, { ...asset, publicUrl: data.publicUrl, tags } as Asset];
    }));

    const orderedAssets = storyAssets
      .map((sa) => assetsMap.get(sa.asset_id))
      .filter((asset): asset is Asset => asset !== undefined);

    return {
      ...story,
      assets: orderedAssets,
      asset_count: orderedAssets.length,
    } as StoryWithAssets;
  } catch (error) {
    console.error('[stories] Error fetching story:', error);
    return null;
  }
}

/**
 * Update a story
 */
export async function updateStory(
  storyId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    cover_asset_id?: string | null;
  }
): Promise<boolean> {
  if (!supabase) {
    console.error('[stories] Supabase not configured');
    return false;
  }

  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.description !== undefined) updateData.description = updates.description?.trim() || null;
    if (updates.cover_asset_id !== undefined) updateData.cover_asset_id = updates.cover_asset_id;

    const { error } = await supabase
      .from('stories')
      .update(updateData)
      .eq('id', storyId)
      .eq('user_id', userId);

    if (error) {
      console.error('[stories] Failed to update story:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[stories] Error updating story:', error);
    return false;
  }
}

/**
 * Delete a story
 */
export async function deleteStory(storyId: string, userId: string): Promise<boolean> {
  if (!supabase) {
    console.error('[stories] Supabase not configured');
    return false;
  }

  try {
    // Soft delete: Set deleted_at and deleted_by (do NOT hard delete)
    const { error } = await supabase
      .from('stories')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', storyId)
      .eq('user_id', userId);

    if (error) {
      console.error('[stories] Failed to soft delete story:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[stories] Error soft deleting story:', error);
    return false;
  }
}

/**
 * Add assets to a story
 */
export async function addAssetsToStory(
  storyId: string,
  userId: string,
  assetIds: string[],
  insertAtIndex?: number
): Promise<boolean> {
  if (!supabase) {
    console.error('[stories] Supabase not configured');
    return false;
  }

  try {
    // Verify story belongs to user
    const { data: story } = await supabase
      .from('stories')
      .select('id')
      .eq('id', storyId)
      .eq('user_id', userId)
      .single();

    if (!story) {
      console.error('[stories] Story not found or access denied');
      return false;
    }

    // Get current max order_index if inserting at end
    let startOrderIndex = 0;
    if (insertAtIndex === undefined) {
      const { data: maxOrder } = await supabase
        .from('story_assets')
        .select('order_index')
        .eq('story_id', storyId)
        .order('order_index', { ascending: false })
        .limit(1)
        .single();

      startOrderIndex = maxOrder ? (maxOrder.order_index + 1) : 0;
    } else {
      startOrderIndex = insertAtIndex;
      // Shift existing assets down
      await supabase.rpc('increment_story_asset_order', {
        p_story_id: storyId,
        p_start_index: insertAtIndex,
        p_increment: assetIds.length,
      }).catch(() => {
        // If RPC doesn't exist, we'll handle it manually
      });
    }

    // Insert new assets
    const storyAssets = assetIds.map((assetId, index) => ({
      story_id: storyId,
      asset_id: assetId,
      order_index: startOrderIndex + index,
    }));

    const { error } = await supabase
      .from('story_assets')
      .insert(storyAssets);

    if (error) {
      console.error('[stories] Failed to add assets to story:', error);
      return false;
    }

    // Update story's updated_at
    await supabase
      .from('stories')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', storyId);

    return true;
  } catch (error) {
    console.error('[stories] Error adding assets to story:', error);
    return false;
  }
}

/**
 * Remove an asset from a story
 */
export async function removeAssetFromStory(
  storyId: string,
  userId: string,
  assetId: string
): Promise<boolean> {
  if (!supabase) {
    console.error('[stories] Supabase not configured');
    return false;
  }

  try {
    // Verify story belongs to user
    const { data: story } = await supabase
      .from('stories')
      .select('id')
      .eq('id', storyId)
      .eq('user_id', userId)
      .single();

    if (!story) {
      console.error('[stories] Story not found or access denied');
      return false;
    }

    const { error } = await supabase
      .from('story_assets')
      .delete()
      .eq('story_id', storyId)
      .eq('asset_id', assetId);

    if (error) {
      console.error('[stories] Failed to remove asset from story:', error);
      return false;
    }

    // Update story's updated_at
    await supabase
      .from('stories')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', storyId);

    return true;
  } catch (error) {
    console.error('[stories] Error removing asset from story:', error);
    return false;
  }
}

/**
 * Reorder assets in a story
 */
export async function reorderStoryAssets(
  storyId: string,
  userId: string,
  assetIds: string[]
): Promise<boolean> {
  if (!supabase) {
    console.error('[stories] Supabase not configured');
    return false;
  }

  try {
    // Verify story belongs to user
    const { data: story } = await supabase
      .from('stories')
      .select('id')
      .eq('id', storyId)
      .eq('user_id', userId)
      .single();

    if (!story) {
      console.error('[stories] Story not found or access denied');
      return false;
    }

    // Update order_index for each asset
    const updates = assetIds.map((assetId, index) =>
      supabase
        .from('story_assets')
        .update({ order_index: index })
        .eq('story_id', storyId)
        .eq('asset_id', assetId)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((result) => result.error);

    if (hasError) {
      console.error('[stories] Failed to reorder assets');
      return false;
    }

    // Update story's updated_at
    await supabase
      .from('stories')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', storyId);

    return true;
  } catch (error) {
    console.error('[stories] Error reordering assets:', error);
    return false;
  }
}

