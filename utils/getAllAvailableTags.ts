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
  if (!supabase) {
    // No Supabase - return empty (user must create tags)
    return [];
  }

  if (!workspaceId) {
    console.warn('[getAllAvailableTags] workspaceId is required. Returning empty tags.');
    return [];
  }

  try {
    // Load deleted tags from tag_config (workspace-scoped)
    let deletedTags: string[] = [];
    
    try {
      const { data: config, error } = await supabase
        .from('tag_config')
        .select('deleted_tags')
        .eq('workspace_id', workspaceId)
        .single();
      
      if (error && error.code !== 'PGRST204') {
        console.warn('[getAllAvailableTags] Error loading tag_config:', error);
      }
      
      if (config?.deleted_tags && Array.isArray(config.deleted_tags)) {
        deletedTags = config.deleted_tags;
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
      return [];
    }
    
    // Filter out deleted tags and return sorted list
    const availableTags = (tags || [])
      .map((tag) => tag.name)
      .filter((tag) => !deletedTagsSet.has(tag))
      .sort();
    
    return availableTags;
  } catch (error) {
    console.error('[getAllAvailableTags] Error loading tags:', error);
    // Fallback: return empty (user must create tags)
    return [];
  }
}


