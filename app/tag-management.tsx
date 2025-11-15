import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { STORYSTACK_TAGS, TagVocabulary } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TagHeader } from '@/components/TagHeader';
import { NewTagCard } from '@/components/NewTagCard';
import { TagListCard } from '@/components/TagListCard';

const TAG_STORAGE_KEY = '@storystack:tags';
const AUTO_TAG_STORAGE_KEY = '@storystack:auto_tags';
const DELETED_TAGS_STORAGE_KEY = '@storystack:deleted_tags';
const CUSTOM_TAGS_STORAGE_KEY = '@storystack:custom_tags';

type TagConfig = {
  name: string;
  isAutoTag: boolean;
  usageCount?: number; // Number of photos using this tag
};

export default function TagManagementScreen() {
  const router = useRouter();
  if (!router) {
    return null;
  }

  const [tags, setTags] = useState<TagConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newTagError, setNewTagError] = useState<string | undefined>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTagName, setEditTagName] = useState('');
  const [editTagOriginalName, setEditTagOriginalName] = useState('');

  // Load tags from storage
  const loadTags = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load deleted tags list (tags that user has explicitly deleted)
      let deletedTags: string[] = [];
      if (supabase) {
        try {
          const { data: config, error } = await supabase
            .from('tag_config')
            .select('deleted_tags')
            .eq('id', 'default')
            .single();
          
          // If column doesn't exist, error.code will be PGRST204
          if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'deleted_tags' column")) {
            console.warn('[TagManagement] Error loading deleted_tags from Supabase:', error);
          }
          
          if (config?.deleted_tags && Array.isArray(config.deleted_tags)) {
            deletedTags = config.deleted_tags;
          }
        } catch (error) {
          console.warn('[TagManagement] Failed to load deleted_tags from Supabase, using AsyncStorage:', error);
        }
      }
      // Fallback to AsyncStorage (always check as backup)
      if (deletedTags.length === 0) {
        try {
          const deletedTagsJson = await AsyncStorage.getItem(DELETED_TAGS_STORAGE_KEY);
          deletedTags = deletedTagsJson ? JSON.parse(deletedTagsJson) : [];
        } catch (error) {
          console.warn('[TagManagement] Failed to load deleted_tags from AsyncStorage:', error);
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
            console.warn('[TagManagement] Error loading custom_tags from Supabase:', error);
          }
          
          if (config?.custom_tags && Array.isArray(config.custom_tags)) {
            customTags = config.custom_tags;
          }
        } catch (error) {
          console.warn('[TagManagement] Failed to load custom_tags from Supabase, using AsyncStorage:', error);
        }
      }
      // Fallback to AsyncStorage
      if (customTags.length === 0) {
        try {
          const customTagsJson = await AsyncStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
          customTags = customTagsJson ? JSON.parse(customTagsJson) : [];
        } catch (error) {
          console.warn('[TagManagement] Failed to load custom_tags from AsyncStorage:', error);
          customTags = [];
        }
      }
      const customTagsSet = new Set<string>(customTags);
      
      // Get all unique tags from assets in the database and count usage
      if (supabase) {
        const { data: assets } = await supabase.from('assets').select('tags');
        const allTagsSet = new Set<string>();
        const tagUsageCounts = new Map<string, number>();
        
        if (assets) {
          assets.forEach((asset) => {
            const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
            assetTags.forEach((tag: string) => {
              if (tag) {
                allTagsSet.add(tag);
                tagUsageCounts.set(tag, (tagUsageCounts.get(tag) || 0) + 1);
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
        
        // Add default StoryStack tags, but exclude deleted ones
        STORYSTACK_TAGS.forEach((tag) => {
          if (!deletedTagsSet.has(tag)) {
            allTagsSet.add(tag);
          }
        });
        
        // Load saved auto-tag configuration from Supabase
        let autoTags: string[] = [];
        if (supabase) {
          const { data: config } = await supabase
            .from('tag_config')
            .select('auto_tags')
            .single();
          if (config?.auto_tags) {
            autoTags = Array.isArray(config.auto_tags) ? config.auto_tags : [];
          }
        }
        // Fallback to AsyncStorage if Supabase config doesn't exist
        if (autoTags.length === 0) {
          const autoTagsJson = await AsyncStorage.getItem(AUTO_TAG_STORAGE_KEY);
          autoTags = autoTagsJson ? JSON.parse(autoTagsJson) : [];
        }
        const autoTagsSet = new Set<string>(autoTags);
        
        // Create tag configs with usage counts
        const tagConfigs: TagConfig[] = Array.from(allTagsSet)
          .sort()
          .map((tag) => ({
            name: tag,
            isAutoTag: autoTagsSet.has(tag),
            usageCount: tagUsageCounts.get(tag) || 0,
          }));
        
        setTags(tagConfigs);
      } else {
        // Fallback: use default tags
        const tagConfigs: TagConfig[] = STORYSTACK_TAGS.map((tag) => ({
          name: tag,
          isAutoTag: true, // Default all StoryStack tags to auto-tag
          usageCount: 0,
        }));
        setTags(tagConfigs);
      }
    } catch (error) {
      console.error('[TagManagement] Load failed', error);
      Alert.alert('Error', 'Failed to load tags.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleAddTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setNewTagError('Tag name cannot be empty');
      return;
    }

    // Check if tag already exists
    if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewTagError('This tag already exists');
      return;
    }

    setNewTagError(undefined);

    try {
      setIsSaving(true);
      const newTag: TagConfig = {
        name: trimmed,
        isAutoTag: false, // New tags are not auto-tag by default
        usageCount: 0,
      };
      
      console.log(`[TagManagement] Adding new tag: "${trimmed}"`);
      
      const updatedTags = [...tags, newTag].sort((a, b) => a.name.localeCompare(b.name));
      setTags(updatedTags);
      setNewTagError(undefined);
      
      // Save auto-tag configuration
      await saveAutoTagConfig(updatedTags);
      
      // Save custom tag to persist it (so it appears even if not used on assets yet)
      await saveCustomTag(trimmed);
      
      // Clear input and dismiss keyboard after successful save
      setNewTagName('');
      Keyboard.dismiss();
      
      console.log(`[TagManagement] Tag "${trimmed}" added successfully`);
    } catch (error) {
      console.error('[TagManagement] Add tag failed', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setNewTagError(`Failed to add tag: ${errorMsg}`);
      Alert.alert('Error', `Failed to add tag: ${errorMsg}`);
      // Don't update state if save failed
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    // Check if tag is in use
    let photosUsingTag: number = 0;
    if (supabase) {
      const { data: assets, error: fetchError } = await supabase.from('assets').select('tags');
      
      if (fetchError) {
        console.error('[TagManagement] Failed to fetch assets:', fetchError);
        Alert.alert('Error', 'Failed to check tag usage.');
        return;
      }
      
      if (assets) {
        photosUsingTag = assets.filter((asset) => {
          const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
          return assetTags.includes(tagName);
        }).length;
      }
    }

    if (photosUsingTag > 0) {
      // Tag is in use - offer to remove from photos
      Alert.alert(
        'Delete Tag',
        `"${tagName}" is used by ${photosUsingTag} photo${photosUsingTag > 1 ? 's' : ''}.\n\nDo you want to delete this tag and remove it from all photos?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete & Remove from Photos',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsSaving(true);
                
                // Remove tag from all assets
                if (supabase) {
                  const { data: assets, error: fetchError } = await supabase.from('assets').select('id, tags');
                  
                  if (fetchError) {
                    console.error('[TagManagement] Failed to fetch assets:', fetchError);
                    Alert.alert('Error', 'Failed to load assets for tag removal.');
                    return;
                  }
                  
                  if (assets && assets.length > 0) {
                    // Find assets that use this tag
                    const assetsToUpdate = assets.filter((asset) => {
                      const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
                      return assetTags.includes(tagName);
                    });

                    console.log(`[TagManagement] Removing tag "${tagName}" from ${assetsToUpdate.length} assets`);

                    // Update each asset
                    const updatePromises = assetsToUpdate.map(async (asset) => {
                      const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
                      const updatedTags = assetTags.filter((tag: string) => tag !== tagName);
                      
                      const { error: updateError } = await supabase
                        .from('assets')
                        .update({ tags: updatedTags })
                        .eq('id', asset.id);

                      if (updateError) {
                        console.error(`[TagManagement] Failed to update asset ${asset.id}:`, updateError);
                        throw updateError;
                      }

                      return { success: true, assetId: asset.id };
                    });

                    const results = await Promise.all(updatePromises);
                    console.log(`[TagManagement] Successfully removed tag from ${results.length} assets`);
                  } else {
                    console.log('[TagManagement] No assets found to update');
                  }
                } else {
                  Alert.alert('Error', 'Database connection unavailable.');
                  return;
                }
                
                // Remove tag from local state
                const updatedTags = tags.filter((t) => t.name !== tagName);
                setTags(updatedTags);
                
                // Save auto-tag configuration
                await saveAutoTagConfig(updatedTags);
                
                // Remove from custom tags if it was a custom tag
                await removeCustomTag(tagName);
                
                // Add to deleted tags list (so it won't reappear from STORYSTACK_TAGS)
                // Load current deleted tags
                let currentDeletedTags: string[] = [];
                if (supabase) {
                  const { data: config } = await supabase
                    .from('tag_config')
                    .select('deleted_tags')
                    .eq('id', 'default')
                    .single();
                  if (config?.deleted_tags && Array.isArray(config.deleted_tags)) {
                    currentDeletedTags = config.deleted_tags;
                  }
                }
                if (currentDeletedTags.length === 0) {
                  const deletedTagsJson = await AsyncStorage.getItem(DELETED_TAGS_STORAGE_KEY);
                  currentDeletedTags = deletedTagsJson ? JSON.parse(deletedTagsJson) : [];
                }
                // Add the deleted tag to the list
                const newDeletedTags = Array.from(new Set([...currentDeletedTags, tagName]));
                await saveDeletedTags(newDeletedTags);
                
                // Reload tags from database to ensure consistency
                await loadTags();
                
                console.log(`[TagManagement] Tag "${tagName}" deleted successfully`);
                Alert.alert('Success', `Tag deleted and removed from ${photosUsingTag} photo${photosUsingTag > 1 ? 's' : ''}.`);
              } catch (error) {
                console.error('[TagManagement] Delete tag failed', error);
                Alert.alert('Error', `Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
              } finally {
                setIsSaving(false);
              }
            },
          },
        ],
      );
    } else {
      // Tag is not in use - simple delete
      Alert.alert('Delete Tag', `Are you sure you want to delete "${tagName}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSaving(true);
              
              // Remove tag from local state
              const updatedTags = tags.filter((t) => t.name !== tagName);
              setTags(updatedTags);
              
              // Save auto-tag configuration
              await saveAutoTagConfig(updatedTags);
              
              // Remove from custom tags if it was a custom tag
              await removeCustomTag(tagName);
              
              // Add to deleted tags list (so it won't reappear from STORYSTACK_TAGS)
              // Load current deleted tags
              let currentDeletedTags: string[] = [];
              if (supabase) {
                const { data: config } = await supabase
                  .from('tag_config')
                  .select('deleted_tags')
                  .eq('id', 'default')
                  .single();
                if (config?.deleted_tags && Array.isArray(config.deleted_tags)) {
                  currentDeletedTags = config.deleted_tags;
                }
              }
              if (currentDeletedTags.length === 0) {
                const deletedTagsJson = await AsyncStorage.getItem(DELETED_TAGS_STORAGE_KEY);
                currentDeletedTags = deletedTagsJson ? JSON.parse(deletedTagsJson) : [];
              }
              // Add the deleted tag to the list
              const newDeletedTags = Array.from(new Set([...currentDeletedTags, tagName]));
              await saveDeletedTags(newDeletedTags);
              
              // Reload tags from database to ensure consistency
              await loadTags();
              
              console.log(`[TagManagement] Tag "${tagName}" deleted successfully`);
            } catch (error) {
              console.error('[TagManagement] Delete tag failed', error);
              Alert.alert('Error', `Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]);
    }
  };

  const openEditModal = (tagName: string) => {
    setEditTagOriginalName(tagName);
    setEditTagName(tagName);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditTagName('');
    setEditTagOriginalName('');
  };

  const handleRenameTag = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      closeEditModal();
      return;
    }

    if (trimmed === oldName) {
      closeEditModal();
      return; // No change
    }

    // Check if new name already exists
    if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.name !== oldName)) {
      Alert.alert('Tag Exists', 'A tag with this name already exists.');
      return;
    }

    try {
      setIsSaving(true);
      
      // Update tag in database (all assets using this tag)
      if (supabase) {
        const { data: assets, error: fetchError } = await supabase.from('assets').select('id, tags');
        
        if (fetchError) {
          console.error('[TagManagement] Failed to fetch assets:', fetchError);
          Alert.alert('Error', 'Failed to load assets for tag update.');
          return;
        }
        
        if (assets && assets.length > 0) {
          // Find assets that use this tag
          const assetsToUpdate = assets.filter((asset) => {
            const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
            return assetTags.includes(oldName);
          });

          console.log(`[TagManagement] Updating ${assetsToUpdate.length} assets with tag "${oldName}" -> "${trimmed}"`);

          // Update each asset
          const updatePromises = assetsToUpdate.map(async (asset) => {
            const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
            const updatedTags = assetTags.map((tag: string) => (tag === oldName ? trimmed : tag));
            
            const { error: updateError } = await supabase
              .from('assets')
              .update({ tags: updatedTags })
              .eq('id', asset.id);

            if (updateError) {
              console.error(`[TagManagement] Failed to update asset ${asset.id}:`, updateError);
              throw updateError;
            }

            return { success: true, assetId: asset.id };
          });

          const results = await Promise.all(updatePromises);
          console.log(`[TagManagement] Successfully updated ${results.length} assets`);
        } else {
          console.log('[TagManagement] No assets found to update');
        }
      } else {
        Alert.alert('Error', 'Database connection unavailable.');
        return;
      }
      
      // Check if the old tag was a custom tag (not in STORYSTACK_TAGS)
      const storystackSet = new Set(STORYSTACK_TAGS);
      const wasCustomTag = !storystackSet.has(oldName);
      const wasStorystackTag = storystackSet.has(oldName);
      
      // Update local state
      const updatedTags = tags.map((t) => (t.name === oldName ? { ...t, name: trimmed } : t));
      setTags(updatedTags.sort((a, b) => a.name.localeCompare(b.name)));
      
      // Save auto-tag configuration (this updates the tag_config table with the new tag name)
      await saveAutoTagConfig(updatedTags);
      
      // If renaming a STORYSTACK_TAGS tag, add old name to deleted_tags so it doesn't reappear
      // IMPORTANT: Only add the OLD name, never the new name
      if (wasStorystackTag) {
        // Load current deleted tags
        let currentDeletedTags: string[] = [];
        if (supabase) {
          try {
            const { data: config } = await supabase
              .from('tag_config')
              .select('deleted_tags')
              .eq('id', 'default')
              .single();
            if (config?.deleted_tags && Array.isArray(config.deleted_tags)) {
              currentDeletedTags = config.deleted_tags;
            }
          } catch (error) {
            // Column doesn't exist, use AsyncStorage
          }
        }
        if (currentDeletedTags.length === 0) {
          try {
            const deletedTagsJson = await AsyncStorage.getItem(DELETED_TAGS_STORAGE_KEY);
            currentDeletedTags = deletedTagsJson ? JSON.parse(deletedTagsJson) : [];
          } catch (error) {
            currentDeletedTags = [];
          }
        }
        // Add the old tag name to deleted_tags if not already there
        // Make absolutely sure we're NOT adding the new name
        if (!currentDeletedTags.includes(oldName) && oldName !== trimmed) {
          const newDeletedTags = Array.from(new Set([...currentDeletedTags, oldName]));
          // Double-check: ensure new name is NOT in deleted_tags
          const finalDeletedTags = newDeletedTags.filter(t => t !== trimmed);
          await saveDeletedTags(finalDeletedTags);
          console.log(`[TagManagement] Added "${oldName}" (not "${trimmed}") to deleted_tags to prevent reappearance`);
        }
      }
      
      // Update custom tags list atomically
      // Load current custom tags
      let currentCustomTags: string[] = [];
      if (supabase) {
        try {
          const { data: config, error } = await supabase
            .from('tag_config')
            .select('custom_tags')
            .eq('id', 'default')
            .single();
          
          if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'custom_tags' column")) {
            console.warn('[TagManagement] Error loading custom_tags from Supabase:', error);
          }
          
          if (config?.custom_tags && Array.isArray(config.custom_tags)) {
            currentCustomTags = config.custom_tags;
          }
        } catch (error) {
          // Column doesn't exist, use AsyncStorage
        }
      }
      
      // Fallback to AsyncStorage
      if (currentCustomTags.length === 0) {
        try {
          const customTagsJson = await AsyncStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
          currentCustomTags = customTagsJson ? JSON.parse(customTagsJson) : [];
        } catch (error) {
          currentCustomTags = [];
        }
      }
      
      // Update custom tags: remove old name (if it was custom), add new name (if not already present)
      let updatedCustomTags = [...currentCustomTags];
      
      // Remove old name if it was a custom tag
      if (wasCustomTag) {
        updatedCustomTags = updatedCustomTags.filter((t) => t !== oldName);
      }
      
      // Add new name if not already present
      if (!updatedCustomTags.includes(trimmed)) {
        updatedCustomTags.push(trimmed);
      }
      
      // Save updated custom tags list
      console.log(`[TagManagement] Saving custom_tags:`, updatedCustomTags);
      console.log(`[TagManagement] Expected new tag "${trimmed}" in list:`, updatedCustomTags.includes(trimmed));
      
      // Always save to AsyncStorage first (immediate, reliable)
      await AsyncStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updatedCustomTags));
      console.log(`[TagManagement] Custom tags saved to AsyncStorage:`, updatedCustomTags);
      
      // Then try to save to Supabase
      if (supabase) {
        const { error, data } = await supabase
          .from('tag_config')
          .upsert({ id: 'default', custom_tags: updatedCustomTags }, { onConflict: 'id' });
        
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes("Could not find the 'custom_tags' column")) {
            console.warn('[TagManagement] custom_tags column not found in Supabase, using AsyncStorage only');
          } else {
            console.error('[TagManagement] Supabase save custom_tags failed:', error);
            // AsyncStorage already saved, so we're good
          }
        } else {
          console.log(`[TagManagement] Custom tags saved to Supabase:`, updatedCustomTags);
        }
      }
      
      // Small delay to ensure database updates have propagated
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Reload tags from database to ensure consistency
      await loadTags();
      
      console.log(`[TagManagement] Tag renamed successfully: "${oldName}" -> "${trimmed}"`);
      console.log(`[TagManagement] Updated tags list:`, updatedTags.map(t => t.name));
      
      closeEditModal();
    } catch (error) {
      console.error('[TagManagement] Rename tag failed', error);
      Alert.alert('Error', `Failed to rename tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const [togglingTag, setTogglingTag] = useState<string | null>(null);

  const handleToggleAutoTag = useCallback(async (tagName: string) => {
    // Prevent double-toggling
    if (togglingTag === tagName || isSaving) {
      return;
    }

    // Find the current tag state
    const currentTag = tags.find((t) => t.name === tagName);
    if (!currentTag) return;
    
    const currentState = currentTag.isAutoTag;
    const newState = !currentState;
    
    // Set toggling state immediately to prevent double-taps
    setTogglingTag(tagName);
    
    // Optimistically update UI immediately for smooth animation
    // This happens synchronously so the Switch animation starts immediately
    setTags((prevTags) => 
      prevTags.map((t) =>
        t.name === tagName ? { ...t, isAutoTag: newState } : t,
      )
    );
    
    // Save in background after animation has started
    // Use requestAnimationFrame to ensure the Switch animation begins first
    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          const updatedTags = tags.map((t) =>
            t.name === tagName ? { ...t, isAutoTag: newState } : t,
          );
          await saveAutoTagConfig(updatedTags);
        } catch (error) {
          console.error('[TagManagement] Toggle auto-tag save failed', error);
          // Revert on error
          setTags((prevTags) => {
            const reverted = prevTags.map((t) =>
              t.name === tagName ? { ...t, isAutoTag: currentState } : t,
            );
            return reverted;
          });
          Alert.alert('Error', 'Failed to update auto-tag setting.');
        } finally {
          setTogglingTag(null);
        }
      }, 100);
    });
  }, [tags, togglingTag, isSaving]);

  const saveAutoTagConfig = async (tagConfigs: TagConfig[]) => {
    try {
      // Filter to ONLY tags where isAutoTag is true
      const autoTags = tagConfigs.filter((t) => t.isAutoTag).map((t) => t.name);
      
      console.log('[TagManagement] ===== SAVING AUTO-TAG CONFIG =====');
      console.log('[TagManagement] - Total tags:', tagConfigs.length);
      console.log('[TagManagement] - Enabled tags (isAutoTag=true):', autoTags);
      console.log('[TagManagement] - Disabled tags:', tagConfigs.filter((t) => !t.isAutoTag).map((t) => t.name));
      console.log('[TagManagement] - "Bright" enabled?', autoTags.includes('Bright'));
      
      // Save to Supabase if available
      if (supabase) {
        const { data, error } = await supabase
          .from('tag_config')
          .upsert({ id: 'default', auto_tags: autoTags }, { onConflict: 'id' });
        
        if (error) {
          console.error('[TagManagement] ❌ Supabase save failed', error);
          console.error('[TagManagement] Error details:', JSON.stringify(error, null, 2));
          // Fallback to AsyncStorage
          await AsyncStorage.setItem(AUTO_TAG_STORAGE_KEY, JSON.stringify(autoTags));
          console.log('[TagManagement] Saved to AsyncStorage as fallback');
        } else {
          console.log('[TagManagement] ✅ Auto-tag config saved successfully to Supabase');
          
          // Immediately verify what was saved
          const { data: verifyData, error: verifyError } = await supabase
            .from('tag_config')
            .select('auto_tags')
            .eq('id', 'default')
            .single();
          
          if (verifyError) {
            console.error('[TagManagement] ❌ Failed to verify save:', verifyError);
          } else {
            console.log('[TagManagement] ✅ VERIFIED: auto_tags in database:', verifyData?.auto_tags);
            console.log('[TagManagement] ✅ VERIFIED: "Bright" in database?', verifyData?.auto_tags?.includes('Bright'));
            if (verifyData?.auto_tags?.includes('Bright') && !autoTags.includes('Bright')) {
              console.error('[TagManagement] ❌❌❌ MISMATCH: "Bright" is in DB but should NOT be!');
            }
          }
          
          // Also save to AsyncStorage as backup
          await AsyncStorage.setItem(AUTO_TAG_STORAGE_KEY, JSON.stringify(autoTags));
        }
      } else {
        // Fallback to AsyncStorage
        await AsyncStorage.setItem(AUTO_TAG_STORAGE_KEY, JSON.stringify(autoTags));
        console.log('[TagManagement] Saved to AsyncStorage (no Supabase)');
      }
    } catch (error) {
      console.error('[TagManagement] Save auto-tag config failed', error);
      throw error; // Re-throw to allow caller to handle
    }
  };

  const saveCustomTag = async (tagName: string) => {
    try {
      // Load current custom tags
      let currentCustomTags: string[] = [];
      if (supabase) {
        try {
          const { data: config, error } = await supabase
            .from('tag_config')
            .select('custom_tags')
            .eq('id', 'default')
            .single();
          
          if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'custom_tags' column")) {
            console.warn('[TagManagement] Error loading custom_tags from Supabase:', error);
          }
          
          if (config?.custom_tags && Array.isArray(config.custom_tags)) {
            currentCustomTags = config.custom_tags;
          }
        } catch (error) {
          // Column doesn't exist, use AsyncStorage
        }
      }
      
      // Fallback to AsyncStorage
      if (currentCustomTags.length === 0) {
        try {
          const customTagsJson = await AsyncStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
          currentCustomTags = customTagsJson ? JSON.parse(customTagsJson) : [];
        } catch (error) {
          currentCustomTags = [];
        }
      }
      
      // Add new tag if not already present
      if (!currentCustomTags.includes(tagName)) {
        const updatedCustomTags = [...currentCustomTags, tagName];
        
        // Save to Supabase if available
        if (supabase) {
          const { error } = await supabase
            .from('tag_config')
            .upsert({ id: 'default', custom_tags: updatedCustomTags }, { onConflict: 'id' });
          
          if (error) {
            if (error.code === 'PGRST204' || error.message?.includes("Could not find the 'custom_tags' column")) {
              console.warn('[TagManagement] custom_tags column not found, using AsyncStorage');
            } else {
              console.error('[TagManagement] Supabase save custom_tags failed', error);
            }
            await AsyncStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updatedCustomTags));
          } else {
            // Also save to AsyncStorage as backup
            await AsyncStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updatedCustomTags));
          }
        } else {
          await AsyncStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updatedCustomTags));
        }
        
        console.log(`[TagManagement] Custom tag "${tagName}" saved`);
      }
    } catch (error) {
      console.error('[TagManagement] Save custom tag failed', error);
      // Don't throw - this is not critical
    }
  };

  const removeCustomTag = async (tagName: string) => {
    try {
      // Load current custom tags
      let currentCustomTags: string[] = [];
      if (supabase) {
        try {
          const { data: config, error } = await supabase
            .from('tag_config')
            .select('custom_tags')
            .eq('id', 'default')
            .single();
          
          if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'custom_tags' column")) {
            console.warn('[TagManagement] Error loading custom_tags from Supabase:', error);
          }
          
          if (config?.custom_tags && Array.isArray(config.custom_tags)) {
            currentCustomTags = config.custom_tags;
          }
        } catch (error) {
          // Column doesn't exist, use AsyncStorage
        }
      }
      
      // Fallback to AsyncStorage
      if (currentCustomTags.length === 0) {
        try {
          const customTagsJson = await AsyncStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
          currentCustomTags = customTagsJson ? JSON.parse(customTagsJson) : [];
        } catch (error) {
          currentCustomTags = [];
        }
      }
      
      // Remove tag
      const updatedCustomTags = currentCustomTags.filter((t) => t !== tagName);
      
      // Save to Supabase if available
      if (supabase) {
        const { error } = await supabase
          .from('tag_config')
          .upsert({ id: 'default', custom_tags: updatedCustomTags }, { onConflict: 'id' });
        
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes("Could not find the 'custom_tags' column")) {
            console.warn('[TagManagement] custom_tags column not found, using AsyncStorage');
          } else {
            console.error('[TagManagement] Supabase save custom_tags failed', error);
          }
          await AsyncStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updatedCustomTags));
        } else {
          await AsyncStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updatedCustomTags));
        }
      } else {
        await AsyncStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updatedCustomTags));
      }
      
      console.log(`[TagManagement] Custom tag "${tagName}" removed`);
    } catch (error) {
      console.error('[TagManagement] Remove custom tag failed', error);
    }
  };

  const saveDeletedTags = async (deletedTags: string[]) => {
    try {
      console.log('[TagManagement] Saving deleted tags:', deletedTags);
      
      // Save to Supabase if available
      if (supabase) {
        const { error } = await supabase
          .from('tag_config')
          .upsert({ id: 'default', deleted_tags: deletedTags }, { onConflict: 'id' });
        
        if (error) {
          // Check if error is due to missing column (PGRST204)
          if (error.code === 'PGRST204' || error.message?.includes("Could not find the 'deleted_tags' column")) {
            console.warn('[TagManagement] deleted_tags column not found in tag_config table, using AsyncStorage fallback');
          } else {
            console.error('[TagManagement] Supabase save deleted tags failed', error);
          }
          // Always fallback to AsyncStorage if Supabase fails
          await AsyncStorage.setItem(DELETED_TAGS_STORAGE_KEY, JSON.stringify(deletedTags));
        } else {
          console.log('[TagManagement] Deleted tags saved successfully to Supabase');
          // Also save to AsyncStorage as backup
          await AsyncStorage.setItem(DELETED_TAGS_STORAGE_KEY, JSON.stringify(deletedTags));
        }
      } else {
        // Fallback to AsyncStorage
        await AsyncStorage.setItem(DELETED_TAGS_STORAGE_KEY, JSON.stringify(deletedTags));
        console.log('[TagManagement] Deleted tags saved to AsyncStorage');
      }
    } catch (error) {
      console.error('[TagManagement] Save deleted tags failed', error);
      // Don't throw - just use AsyncStorage as final fallback
      try {
        await AsyncStorage.setItem(DELETED_TAGS_STORAGE_KEY, JSON.stringify(deletedTags));
        console.log('[TagManagement] Deleted tags saved to AsyncStorage as fallback');
      } catch (storageError) {
        console.error('[TagManagement] AsyncStorage save also failed', storageError);
        throw storageError;
      }
    }
  };

  const TagItem = ({ item, index }: { item: TagConfig; index: number }) => {
    const swipeableRef = useRef<Swipeable>(null);

    const renderRightActions = () => (
      <View className="flex-row items-center justify-end">
        <TouchableOpacity
          onPress={() => {
            swipeableRef.current?.close();
            handleDeleteTag(item.name);
          }}
          activeOpacity={0.9}
          style={{ 
            backgroundColor: '#FF3B30',
            height: '100%',
            minHeight: 44,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
          }}
        >
          <Text 
            className="text-white"
            style={{ 
              fontSize: 17,
              fontWeight: '400',
              letterSpacing: -0.41,
            }}
          >
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        <View className="bg-white px-4" style={{ minHeight: 44, justifyContent: 'center' }}>
          <View className="flex-row items-center justify-between">
            {/* Left: Tag Name with Edit Indicator */}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => {
                swipeableRef.current?.close();
                openEditModal(item.name);
              }}
              className="flex-1 pr-4"
            >
              <View className="flex-row items-center">
                <Text className="text-[17px] text-gray-900" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="ml-2 text-[12px] text-gray-400">›</Text>
              </View>
            </TouchableOpacity>

            {/* Right: AI Auto-Tagging Toggle */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                swipeableRef.current?.close();
                handleToggleAutoTag(item.name);
              }}
              onLongPress={() => {
                swipeableRef.current?.close();
                Alert.alert(
                  item.name,
                  '',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Rename',
                      onPress: () => openEditModal(item.name),
                    },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => handleDeleteTag(item.name),
                    },
                  ],
                  { cancelable: true },
                );
              }}
            >
              <Switch
                value={item.isAutoTag}
                onValueChange={() => {
                  swipeableRef.current?.close();
                  handleToggleAutoTag(item.name);
                }}
                trackColor={{ false: '#e5e7eb', true: '#b38f5b' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#e5e7eb"
              />
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    );
  };

  const aiEnabledCount = tags.filter((t) => t.isAutoTag).length;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <TagHeader onBackPress={() => router.back()} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#b38f5b" />
          <Text className="mt-4 text-[15px] font-medium text-gray-500">Loading tags…</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={true}
        >
          {/* New Tag Card */}
          <NewTagCard
            newTagName={newTagName}
            onTagNameChange={(text) => {
              setNewTagName(text);
              setNewTagError(undefined);
            }}
            onAdd={handleAddTag}
            isSaving={isSaving}
            error={newTagError}
          />

          {/* AI Summary Indicator - Premium styling */}
          {tags.length > 0 && (
            <View className="mx-5 mb-3">
              {aiEnabledCount > 0 ? (
                <View className="flex-row items-center self-start rounded-full bg-[#b38f5b]/10 px-3 py-1.5">
                  <Text className="mr-1.5 text-xs">✨</Text>
                  <Text className="text-[12px] font-medium text-[#b38f5b]">
                    {aiEnabledCount} of {tags.length} tags using AI
                  </Text>
                </View>
              ) : (
                <View className="self-start rounded-full bg-gray-100 px-3 py-1.5">
                  <Text className="text-[12px] font-medium text-gray-600">
                    No tags using AI yet
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Tag List Card */}
          <TagListCard
            tags={tags}
            onToggleTag={handleToggleAutoTag}
            onTagPress={(tagName) => openEditModal(tagName)}
            onTagDelete={handleDeleteTag}
            togglingTag={togglingTag}
          />

          {/* Helper Text - More contextual placement */}
          {tags.length > 0 && (
            <View className="mx-5 mt-3 rounded-xl bg-gray-50 px-4 py-3">
              <View className="flex-row items-start">
                <Text className="mr-2 text-base">ℹ️</Text>
                <Text className="flex-1 text-[12px] leading-[18px] text-gray-600">
                  When enabled, StoryStack will automatically apply this tag to photos when it recognizes matching content.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Edit Tag Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeEditModal}
        statusBarTranslucent={true}
      >
        <View className="flex-1">
          {/* Backdrop */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeEditModal}
            className="absolute inset-0 bg-black/50"
          />
          
          {/* Modal Content */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 items-center justify-center px-4"
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-[20px] bg-white"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
            {/* Header */}
            <View className="border-b border-gray-200 px-6 py-4">
              <Text className="text-center text-[20px] font-semibold text-gray-900">
                Rename Tag
              </Text>
            </View>

            {/* Content */}
            <View className="px-6 py-5">
              <Text className="mb-3 text-[15px] text-gray-600">
                Tag Name
              </Text>
              <TextInput
                value={editTagName}
                onChangeText={setEditTagName}
                placeholder="Enter tag name"
                placeholderTextColor="#8E8E93"
                maxLength={30}
                autoFocus
                className="rounded-[10px] border border-gray-200 bg-gray-50 px-4 py-3.5 text-[17px] text-gray-900"
                onSubmitEditing={() => {
                  if (editTagName.trim()) {
                    handleRenameTag(editTagOriginalName, editTagName);
                  }
                }}
              />
            </View>

            {/* Actions */}
            <View className="flex-row border-t border-gray-200">
              <TouchableOpacity
                onPress={closeEditModal}
                className="flex-1 border-r border-gray-200 py-4"
                activeOpacity={0.7}
              >
                <Text className="text-center text-[17px] font-semibold text-gray-500">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (editTagName.trim()) {
                    handleRenameTag(editTagOriginalName, editTagName);
                  }
                }}
                disabled={!editTagName.trim() || isSaving || editTagName.trim() === editTagOriginalName}
                className={`flex-1 py-4 ${
                  !editTagName.trim() || isSaving || editTagName.trim() === editTagOriginalName
                    ? 'opacity-50'
                    : ''
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-center text-[17px] font-semibold ${
                    !editTagName.trim() || isSaving || editTagName.trim() === editTagOriginalName
                      ? 'text-gray-400'
                      : 'text-[#b38f5b]'
                  }`}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
