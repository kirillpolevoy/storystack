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
 * Check if tags are set up for a workspace (workspace-scoped)
 */
export async function hasTagsSetUp(workspaceId?: string | null, userId?: string | null): Promise<boolean> {
  try {
    // Workspace ID is required - tags are workspace-specific
    if (!workspaceId) {
      console.warn('[TagSetup] No workspace ID provided - tags are workspace-scoped');
      return false;
    }

    // Check Supabase - look for tags in multiple places (workspace-specific)
    if (supabase) {
      try {
        // First check: Check the normalized tags table (primary source of truth)
        // This matches how getAllAvailableTags works
        const { data: tags, error: tagsError } = await supabase
          .from('tags')
          .select('name')
          .eq('workspace_id', workspaceId)
          .limit(1);

        if (!tagsError && tags && tags.length > 0) {
          console.log(`[TagSetup] ✅ Found ${tags.length} tag(s) in tags table for workspace ${workspaceId}`);
          return true;
        }

        // Second check: Check tag_config for custom_tags (workspace-specific)
        const { data: config, error } = await supabase
          .from('tag_config')
          .select('custom_tags, auto_tags')
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (!error && config) {
          // Check if workspace has custom tags
          if (config.custom_tags && Array.isArray(config.custom_tags) && config.custom_tags.length > 0) {
            console.log(`[TagSetup] ✅ Found ${config.custom_tags.length} custom tag(s) in tag_config for workspace ${workspaceId}`);
            return true;
          }
          // Check if workspace has auto tags enabled
          if (config.auto_tags && Array.isArray(config.auto_tags) && config.auto_tags.length > 0) {
            console.log(`[TagSetup] ✅ Found ${config.auto_tags.length} auto tag(s) in tag_config for workspace ${workspaceId}`);
            return true;
          }
        }

        // Third check: Check if workspace has any assets with tags
        const { data: assets } = await supabase
          .from('assets')
          .select('tags')
          .eq('workspace_id', workspaceId)
          .limit(1);

        if (assets && assets.length > 0) {
          const hasTags = assets.some((asset) => {
            const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
            return assetTags.length > 0;
          });
          if (hasTags) {
            console.log(`[TagSetup] ✅ Found assets with tags in workspace ${workspaceId}`);
            return true;
          }
        }

        console.log(`[TagSetup] ⚠️  No tags found for workspace ${workspaceId} in tags table, tag_config, or assets`);
      } catch (error) {
        console.warn('[TagSetup] Error checking Supabase for tags:', error);
      }
    }

    // Fallback to AsyncStorage (workspace-specific)
    try {
      if (workspaceId) {
        const workspaceSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${workspaceId}`;
        const customTagsJson = await AsyncStorage.getItem(workspaceSpecificKey);
        const customTags = customTagsJson ? JSON.parse(customTagsJson) : [];
        if (Array.isArray(customTags) && customTags.length > 0) {
          return true;
        }
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
