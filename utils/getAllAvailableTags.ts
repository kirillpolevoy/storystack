import { supabase } from '@/lib/supabase';
import { TagVocabulary } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DELETED_TAGS_STORAGE_KEY = '@storystack:deleted_tags';
const CUSTOM_TAGS_STORAGE_KEY = '@storystack:custom_tags';

/**
 * Loads all available tags from the tag library.
 * This includes:
 * - Custom tags from tag_config (user-specific)
 * - Tags currently used in assets (user-specific)
 * 
 * Note: No default tags - users only see tags they create or use.
 * 
 * @param userId - User ID from AuthContext (optional, will fetch if not provided)
 * @returns Array of all available tags sorted alphabetically
 */
export async function getAllAvailableTags(userId?: string): Promise<TagVocabulary[]> {
  if (!supabase) {
    // No Supabase - return empty (user must create tags)
    return [];
  }

  // Use provided userId - require it to avoid refresh token errors
  if (!userId) {
    console.warn('[getAllAvailableTags] userId is required. Pass it from AuthContext to avoid refresh token errors. Returning empty tags.');
    return [];
  }
  
  const finalUserId = userId;

  try {
    // Load tag_config in a single query (combines deleted_tags and custom_tags)
    let deletedTags: string[] = [];
    let customTags: string[] = [];
    
    try {
      const { data: config, error } = await supabase
        .from('tag_config')
        .select('deleted_tags, custom_tags')
        .eq('user_id', finalUserId)
        .single();
      
      if (error) {
        // Handle missing column gracefully
        if (error.code === '42703' || error.message?.includes("Could not find the") || error.message?.includes('column')) {
          console.log('[getAllAvailableTags] tag_config columns may not exist yet - skipping');
        } else if (error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'user_id' column")) {
          console.warn('[getAllAvailableTags] Error loading tag_config from Supabase:', error);
        }
      }
      
      if (config) {
        if (config.deleted_tags && Array.isArray(config.deleted_tags)) {
          deletedTags = config.deleted_tags;
        }
        if (config.custom_tags && Array.isArray(config.custom_tags)) {
          customTags = config.custom_tags;
        }
      }
    } catch (error) {
      console.warn('[getAllAvailableTags] Failed to load tag_config from Supabase, using AsyncStorage:', error);
    }
    
    // Fallback to user-specific AsyncStorage if needed
    if (deletedTags.length === 0 && finalUserId) {
      try {
        const userSpecificKey = `${DELETED_TAGS_STORAGE_KEY}:${finalUserId}`;
        const deletedTagsJson = await AsyncStorage.getItem(userSpecificKey);
        deletedTags = deletedTagsJson ? JSON.parse(deletedTagsJson) : [];
      } catch (error) {
        console.warn('[getAllAvailableTags] Failed to load deleted_tags from AsyncStorage:', error);
        deletedTags = [];
      }
    }
    
    if (customTags.length === 0 && finalUserId) {
      try {
        const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${finalUserId}`;
        const customTagsJson = await AsyncStorage.getItem(userSpecificKey);
        customTags = customTagsJson ? JSON.parse(customTagsJson) : [];
      } catch (error) {
        console.warn('[getAllAvailableTags] Failed to load custom_tags from AsyncStorage:', error);
        customTags = [];
      }
    }
    
    const deletedTagsSet = new Set<string>(deletedTags);
    
    // Get all unique tags from assets in the database (user-specific)
    // Optimized: Only select tags column, limit to recent assets for faster query
    const allTagsSet = new Set<string>();
    
    // Query assets with limit for faster initial load - tags will be updated as assets load
    // This prevents blocking initialization when user has many assets
    const { data: assets } = await supabase
      .from('assets')
      .select('tags')
      .eq('user_id', finalUserId)
      .order('created_at', { ascending: false })
      .limit(1000); // Limit to 1000 most recent assets for faster tag extraction
    
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
    
    // Add custom tags (user-created tags that may not be used yet)
    customTags.forEach((tag) => {
      if (!deletedTagsSet.has(tag)) {
        allTagsSet.add(tag);
      }
    });
    
    // No default tags - users only see tags they create or use
    
    return Array.from(allTagsSet).sort();
  } catch (error) {
    console.error('[getAllAvailableTags] Error loading tags:', error);
    // Fallback: return empty (user must create tags)
    return [];
  }
}


