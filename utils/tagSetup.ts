import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TAG_SETUP_COMPLETED_KEY = '@storystack:tag_setup_completed';
const CUSTOM_TAGS_STORAGE_KEY = '@storystack:custom_tags';

/**
 * Get the tag setup key for a specific user
 */
function getTagSetupKey(userId: string | null): string {
  if (userId) {
    return `${TAG_SETUP_COMPLETED_KEY}:${userId}`;
  }
  return TAG_SETUP_COMPLETED_KEY;
}

/**
 * Check if the user has set up at least one tag
 */
export async function hasTagsSetUp(userId?: string | null): Promise<boolean> {
  try {
    // Try to get userId from session if not provided
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;
      } catch (error) {
        console.error('[TagSetup] Error getting user:', error);
        return false;
      }
    }

    if (!currentUserId) {
      return false;
    }

    // Check Supabase first - look for custom_tags in tag_config
    if (supabase) {
      try {
        const { data: config, error } = await supabase
          .from('tag_config')
          .select('custom_tags')
          .eq('user_id', currentUserId)
          .single();

        if (!error && config?.custom_tags && Array.isArray(config.custom_tags) && config.custom_tags.length > 0) {
          return true;
        }

        // Also check if user has any assets with tags
        const { data: assets } = await supabase
          .from('assets')
          .select('tags')
          .eq('user_id', currentUserId)
          .limit(1);

        if (assets && assets.length > 0) {
          const hasTags = assets.some((asset) => {
            const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
            return assetTags.length > 0;
          });
          if (hasTags) {
            return true;
          }
        }
      } catch (error) {
        console.warn('[TagSetup] Error checking Supabase for tags:', error);
      }
    }

    // Fallback to AsyncStorage
    try {
      const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${currentUserId}`;
      const customTagsJson = await AsyncStorage.getItem(userSpecificKey);
      const customTags = customTagsJson ? JSON.parse(customTagsJson) : [];
      if (Array.isArray(customTags) && customTags.length > 0) {
        return true;
      }
    } catch (error) {
      console.warn('[TagSetup] Error checking AsyncStorage for tags:', error);
    }

    return false;
  } catch (error) {
    console.error('[TagSetup] Error checking if tags are set up:', error);
    return false;
  }
}

/**
 * Mark tag setup as completed (when user creates their first tag)
 */
export async function markTagSetupCompleted(userId?: string | null): Promise<void> {
  try {
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;
      } catch (error) {
        console.error('[TagSetup] Error getting user:', error);
        return;
      }
    }

    if (!currentUserId) {
      return;
    }

    const key = getTagSetupKey(currentUserId);
    await AsyncStorage.setItem(key, 'true');
    console.log('[TagSetup] Marked tag setup as completed for user:', currentUserId);
  } catch (error) {
    console.error('[TagSetup] Error marking tag setup as completed:', error);
  }
}

/**
 * Check if tag setup has been explicitly marked as completed
 */
export async function isTagSetupCompleted(userId?: string | null): Promise<boolean> {
  try {
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;
      } catch (error) {
        console.error('[TagSetup] Error getting user:', error);
        return false;
      }
    }

    if (!currentUserId) {
      return false;
    }

    const key = getTagSetupKey(currentUserId);
    const value = await AsyncStorage.getItem(key);
    return value === 'true';
  } catch (error) {
    console.error('[TagSetup] Error checking tag setup completion:', error);
    return false;
  }
}
