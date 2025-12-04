import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { TagVocabulary } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TagHeader } from '@/components/TagHeader';
import { TagListCard } from '@/components/TagListCard';
import { MenuDrawer } from '@/components/MenuDrawer';
import { BottomTabBar } from '@/components/BottomTabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const params = useLocalSearchParams<{ setup?: string }>();
  if (!router) {
    return null;
  }

  const isSetupMode = params.setup === 'true';
  const [tags, setTags] = useState<TagConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newTagError, setNewTagError] = useState<string | undefined>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTagName, setEditTagName] = useState('');
  const [editTagOriginalName, setEditTagOriginalName] = useState('');
  const [newTagModalVisible, setNewTagModalVisible] = useState(false);
  const [isNewTagModalAnimatingOut, setIsNewTagModalAnimatingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const newTagInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  
  // Empty state animations
  const emptyIconScale = useRef(new Animated.Value(0)).current;
  const emptyIconOpacity = useRef(new Animated.Value(0)).current;
  const emptyTextOpacity = useRef(new Animated.Value(0)).current;
  const emptyButtonScale = useRef(new Animated.Value(0.9)).current;
  const emptyButtonOpacity = useRef(new Animated.Value(0)).current;

  // Load tags from storage
  const loadTags = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get current user ID - REQUIRED for data isolation
      let userId: string | null = null;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }

      // CRITICAL: Don't load tags if no user ID - prevents cross-user data leakage
      if (!userId) {
        console.warn('[TagManagement] No user ID - cannot load tags safely');
        setTags([]);
        setIsLoading(false);
        return;
      }

      // Load deleted tags list (tags that user has explicitly deleted)
      let deletedTags: string[] = [];
      if (supabase && userId) {
        try {
          const { data: config, error } = await supabase
            .from('tag_config')
            .select('deleted_tags')
            .eq('user_id', userId)
            .single();
          
          // If column doesn't exist, error.code will be PGRST204
          if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'deleted_tags' column") && !error.message?.includes("Could not find the 'user_id' column")) {
            console.warn('[TagManagement] Error loading deleted_tags from Supabase:', error);
          }
          
          if (config?.deleted_tags && Array.isArray(config.deleted_tags)) {
            deletedTags = config.deleted_tags;
          }
        } catch (error) {
          console.warn('[TagManagement] Failed to load deleted_tags from Supabase, using AsyncStorage:', error);
        }
      }
      // Fallback to AsyncStorage - ONLY if Supabase failed AND we have user ID
      // Use user-specific key to prevent cross-user data leakage
      if (deletedTags.length === 0 && userId) {
        try {
          const userSpecificKey = `${DELETED_TAGS_STORAGE_KEY}:${userId}`;
          const deletedTagsJson = await AsyncStorage.getItem(userSpecificKey);
          deletedTags = deletedTagsJson ? JSON.parse(deletedTagsJson) : [];
        } catch (error) {
          console.warn('[TagManagement] Failed to load deleted_tags from AsyncStorage:', error);
          deletedTags = [];
        }
      }
      const deletedTagsSet = new Set<string>(deletedTags);
      
      // Load custom tags (tags that user has created but may not be used yet)
      let customTags: string[] = [];
      if (supabase && userId) {
        try {
          const { data: config, error } = await supabase
            .from('tag_config')
            .select('custom_tags')
            .eq('user_id', userId)
            .single();
          
          if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'custom_tags' column") && !error.message?.includes("Could not find the 'user_id' column")) {
            console.warn('[TagManagement] Error loading custom_tags from Supabase:', error);
          }
          
          if (config?.custom_tags && Array.isArray(config.custom_tags)) {
            customTags = config.custom_tags;
          }
        } catch (error) {
          console.warn('[TagManagement] Failed to load custom_tags from Supabase, using AsyncStorage:', error);
        }
      }
      // Fallback to AsyncStorage - ONLY if Supabase failed AND we have user ID
      // Use user-specific key to prevent cross-user data leakage
      if (customTags.length === 0 && userId) {
        try {
          const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
          const customTagsJson = await AsyncStorage.getItem(userSpecificKey);
          customTags = customTagsJson ? JSON.parse(customTagsJson) : [];
        } catch (error) {
          console.warn('[TagManagement] Failed to load custom_tags from AsyncStorage:', error);
          customTags = [];
        }
      }
      const customTagsSet = new Set<string>(customTags);
      
      // Get all unique tags from assets in the database and count usage (user-specific)
      if (supabase && userId) {
        const { data: assets } = await supabase
          .from('assets')
          .select('tags')
          .eq('user_id', userId);
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
        
        // No default tags - users only see tags they create or use
        
        // Load saved auto-tag configuration from Supabase (user-specific)
        let autoTags: string[] = [];
        if (supabase && userId) {
          try {
            const { data: config, error } = await supabase
              .from('tag_config')
              .select('auto_tags')
              .eq('user_id', userId)
              .single();
            
            if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'auto_tags' column") && !error.message?.includes("Could not find the 'user_id' column")) {
              console.warn('[TagManagement] Error loading auto_tags from Supabase:', error);
            }
            
            if (config?.auto_tags && Array.isArray(config.auto_tags)) {
              autoTags = config.auto_tags;
            }
          } catch (error) {
            console.warn('[TagManagement] Failed to load auto_tags from Supabase, using AsyncStorage:', error);
          }
        }
        // Fallback to AsyncStorage - ONLY if Supabase failed AND we have user ID
        // Use user-specific key to prevent cross-user data leakage
        if (autoTags.length === 0 && userId) {
          try {
            const userSpecificKey = `${AUTO_TAG_STORAGE_KEY}:${userId}`;
            const autoTagsJson = await AsyncStorage.getItem(userSpecificKey);
            autoTags = autoTagsJson ? JSON.parse(autoTagsJson) : [];
          } catch (error) {
            console.warn('[TagManagement] Failed to load auto_tags from AsyncStorage:', error);
            autoTags = [];
          }
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
        // Fallback: no tags (user must create their own)
        setTags([]);
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

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const query = searchQuery.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  // Animate empty state entrance
  useEffect(() => {
    if (!isLoading && tags.length === 0) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(emptyIconScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(emptyIconOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(emptyTextOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.spring(emptyButtonScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(emptyButtonOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // Reset animations
      emptyIconScale.setValue(0);
      emptyIconOpacity.setValue(0);
      emptyTextOpacity.setValue(0);
      emptyButtonScale.setValue(0.9);
      emptyButtonOpacity.setValue(0);
    }
  }, [isLoading, tags.length]);

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
      
      // Get current user ID
      let userId: string | null = null;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }
      
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
      
      // Mark tag setup as completed (user has created their first tag)
      if (userId) {
        const { markTagSetupCompleted } = await import('@/utils/tagSetup');
        await markTagSetupCompleted(userId);
      }
      
      // Clear input and close modal after successful save
      setNewTagName('');
      closeNewTagModal();
      
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
    // Get current user ID
    let userId: string | null = null;
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    // Check if tag is in use (user-specific)
    let photosUsingTag: number = 0;
    if (supabase && userId) {
      const { data: assets, error: fetchError } = await supabase
        .from('assets')
        .select('tags')
        .eq('user_id', userId);
      
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
                
                // Remove tag from all assets (user-specific)
                if (supabase && userId) {
                  const { data: assets, error: fetchError } = await supabase
                    .from('assets')
                    .select('id, tags')
                    .eq('user_id', userId);
                  
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
                
                // Add to deleted tags list
                // Load current deleted tags (user-specific)
                let currentDeletedTags: string[] = [];
                if (supabase && userId) {
                  const { data: config } = await supabase
                    .from('tag_config')
                    .select('deleted_tags')
                    .eq('user_id', userId)
                    .single();
                  if (config?.deleted_tags && Array.isArray(config.deleted_tags)) {
                    currentDeletedTags = config.deleted_tags;
                  }
                }
                if (currentDeletedTags.length === 0 && userId) {
                  const userSpecificKey = `${DELETED_TAGS_STORAGE_KEY}:${userId}`;
                  const deletedTagsJson = await AsyncStorage.getItem(userSpecificKey);
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
              
              // Add to deleted tags list
              // Load current deleted tags (user-specific)
              let currentDeletedTags: string[] = [];
              if (supabase && userId) {
                const { data: config } = await supabase
                  .from('tag_config')
                  .select('deleted_tags')
                  .eq('user_id', userId)
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

  // Simple scale animation on mount
  // Focus input when modal opens
  useEffect(() => {
    if (newTagModalVisible && !isNewTagModalAnimatingOut) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        newTagInputRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [newTagModalVisible, isNewTagModalAnimatingOut]);

  const openNewTagModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNewTagName('');
    setNewTagError(undefined);
    setNewTagModalVisible(true);
  };

  const closeNewTagModal = () => {
    if (isNewTagModalAnimatingOut) return;
    
    setIsNewTagModalAnimatingOut(true);
    Keyboard.dismiss();
    setNewTagModalVisible(false);
    setIsNewTagModalAnimatingOut(false);
    setNewTagName('');
    setNewTagError(undefined);
  };

  const openEditModal = (tagName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      
      // Get current user ID
      let userId: string | null = null;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }
      
      // Update tag in database (all assets using this tag)
      if (supabase && userId) {
        const { data: assets, error: fetchError } = await supabase
          .from('assets')
          .select('id, tags')
          .eq('user_id', userId);
        
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
      
      // All tags are user-created (no default tags)
      const wasCustomTag = true;
      const wasStorystackTag = false;
      
      // Update local state
      const updatedTags = tags.map((t) => (t.name === oldName ? { ...t, name: trimmed } : t));
      setTags(updatedTags.sort((a, b) => a.name.localeCompare(b.name)));
      
      // Save auto-tag configuration (this updates the tag_config table with the new tag name)
      await saveAutoTagConfig(updatedTags);
      
      // No default tags to handle, so skip deleted_tags logic for renaming
      if (false) {
        // Load current deleted tags (user-specific)
        let currentDeletedTags: string[] = [];
        if (supabase && userId) {
          try {
            const { data: config } = await supabase
              .from('tag_config')
              .select('deleted_tags')
              .eq('user_id', userId)
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
      
      // Update custom tags list atomically (user-specific)
      // Load current custom tags
      let currentCustomTags: string[] = [];
      if (supabase && userId) {
        try {
          const { data: config, error } = await supabase
            .from('tag_config')
            .select('custom_tags')
            .eq('user_id', userId)
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
      
      // Save to user-specific AsyncStorage first (immediate, reliable)
      if (userId) {
        const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
        await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedCustomTags));
        console.log(`[TagManagement] Custom tags saved to AsyncStorage:`, updatedCustomTags);
      }
      
      // Then try to save to Supabase
      if (supabase && userId) {
        const { error, data } = await supabase
          .from('tag_config')
          .upsert({ user_id: userId, custom_tags: updatedCustomTags }, { onConflict: 'user_id' });
        
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
    
    // Haptic feedback for toggle
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
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
      // Get current user ID
      let userId: string | null = null;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }

      if (!userId) {
        console.warn('[TagManagement] No user ID - cannot save tags safely');
        throw new Error('User ID required to save tags');
      }

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
          .upsert({ user_id: userId, auto_tags: autoTags }, { onConflict: 'user_id' });
        
        if (error) {
          console.error('[TagManagement] ❌ Supabase save failed', error);
          console.error('[TagManagement] Error details:', JSON.stringify(error, null, 2));
          // Fallback to user-specific AsyncStorage
          const userSpecificKey = `${AUTO_TAG_STORAGE_KEY}:${userId}`;
          await AsyncStorage.setItem(userSpecificKey, JSON.stringify(autoTags));
          console.log('[TagManagement] Saved to AsyncStorage as fallback');
        } else {
          console.log('[TagManagement] ✅ Auto-tag config saved successfully to Supabase');
          
          // Immediately verify what was saved
          const { data: verifyData, error: verifyError } = await supabase
            .from('tag_config')
            .select('auto_tags')
            .eq('user_id', userId)
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
          
          // Also save to user-specific AsyncStorage as backup
          const userSpecificKey = `${AUTO_TAG_STORAGE_KEY}:${userId}`;
          await AsyncStorage.setItem(userSpecificKey, JSON.stringify(autoTags));
        }
      } else {
        // No Supabase - use user-specific AsyncStorage
        const userSpecificKey = `${AUTO_TAG_STORAGE_KEY}:${userId}`;
        await AsyncStorage.setItem(userSpecificKey, JSON.stringify(autoTags));
        console.log('[TagManagement] Saved to AsyncStorage (no Supabase)');
      }
    } catch (error) {
      console.error('[TagManagement] Save auto-tag config failed', error);
      throw error; // Re-throw to allow caller to handle
    }
  };

  const saveCustomTag = async (tagName: string) => {
    try {
      // Get current user ID
      let userId: string | null = null;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }

      // Load current custom tags (user-specific)
      let currentCustomTags: string[] = [];
      if (supabase && userId) {
        try {
          const { data: config, error } = await supabase
            .from('tag_config')
            .select('custom_tags')
            .eq('user_id', userId)
            .single();
          
          if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'custom_tags' column") && !error.message?.includes("Could not find the 'user_id' column")) {
            console.warn('[TagManagement] Error loading custom_tags from Supabase:', error);
          }
          
          if (config?.custom_tags && Array.isArray(config.custom_tags)) {
            currentCustomTags = config.custom_tags;
          }
        } catch (error) {
          // Column doesn't exist, use AsyncStorage
        }
      }
      
      // Fallback to user-specific AsyncStorage
      if (currentCustomTags.length === 0 && userId) {
        try {
          const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
          const customTagsJson = await AsyncStorage.getItem(userSpecificKey);
          currentCustomTags = customTagsJson ? JSON.parse(customTagsJson) : [];
        } catch (error) {
          currentCustomTags = [];
        }
      }
      
      // Add new tag if not already present
      if (!currentCustomTags.includes(tagName)) {
        const updatedCustomTags = [...currentCustomTags, tagName];
        
        // Save to Supabase if available
        if (supabase && userId) {
          const { error } = await supabase
            .from('tag_config')
            .upsert({ user_id: userId, custom_tags: updatedCustomTags }, { onConflict: 'user_id' });
          
          if (error) {
            if (error.code === 'PGRST204' || error.message?.includes("Could not find the 'custom_tags' column")) {
              console.warn('[TagManagement] custom_tags column not found, using AsyncStorage');
            } else {
              console.error('[TagManagement] Supabase save custom_tags failed', error);
            }
            const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
            await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedCustomTags));
          } else {
            // Also save to user-specific AsyncStorage as backup
            const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
            await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedCustomTags));
          }
        } else if (userId) {
          const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
          await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedCustomTags));
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
      // Get current user ID
      let userId: string | null = null;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }

      // Load current custom tags (user-specific)
      let currentCustomTags: string[] = [];
      if (supabase && userId) {
        try {
          const { data: config, error } = await supabase
            .from('tag_config')
            .select('custom_tags')
            .eq('user_id', userId)
            .single();
          
          if (error && error.code !== 'PGRST204' && !error.message?.includes("Could not find the 'custom_tags' column") && !error.message?.includes("Could not find the 'user_id' column")) {
            console.warn('[TagManagement] Error loading custom_tags from Supabase:', error);
          }
          
          if (config?.custom_tags && Array.isArray(config.custom_tags)) {
            currentCustomTags = config.custom_tags;
          }
        } catch (error) {
          // Column doesn't exist, use AsyncStorage
        }
      }
      
      // Fallback to user-specific AsyncStorage
      if (currentCustomTags.length === 0 && userId) {
        try {
          const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
          const customTagsJson = await AsyncStorage.getItem(userSpecificKey);
          currentCustomTags = customTagsJson ? JSON.parse(customTagsJson) : [];
        } catch (error) {
          currentCustomTags = [];
        }
      }
      
      // Remove tag
      const updatedCustomTags = currentCustomTags.filter((t) => t !== tagName);
      
      // Save to Supabase if available
      if (supabase && userId) {
        const { error } = await supabase
          .from('tag_config')
          .upsert({ user_id: userId, custom_tags: updatedCustomTags }, { onConflict: 'user_id' });
        
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes("Could not find the 'custom_tags' column")) {
            console.warn('[TagManagement] custom_tags column not found, using AsyncStorage');
          } else {
            console.error('[TagManagement] Supabase save custom_tags failed', error);
          }
          const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
          await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedCustomTags));
        } else {
          const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
          await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedCustomTags));
        }
      } else if (userId) {
        const userSpecificKey = `${CUSTOM_TAGS_STORAGE_KEY}:${userId}`;
        await AsyncStorage.setItem(userSpecificKey, JSON.stringify(updatedCustomTags));
      }
      
      console.log(`[TagManagement] Custom tag "${tagName}" removed`);
    } catch (error) {
      console.error('[TagManagement] Remove custom tag failed', error);
    }
  };

  const saveDeletedTags = async (deletedTags: string[]) => {
    try {
      console.log('[TagManagement] Saving deleted tags:', deletedTags);
      
      // Get current user ID
      let userId: string | null = null;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }
      
      // Save to Supabase if available
      if (supabase && userId) {
        const { error } = await supabase
          .from('tag_config')
          .upsert({ user_id: userId, deleted_tags: deletedTags }, { onConflict: 'user_id' });
        
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
      <TagHeader 
        onMenuPress={() => setIsMenuOpen(true)}
        onAddPress={openNewTagModal}
        showAddButton={!isLoading && tags.length > 0}
      />
      
      {/* Menu Drawer */}
      <MenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#b38f5b" />
          <Text className="mt-4 text-[15px] font-medium text-gray-500">Loading tags…</Text>
        </View>
      ) : tags.length === 0 ? (
        // Enhanced Empty State
        <View className="flex-1 items-center justify-center px-8">
          <Animated.View
            style={{
              opacity: emptyIconOpacity,
              transform: [{ scale: emptyIconScale }],
            }}
            className="mb-6"
          >
            <View className="h-24 w-24 items-center justify-center rounded-full bg-[#b38f5b]/10">
              <MaterialCommunityIcons name="tag-outline" size={48} color="#b38f5b" />
            </View>
          </Animated.View>
          
          <Animated.View style={{ opacity: emptyTextOpacity }} className="items-center">
            <Text className="mb-2 text-center text-[22px] font-semibold text-gray-900">
              {isSetupMode ? 'Set Up Your Tags' : 'No Tags Yet'}
            </Text>
            <Text className="mb-8 text-center text-[15px] leading-[22px] text-gray-500">
              {isSetupMode 
                ? 'Tags are the core of StoryStack. We strongly recommend creating at least one tag before importing photos. This ensures your photos can be properly organized and automatically categorized.'
                : 'Create tags to organize and automatically categorize your photos.'}
            </Text>
            {isSetupMode && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.replace('/');
                }}
                className="mb-4"
                activeOpacity={0.7}
              >
                <Text className="text-[15px] font-medium text-gray-500">
                  Skip for now
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          <Animated.View
            style={{
              opacity: emptyButtonOpacity,
              transform: [{ scale: emptyButtonScale }],
            }}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                openNewTagModal();
              }}
              className="rounded-full bg-[#b38f5b] px-8 py-4"
              activeOpacity={0.8}
            >
              <Text className="text-center text-[17px] font-semibold text-white">
                {isSetupMode ? 'Create Your First Tag' : 'Create Your First Tag'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{ 
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 100, 120) + 80 // Extra padding for tab bar
          }}
          showsVerticalScrollIndicator={true}
        >
          {/* Search Bar */}
          <View className="mx-5 mb-4">
            <View className="flex-row items-center rounded-xl bg-gray-100 px-4 py-3">
              <MaterialCommunityIcons name="magnify" size={20} color="#8E8E93" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search tags..."
                placeholderTextColor="#8E8E93"
                className="ml-2 flex-1 text-[17px] text-gray-900"
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="ml-2"
                >
                  <MaterialCommunityIcons name="close-circle" size={20} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* AI Summary Indicator - Premium styling */}
          {filteredTags.length > 0 && (
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
          {filteredTags.length > 0 ? (
            <TagListCard
              tags={filteredTags}
              onToggleTag={handleToggleAutoTag}
              onTagPress={(tagName) => openEditModal(tagName)}
              onTagDelete={handleDeleteTag}
              togglingTag={togglingTag}
            />
          ) : (
            <View className="mx-5 rounded-2xl bg-white px-6 py-12">
              <Text className="text-center text-[15px] text-gray-500">
                No tags match "{searchQuery}"
              </Text>
            </View>
          )}

          {/* Collapsible Helper Text */}
          {filteredTags.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setIsInfoExpanded(!isInfoExpanded);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
              className="mx-5 mt-3 rounded-xl bg-gray-50 px-4 py-3"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <Text className="mr-2 text-base">ℹ️</Text>
                  <Text className="flex-1 text-[12px] font-medium text-gray-700">
                    About AI Tagging
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={isInfoExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#8E8E93"
                />
              </View>
              {isInfoExpanded && (
                <Text className="mt-2 text-[12px] leading-[18px] text-gray-600" style={{ paddingLeft: 24 }}>
                  When enabled, StoryStack will automatically apply this tag to photos when it recognizes matching content.
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* New Tag Modal - Simple, reliable keyboard-aware implementation */}
      <Modal
        visible={newTagModalVisible || isNewTagModalAnimatingOut}
        transparent
        animationType="fade"
        onRequestClose={closeNewTagModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeNewTagModal}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'center' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <View style={{ paddingHorizontal: 16 }}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              className="w-full overflow-hidden rounded-3xl bg-white"
              style={{
                width: '100%',
                maxWidth: 384,
                alignSelf: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 24,
                elevation: 12,
                minHeight: 240, // Prevent compression
              }}
            >
            {/* Header - Refined spacing and typography */}
            <View className="px-6 pt-6 pb-5">
              <Text className="text-center text-[22px] font-semibold text-gray-900 tracking-tight">
                New Tag
              </Text>
            </View>

            {/* Content - Enhanced spacing and input design with fixed padding */}
            <View className="px-6 pb-6" style={{ minHeight: 100 }}>
              <Text className="mb-2.5 text-[13px] font-medium text-gray-500 uppercase tracking-wide">
                Tag Name
              </Text>
              <TextInput
                ref={newTagInputRef}
                value={newTagName}
                onChangeText={(text) => {
                  setNewTagName(text);
                  setNewTagError(undefined);
                }}
                placeholder="Enter tag name"
                placeholderTextColor="#8E8E93"
                maxLength={30}
                className="rounded-xl border border-gray-300 bg-white px-4 py-4 text-[17px] font-normal text-gray-900"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                  minHeight: 52, // Fixed input height
                }}
                onSubmitEditing={handleAddTag}
              />
              {newTagError && (
                <View className="mt-2.5 flex-row items-center" style={{ minHeight: 20 }}>
                  <Text className="text-[13px] font-medium text-red-500">
                    {newTagError}
                  </Text>
                </View>
              )}
            </View>

            {/* Actions - Fixed height button row that never compresses */}
            <View 
              className="flex-row border-t border-gray-100"
              style={{ 
                minHeight: 56, // Fixed button row height
                paddingVertical: 0, // Let individual buttons control padding
              }}
            >
              <TouchableOpacity
                onPress={closeNewTagModal}
                className="flex-1 border-r border-gray-100"
                style={{ 
                  minHeight: 56,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingVertical: 18,
                }}
                activeOpacity={0.6}
              >
                <Text className="text-center text-[17px] font-semibold text-gray-600">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddTag}
                disabled={!newTagName.trim() || isSaving}
                className="flex-1"
                style={{ 
                  minHeight: 56,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingVertical: 18,
                  opacity: (!newTagName.trim() || isSaving) ? 0.4 : 1,
                }}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-center text-[17px] font-semibold ${
                    !newTagName.trim() || isSaving
                      ? 'text-gray-400'
                      : 'text-[#b38f5b]'
                  }`}
                >
                  {isSaving ? 'Adding...' : 'Add Tag'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Tag Modal - Same implementation as New Tag Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeEditModal}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'center' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <View style={{ paddingHorizontal: 16 }}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                className="w-full overflow-hidden rounded-3xl bg-white"
                style={{
                  width: '100%',
                  maxWidth: 384,
                  alignSelf: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 24,
                  elevation: 12,
                  minHeight: 240, // Prevent compression
                }}
              >
                {/* Header - Refined spacing and typography */}
                <View className="px-6 pt-6 pb-5">
                  <Text className="text-center text-[22px] font-semibold text-gray-900 tracking-tight">
                    Rename Tag
                  </Text>
                </View>

                {/* Content - Enhanced spacing and input design with fixed padding */}
                <View className="px-6 pb-6" style={{ minHeight: 100 }}>
                  <Text className="mb-2.5 text-[13px] font-medium text-gray-500 uppercase tracking-wide">
                    Tag Name
                  </Text>
                  <TextInput
                    value={editTagName}
                    onChangeText={setEditTagName}
                    placeholder="Enter tag name"
                    placeholderTextColor="#8E8E93"
                    maxLength={30}
                    autoFocus
                    className="rounded-xl border border-gray-300 bg-white px-4 py-4 text-[17px] font-normal text-gray-900"
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 2,
                      elevation: 1,
                      minHeight: 52, // Fixed input height
                    }}
                    onSubmitEditing={() => {
                      if (editTagName.trim()) {
                        handleRenameTag(editTagOriginalName, editTagName);
                      }
                    }}
                  />
                </View>

                {/* Actions - Fixed height button row that never compresses */}
                <View 
                  className="flex-row border-t border-gray-100"
                  style={{ 
                    minHeight: 56, // Fixed button row height
                    paddingVertical: 0, // Let individual buttons control padding
                  }}
                >
                  <TouchableOpacity
                    onPress={closeEditModal}
                    className="flex-1 border-r border-gray-100"
                    style={{ 
                      minHeight: 56,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingVertical: 18,
                    }}
                    activeOpacity={0.6}
                  >
                    <Text className="text-center text-[17px] font-semibold text-gray-600">
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
                    className="flex-1"
                    style={{ 
                      minHeight: 56,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingVertical: 18,
                      opacity: (!editTagName.trim() || isSaving || editTagName.trim() === editTagOriginalName) ? 0.4 : 1,
                    }}
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
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Bottom Tab Bar */}
      <BottomTabBar onAddPress={() => router.push('/')} />
    </View>
  );
}
