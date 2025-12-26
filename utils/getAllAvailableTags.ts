import { supabase } from '@/lib/supabase';
import { TagVocabulary } from '@/types';

/**
 * Loads all available tags from the tag library (workspace-scoped).
 * This includes:
 * - Tags from the normalized tags table (workspace-scoped)
 * - Custom tags from tag_config (workspace-scoped)
 * 
 * Note: Tags are now workspace-scoped, not user-scoped.
 * 
 * @param workspaceId - Workspace ID (required)
 * @returns Array of all available tags sorted alphabetically
 */
export async function getAllAvailableTags(workspaceId: string): Promise<TagVocabulary[]> {
  console.log('[getAllAvailableTags] 🔍 Starting query for workspace:', workspaceId);
  
  if (!supabase) {
    console.warn('[getAllAvailableTags] No Supabase client - returning empty tags');
    return [];
  }

  if (!workspaceId) {
    console.warn('[getAllAvailableTags] workspaceId is required. Returning empty tags.');
    return [];
  }

  try {
    // Load deleted tags and custom_tags from tag_config (workspace-scoped)
    let deletedTags: string[] = [];
    let customTags: string[] = [];
    
    // Query deleted_tags and custom_tags separately for better error handling
    try {
      // First, try to load deleted_tags (this column definitely exists)
      const { data: deletedConfig, error: deletedError } = await supabase
        .from('tag_config')
        .select('deleted_tags')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      
      if (!deletedError && deletedConfig && (deletedConfig as any).deleted_tags && Array.isArray((deletedConfig as any).deleted_tags)) {
        deletedTags = (deletedConfig as any).deleted_tags;
      }
      
      // Then, try to load custom_tags separately (may not exist)
      const { data: customConfig, error: customError } = await supabase
        .from('tag_config')
        .select('custom_tags')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      
      if (customError) {
        // Check if error is about missing custom_tags column
        if (customError.code === '42703' || customError.message?.includes('custom_tags') || customError.message?.includes('column')) {
          console.log('[getAllAvailableTags] custom_tags column does not exist (error code:', customError.code, ')');
        } else if (customError.code !== 'PGRST116') {
          console.warn('[getAllAvailableTags] Error loading custom_tags:', customError.code, customError.message);
        }
      } else if (customConfig) {
        // Config exists - check for custom_tags
        const configAny = customConfig as any;
        if (configAny.custom_tags && Array.isArray(configAny.custom_tags)) {
          customTags = configAny.custom_tags;
          console.log('[getAllAvailableTags] ✅ Loaded custom_tags from database:', customTags.length, 'tags:', customTags);
        } else {
          console.log('[getAllAvailableTags] custom_tags is null/undefined/not an array');
        }
      } else {
        console.log('[getAllAvailableTags] No tag_config row found for workspace (this is OK for new workspaces)');
      }
    } catch (error) {
      console.warn('[getAllAvailableTags] Failed to load tag_config:', error);
    }
    
    const deletedTagsSet = new Set<string>(deletedTags);
    
    // Get all tags from the normalized tags table (workspace-scoped)
    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select('name')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true });
    
    if (tagsError) {
      console.error('[getAllAvailableTags] Error loading tags:', tagsError);
    }
    
    // Get all tags from assets in the workspace (tags currently used)
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('tags')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);
    
    if (assetsError) {
      console.error('[getAllAvailableTags] Error loading assets:', assetsError);
    }
    
    // Extract all unique tags from assets
    const assetTagsSet = new Set<string>();
    assets?.forEach((asset) => {
      if (Array.isArray(asset.tags)) {
        asset.tags.forEach((tag: string) => {
          if (tag && tag.trim()) {
            assetTagsSet.add(tag.trim());
          }
        });
      }
    });
    
    // Extract tags from normalized tags table
    const normalizedTagsSet = new Set<string>();
    tags?.forEach((tag) => {
      if (tag.name && tag.name.trim()) {
        normalizedTagsSet.add(tag.name.trim());
      }
    });
    
    // Combine ALL sources: normalized tags table, tags from assets, and custom_tags
    // This ensures we include:
    // 1. Tags from normalized tags table (all tags in the workspace)
    // 2. Tags currently used in assets (may not be in normalized table yet)
    // 3. Custom tags (user-created tags that may not be used yet)
    const allTagsSet = new Set([
      ...normalizedTagsSet,  // Tags from normalized tags table
      ...assetTagsSet,       // Tags currently used in assets
      ...customTags,         // User-created tags (may not be used yet)
    ]);
    
    console.log('[getAllAvailableTags] Combined tags:', {
      normalizedTags: normalizedTagsSet.size,
      assetTags: assetTagsSet.size,
      customTags: customTags.length,
      total: allTagsSet.size
    });
    
    // Filter out deleted tags and return sorted list
    const availableTags = Array.from(allTagsSet)
      .filter((tag) => !deletedTagsSet.has(tag))
      .sort();
    
    console.log('[getAllAvailableTags] Final available tags:', availableTags.length, 'tags');
    
    return availableTags;
  } catch (error) {
    console.error('[getAllAvailableTags] Error loading tags:', error);
    // Fallback: return empty (user must create tags)
    return [];
  }
}


