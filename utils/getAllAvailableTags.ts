import { supabase } from '@/lib/supabase';
import { STORYSTACK_TAGS, TagVocabulary } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DELETED_TAGS_STORAGE_KEY = '@storystack:deleted_tags';
const CUSTOM_TAGS_STORAGE_KEY = '@storystack:custom_tags';

/**
 * Loads all available tags from the tag library.
 * This includes:
 * - StoryStack tags (excluding deleted ones)
 * - Custom tags from tag_config
 * - Tags currently used in assets
 * 
 * @returns Array of all available tags sorted alphabetically
 */
export async function getAllAvailableTags(): Promise<TagVocabulary[]> {
  try {
    // Load deleted tags list (tags that user has explicitly deleted)
    let deletedTags: string[] = [];
    if (supabase) {
      try {
        const { data: config, error } = await supabase
          .from('tag_config')
          .select('deleted_tags')
          .eq('id', 'default')
          .single();
        
        if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'deleted_tags' column")) {
          console.warn('[getAllAvailableTags] Error loading deleted_tags from Supabase:', error);
        }
        
        if (config?.deleted_tags && Array.isArray(config.deleted_tags)) {
          deletedTags = config.deleted_tags;
        }
      } catch (error) {
        console.warn('[getAllAvailableTags] Failed to load deleted_tags from Supabase, using AsyncStorage:', error);
      }
    }
    // Fallback to AsyncStorage
    if (deletedTags.length === 0) {
      try {
        const deletedTagsJson = await AsyncStorage.getItem(DELETED_TAGS_STORAGE_KEY);
        deletedTags = deletedTagsJson ? JSON.parse(deletedTagsJson) : [];
      } catch (error) {
        console.warn('[getAllAvailableTags] Failed to load deleted_tags from AsyncStorage:', error);
        deletedTags = [];
      }
    }
    const deletedTagsSet = new Set<string>(deletedTags);
    
    // Load custom tags (tags that user has created but may not be used yet)
    let customTags: string[] = [];
    if (supabase) {
      try {
        const { data: config, error } = await supabase
          .from('tag_config')
          .select('custom_tags')
          .eq('id', 'default')
          .single();
        
        if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'custom_tags' column")) {
          console.warn('[getAllAvailableTags] Error loading custom_tags from Supabase:', error);
        }
        
        if (config?.custom_tags && Array.isArray(config.custom_tags)) {
          customTags = config.custom_tags;
        }
      } catch (error) {
        console.warn('[getAllAvailableTags] Failed to load custom_tags from Supabase, using AsyncStorage:', error);
      }
    }
    // Fallback to AsyncStorage
    if (customTags.length === 0) {
      try {
        const customTagsJson = await AsyncStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
        customTags = customTagsJson ? JSON.parse(customTagsJson) : [];
      } catch (error) {
        console.warn('[getAllAvailableTags] Failed to load custom_tags from AsyncStorage:', error);
        customTags = [];
      }
    }
    
    // Get all unique tags from assets in the database
    const allTagsSet = new Set<string>();
    
    if (supabase) {
      const { data: assets } = await supabase.from('assets').select('tags');
      
      if (assets) {
        assets.forEach((asset) => {
          const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
          assetTags.forEach((tag: string) => {
            if (tag && !deletedTagsSet.has(tag)) {
              allTagsSet.add(tag);
            }
          });
        });
      }
    }
    
    // Add custom tags (user-created tags that may not be used yet)
    customTags.forEach((tag) => {
      if (!deletedTagsSet.has(tag)) {
        allTagsSet.add(tag);
      }
    });
    
    // Add default StoryStack tags, but exclude deleted ones
    STORYSTACK_TAGS.forEach((tag) => {
      if (!deletedTagsSet.has(tag)) {
        allTagsSet.add(tag);
      }
    });
    
    return Array.from(allTagsSet).sort();
  } catch (error) {
    console.error('[getAllAvailableTags] Error loading tags:', error);
    // Fallback to just StoryStack tags (excluding deleted ones)
    try {
      let deletedTags: string[] = [];
      const deletedTagsJson = await AsyncStorage.getItem(DELETED_TAGS_STORAGE_KEY);
      deletedTags = deletedTagsJson ? JSON.parse(deletedTagsJson) : [];
      const deletedTagsSet = new Set<string>(deletedTags);
      
      return STORYSTACK_TAGS.filter((tag) => !deletedTagsSet.has(tag)).sort();
    } catch (fallbackError) {
      console.error('[getAllAvailableTags] Fallback also failed:', fallbackError);
      // Last resort: return all StoryStack tags
      return Array.from(STORYSTACK_TAGS).sort();
    }
  }
}


