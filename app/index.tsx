import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '@/lib/supabase';
import { Asset, TagVocabulary } from '@/types';
import { TagModal } from '@/components/TagModal';
import { PhotoGrid } from '@/components/PhotoGrid';
import { LibraryHeader } from '@/components/LibraryHeader';
import { BottomCTA } from '@/components/BottomCTA';
import { TagSearchBar } from '@/components/TagSearchBar';
import { getDefaultCampaignId } from '@/utils/getDefaultCampaign';
import { getAllAvailableTags } from '@/utils/getAllAvailableTags';
import { useAuth } from '@/contexts/AuthContext';
import { MenuDrawer } from '@/components/MenuDrawer';
import { FloatingActionButton } from '@/components/FloatingActionButton';

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    existingAssetIds?: string;
    storyName?: string;
  }>();
  const { session, loading: authLoading } = useAuth();
  
  // useSafeAreaInsets requires SafeAreaProvider in _layout.tsx
  // The SafeAreaProvider is set up in _layout.tsx with proper initialization delays
  const insets = useSafeAreaInsets();
  
  if (!router) {
    return null;
  }

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagVocabulary[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [activeAssetsForTagging, setActiveAssetsForTagging] = useState<Asset[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [autoTaggingAssets, setAutoTaggingAssets] = useState<Set<string>>(new Set());
  const [autoTaggingComplete, setAutoTaggingComplete] = useState<{ count: number; totalTags: number } | null>(null);
  const [allAvailableTags, setAllAvailableTags] = useState<TagVocabulary[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Initialize default campaign and tags in parallel - wait for auth to be ready
  useEffect(() => {
    // Don't proceed if auth is still loading
    if (authLoading) {
      return;
    }

    // If no session, user should be redirected by _layout.tsx, but handle gracefully
    if (!session || !session.user) {
      console.warn('[LibraryScreen] No session available, cannot initialize');
      setIsLoading(false);
      return;
    }

    const userId = session.user.id;

    // Parallelize initialization: load campaign and tags simultaneously
    const initializeData = async () => {
      try {
        // Load campaign and tags in parallel for faster initialization
        const [campaignIdResult, tagsResult] = await Promise.all([
          getDefaultCampaignId(userId),
          getAllAvailableTags(userId),
        ]);

        if (campaignIdResult) {
          setCampaignId(campaignIdResult);
        } else {
          console.error('[LibraryScreen] Failed to initialize campaign: No campaign ID returned');
          setIsLoading(false);
        }

        // Set tags immediately (don't wait for campaign)
        setAllAvailableTags(tagsResult);
      } catch (error) {
        console.error('[LibraryScreen] Failed to initialize data:', error);
        setIsLoading(false);
      }
    };
    initializeData();
  }, [authLoading, session]);

  // Ensure loading state is set correctly when campaignId changes
  useEffect(() => {
    if (!campaignId && !authLoading && session) {
      // Campaign not initialized yet, but auth is ready - keep loading
      setIsLoading(true);
    }
  }, [campaignId, authLoading, session]);

  const loadAssets = useCallback(async (isPullRefresh = false) => {
    if (!campaignId) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!supabase) {
      setAssets([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    // Validate campaignId is a valid UUID (not fallback string)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(campaignId)) {
      console.warn('[Library] Invalid campaign ID format, skipping load:', campaignId);
      setAssets([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (isPullRefresh) {
      setIsRefreshing(true);
      // Light haptic feedback for pull-to-refresh
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      setIsLoading(true);
    }
    
    // Use user ID from session (already available from AuthContext)
    if (!session || !session.user) {
      console.warn('[Library] No authenticated user, skipping asset load');
      setAssets([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const userId = session.user.id;

    // Load assets from the campaign, but also filter by user_id for security
    // This ensures RLS policies work correctly and we only see user's own assets
    // Only select needed columns for better performance
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('id, campaign_id, storage_path, source, tags, created_at')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000); // Limit to prevent loading too many at once

    if (assetError) {
      console.error('[Library] asset fetch failed', assetError);
    } else if (assetData) {
      const mapped = (assetData as Asset[]).map((asset) => {
        const { data } = supabase?.storage.from('assets').getPublicUrl(asset.storage_path) || { data: { publicUrl: '' } };
        const tags = Array.isArray(asset.tags) ? (asset.tags as string[]) : [];
        return { ...asset, publicUrl: data.publicUrl, tags } as Asset;
      });
      setAssets(mapped);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [campaignId, session]);

  const handleRefresh = useCallback(async () => {
    await loadAssets(true);
    // Success haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [loadAssets]);

  useEffect(() => {
    if (campaignId) {
      loadAssets();
    }
  }, [campaignId, loadAssets]);

  // Parse existing asset IDs from params (when adding to existing story)
  const existingAssetIds = useMemo(() => {
    const existingParam = params.existingAssetIds;
    if (!existingParam) {
      return [];
    }
    return existingParam.split(',').filter((id) => id.trim().length > 0);
  }, [params.existingAssetIds]);

  const isAddingToStory = existingAssetIds.length > 0;

  // Pre-select existing assets when adding to story (but allow user to deselect)
  useEffect(() => {
    if (isAddingToStory && assets.length > 0 && existingAssetIds.length > 0) {
      // Only pre-select if no assets are currently selected
      if (selectedAssets.length === 0) {
        const existingAssets = assets.filter((asset) => existingAssetIds.includes(asset.id));
        if (existingAssets.length > 0) {
          setSelectedAssets(existingAssets);
        }
      }
    }
  }, [isAddingToStory, assets, existingAssetIds]);

  // Load all available tags from tag library
  const loadAvailableTags = useCallback(async () => {
    if (!session?.user?.id) {
      setAllAvailableTags([]);
      return;
    }

    try {
      const tags = await getAllAvailableTags(session.user.id);
      setAllAvailableTags(tags);
    } catch (error) {
      console.error('[LibraryScreen] Failed to load available tags:', error);
      // Continue with empty tags array
      setAllAvailableTags([]);
    }
  }, [session]);

  // Load tags on mount
  useEffect(() => {
    loadAvailableTags();
  }, [loadAvailableTags]);

  // Reload tags when screen comes into focus (e.g., returning from tag management)
  useFocusEffect(
    useCallback(() => {
      loadAvailableTags();
    }, [loadAvailableTags])
  );

  // Reload available tags when tag modal opens (to reflect any changes from tag management)
  useEffect(() => {
    if (isTagModalOpen && session?.user?.id) {
      const reloadTags = async () => {
        try {
          const tags = await getAllAvailableTags(session.user.id);
          setAllAvailableTags(tags);
        } catch (error) {
          console.error('[LibraryScreen] Failed to reload available tags:', error);
          // Continue with existing tags
        }
      };
      reloadTags();
    }
  }, [isTagModalOpen, session]);

  const handleImport = useCallback(async () => {
    if (!campaignId) {
      Alert.alert('Error', 'Library not initialized. Please try again.');
      return;
    }

    if (!supabase) {
      Alert.alert('Supabase unavailable', 'Connect Supabase to import assets.');
      return;
    }

    try {
      setIsImporting(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 100,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      // Use user ID from session (already available from AuthContext)
      if (!session?.user?.id) {
        Alert.alert('Error', 'You must be signed in to import photos.');
        setIsImporting(false);
        return;
      }
      const userId = session.user.id;

      const errors: string[] = [];
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < result.assets.length; i++) {
        const pickerAsset = result.assets[i];
        try {
          console.log(`[Library] Uploading photo ${i + 1}/${result.assets.length}...`);
          
          // Check file extension and mime type
          // Extract extension from URI - check if it exists before defaulting
          const uriParts = pickerAsset.uri.split('.');
          const hasExtension = uriParts.length > 1 && uriParts[uriParts.length - 1].length > 0;
          const rawExtension = hasExtension ? uriParts[uriParts.length - 1].toLowerCase() : null;
          let extension = rawExtension ?? 'jpg'; // Default to 'jpg' only after checking
          let mimeType = pickerAsset.mimeType ?? 'image/jpeg';
          let imageUri = pickerAsset.uri;
          
          // Log file info for debugging
          console.log(`[Library] Photo ${i + 1} - Extension: ${extension}${!hasExtension ? ' (detected missing)' : ''}, MimeType: ${mimeType}, URI: ${pickerAsset.uri.substring(0, 50)}...`);
          
          // Convert HEIC/HEIF (Live Photos) and other unsupported formats to JPEG
          // Check extension, mime type, and also check if it's a Live Photo (often has no extension)
          const unsupportedFormats = ['heic', 'heif', 'hevc'];
          const supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
          const isUnsupportedFormat = 
            unsupportedFormats.includes(extension) || 
            mimeType?.toLowerCase().includes('heic') || 
            mimeType?.toLowerCase().includes('heif') ||
            // Live Photos often have no extension or wrong mime type - convert if unsure
            !hasExtension || // Check if extension was actually missing from URI
            (!supportedFormats.includes(extension) && mimeType && !mimeType.includes('jpeg') && !mimeType.includes('jpg') && !mimeType.includes('png') && !mimeType.includes('gif') && !mimeType.includes('webp'));
          
          // Convert unsupported formats to JPEG
          if (isUnsupportedFormat) {
            console.log(`[Library] Converting ${extension || 'unknown'} (${mimeType}) to JPEG for photo ${i + 1}...`);
            try {
              // Use ImageManipulator to convert to JPEG
              const manipulatedImage = await ImageManipulator.manipulateAsync(
                pickerAsset.uri,
                [], // No transformations, just convert format
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
              );
              imageUri = manipulatedImage.uri;
              extension = 'jpg';
              mimeType = 'image/jpeg';
              console.log(`[Library] ✅ Converted to JPEG: ${imageUri.substring(0, 50)}...`);
            } catch (convertError) {
              console.error(`[Library] Failed to convert ${extension} to JPEG:`, convertError);
              errors.push(`Photo ${i + 1}: Failed to convert ${extension} to JPEG. Please use JPEG, PNG, GIF, or WEBP format.`);
              failCount++;
              continue;
            }
          } else {
            console.log(`[Library] Photo ${i + 1} is already JPEG/PNG/GIF/WEBP - no conversion needed`);
          }
          
          // Fetch image data from (possibly converted) URI
          let arrayBuffer: ArrayBuffer;
          try {
            const fetchResponse = await fetch(imageUri);
            if (!fetchResponse.ok) {
              throw new Error(`Failed to read image: ${fetchResponse.status} ${fetchResponse.statusText}`);
            }
            arrayBuffer = await fetchResponse.arrayBuffer();
          } catch (fetchError) {
            const errorMsg = `Failed to read image file: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
            console.error(`[Library] ${errorMsg}`);
            errors.push(`Photo ${i + 1}: ${errorMsg}`);
            failCount++;
            continue;
          }
          
          const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const fileName = `${uniqueSuffix}.${extension}`;
          // Update storage path to include user_id
          const filePath = `users/${userId}/campaigns/${campaignId}/${fileName}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage.from('assets').upload(filePath, arrayBuffer, {
            contentType: mimeType,
            upsert: false,
          });
          
          if (uploadError) {
            const errorMsg = uploadError.message || 'Storage upload failed';
            console.error(`[Library] Storage upload failed for photo ${i + 1}:`, uploadError);
            errors.push(`Photo ${i + 1}: ${errorMsg}`);
            failCount++;
            continue;
          }

          // Insert into database with user_id
          const { data: inserted, error: insertError } = await supabase
            .from('assets')
            .insert({
              user_id: userId,
              campaign_id: campaignId,
              storage_path: filePath,
              source: 'local',
              tags: [],
            })
            .select('*')
            .single();

          if (insertError) {
            const errorMsg = insertError.message || 'Database insert failed';
            console.error(`[Library] Database insert failed for photo ${i + 1}:`, insertError);
            errors.push(`Photo ${i + 1}: ${errorMsg}`);
            failCount++;
            
            // Try to clean up storage if DB insert failed
            try {
              await supabase.storage.from('assets').remove([filePath]);
            } catch (cleanupError) {
              console.error(`[Library] Failed to cleanup storage after DB error:`, cleanupError);
            }
            continue;
          }

          successCount++;
          console.log(`[Library] ✅ Successfully imported photo ${i + 1}`);

          // Trigger auto-tagging (non-blocking)
          const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
          const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          if (edgeBase && inserted && supabaseAnonKey) {
            const publicUrl = supabase.storage.from('assets').getPublicUrl(filePath).data.publicUrl;
            const assetId = inserted.id;
            
            // Mark this asset as being auto-tagged
            setAutoTaggingAssets((prev) => new Set(prev).add(assetId));
            
            console.log('[AutoTag] Triggering auto-tagging for asset:', assetId);
            console.log('[AutoTag] Image URL:', publicUrl);
            fetch(`${edgeBase}/auto_tag_asset`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({ assetId, imageUrl: publicUrl }),
            })
              .then(async (res) => {
                if (res.ok) {
                  const result = await res.json();
                  console.log('[AutoTag] ✅ Success! Tags:', result.tags);
                  console.log('[AutoTag] Asset ID:', result.assetId);
                  
                  // Remove from auto-tagging set and check if all done
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(assetId);
                    
                    // If this was the last one, show completion toast
                    if (next.size === 0 && prev.size > 0) {
                      const totalTags = result.tags?.length || 0;
                      setAutoTaggingComplete({ count: prev.size, totalTags });
                      // Clear notification after 4 seconds
                      setTimeout(() => {
                        setAutoTaggingComplete(null);
                      }, 4000);
                    }
                    
                    return next;
                  });
                  
                  // Refresh assets to show new tags
                  setTimeout(async () => {
                    await loadAssets();
                    console.log('[AutoTag] Assets refreshed');
                  }, 1000); // Small delay to ensure DB update is complete
                } else {
                  const errorText = await res.text();
                  console.error('[AutoTag] ❌ Edge function error:', res.status, errorText);
                  
                  // Remove from auto-tagging set even on error
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(assetId);
                    return next;
                  });
                  
                  try {
                    const errorJson = JSON.parse(errorText);
                    console.error('[AutoTag] Error details:', errorJson);
                  } catch {
                    // Not JSON, already logged as text
                  }
                }
              })
              .catch((err) => {
                console.error('[AutoTag] Edge request failed', err);
                // Remove from auto-tagging set on network error
                setAutoTaggingAssets((prev) => {
                  const next = new Set(prev);
                  next.delete(assetId);
                  return next;
                });
              });
          } else {
            if (!edgeBase) {
              console.warn('[AutoTag] Edge function URL not configured. Set EXPO_PUBLIC_EDGE_BASE_URL to enable auto-tagging.');
            }
            if (!supabaseAnonKey) {
              console.warn('[AutoTag] Supabase anon key not found. Cannot authenticate edge function call.');
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[Library] Unexpected error importing photo ${i + 1}:`, error);
          errors.push(`Photo ${i + 1}: ${errorMsg}`);
          failCount++;
        }
      }

      // Refresh assets to show newly imported photos
      await loadAssets();

      // Show results
      if (failCount > 0 && successCount > 0) {
        Alert.alert(
          'Partial Import',
          `${successCount} photo${successCount > 1 ? 's' : ''} imported successfully.\n\n${failCount} photo${failCount > 1 ? 's' : ''} failed:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''}`,
          [{ text: 'OK' }]
        );
      } else if (failCount > 0) {
        Alert.alert(
          'Import Failed',
          `Could not import ${failCount} photo${failCount > 1 ? 's' : ''}:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''}`,
          [{ text: 'OK' }]
        );
      } else if (successCount > 0) {
        // Success - no alert needed, photos are visible
        console.log(`[Library] ✅ Successfully imported ${successCount} photo${successCount > 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error('[Library] Import failed with unexpected error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Import Failed', `An unexpected error occurred: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  }, [campaignId, loadAssets, session]);

  // Collect all unique tags from all assets in the library
  const allLibraryTags = useMemo(() => {
    const allTags = new Set<string>();
    assets.forEach((asset) => {
      (asset.tags ?? []).forEach((tag) => {
        if (tag) {
          allTags.add(tag);
        }
      });
    });
    return Array.from(allTags).sort();
  }, [assets]);

  // Calculate tag counts (how many photos have each tag)
  const tagCounts = useMemo(() => {
    const counts = new Map<TagVocabulary, number>();
    assets.forEach((asset) => {
      (asset.tags ?? []).forEach((tag) => {
        if (tag) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      });
    });
    return counts;
  }, [assets]);

  // Filter assets using OR logic: show photos that have ANY of the selected tags
  const filteredAssets = useMemo(() => {
    if (!selectedTags.length) return assets;
    return assets.filter((asset) => selectedTags.some((tag) => asset.tags.includes(tag)));
  }, [assets, selectedTags]);

  const toggleTagFilter = (tag: TagVocabulary) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };


  const toggleAssetSelection = (asset: Asset) => {
    setSelectedAssets((prev) => {
      const exists = prev.some((a) => a.id === asset.id);
      if (exists) {
        return prev.filter((a) => a.id !== asset.id);
      }
      return [...prev, asset];
    });
  };

  const openTagModal = (asset: Asset) => {
    setActiveAsset(asset);
    setActiveAssetsForTagging([asset]);
    setIsTagModalOpen(true);
  };

  const openTagModalForMultiple = () => {
    if (selectedAssets.length > 0) {
      setActiveAsset(selectedAssets[0]); // Use first as preview
      setActiveAssetsForTagging(selectedAssets);
      setIsTagModalOpen(true);
    }
  };

  // Long press is now handled in PhotoGrid for multi-select
  // This handler is no longer needed, but kept for backwards compatibility
  const handleLongPress = (asset: Asset) => {
    // This is now handled by PhotoGrid's onLongPress -> onToggleSelect
    toggleAssetSelection(asset);
  };

  const closeTagModal = () => {
    setIsTagModalOpen(false);
    setActiveAsset(null);
    setActiveAssetsForTagging([]);
  };

  const updateTags = async (newTags: TagVocabulary[]) => {
    if (!activeAssetsForTagging.length || !supabase) {
      return;
    }

    try {
      const assetIds = activeAssetsForTagging.map((a) => a.id);
      
      if (activeAssetsForTagging.length === 1) {
        // Single asset: replace tags (normal behavior)
        const { error } = await supabase
          .from('assets')
          .update({ tags: newTags })
          .eq('id', assetIds[0]);

        if (error) {
          console.error('[Library] update tags failed', error);
          Alert.alert('Update failed', 'Unable to update tags.');
        } else {
          await loadAssets();
        }
      } else {
        // Multiple assets: merge tags (add new tags to existing tags)
        // Fetch current tags for all assets
        const { data: currentAssets, error: fetchError } = await supabase
          .from('assets')
          .select('id, tags')
          .in('id', assetIds);

        if (fetchError) {
          console.error('[Library] fetch tags failed', fetchError);
          Alert.alert('Update failed', 'Unable to fetch current tags.');
          return;
        }

        // Update each asset with merged tags
        const updates = currentAssets.map((currentAsset) => {
          const existingTags = (currentAsset.tags ?? []) as TagVocabulary[];
          // Merge: combine existing tags with new tags, remove duplicates
          const finalTags = Array.from(new Set([...existingTags, ...newTags]));
          
          return supabase
            .from('assets')
            .update({ tags: finalTags })
            .eq('id', currentAsset.id);
        });

        const results = await Promise.all(updates);
        const hasError = results.some((result) => result.error);

        if (hasError) {
          console.error('[Library] update tags failed', results.find((r) => r.error)?.error);
          Alert.alert('Update failed', 'Unable to update tags for some photos.');
        } else {
          // Clear selection after bulk update
          setSelectedAssets([]);
          await loadAssets();
        }
      }
    } catch (error) {
      console.error('[Library] update tags error', error);
      Alert.alert('Update failed', 'An error occurred while updating tags.');
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (!supabase) {
      Alert.alert('Error', 'Supabase is not configured.');
      return;
    }

    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from selected assets if selected
              setSelectedAssets((prev) => prev.filter((a) => a.id !== asset.id));

              // Delete from storage
              if (asset.storage_path) {
                const { error: storageError } = await supabase.storage
                  .from('assets')
                  .remove([asset.storage_path]);
                if (storageError) {
                  console.error('[Library] storage delete failed', storageError);
                  // Continue with DB delete even if storage delete fails
                }
              }

              // Delete from database
              const { error: dbError } = await supabase.from('assets').delete().eq('id', asset.id);
              if (dbError) {
                console.error('[Library] database delete failed', dbError);
                Alert.alert('Delete failed', 'Unable to delete photo from database.');
                return;
              }

              // Refresh the list
              await loadAssets();
            } catch (error) {
              console.error('[Library] delete failed', error);
              Alert.alert('Delete failed', 'Something went wrong while deleting the photo.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteMultipleAssets = async () => {
    if (!supabase) {
      Alert.alert('Error', 'Supabase is not configured.');
      return;
    }

    if (selectedAssets.length === 0) {
      return;
    }

    const count = selectedAssets.length;
    Alert.alert(
      'Delete Photos',
      `Are you sure you want to delete ${count} photo${count > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const assetIds = selectedAssets.map((a) => a.id);
              const storagePaths = selectedAssets
                .map((a) => a.storage_path)
                .filter((path): path is string => Boolean(path));

              // Delete from storage
              if (storagePaths.length > 0) {
                const { error: storageError } = await supabase.storage
                  .from('assets')
                  .remove(storagePaths);
                if (storageError) {
                  console.error('[Library] storage delete failed', storageError);
                  // Continue with DB delete even if storage delete fails
                }
              }

              // Delete from database
              const { error: dbError } = await supabase.from('assets').delete().in('id', assetIds);
              if (dbError) {
                console.error('[Library] database delete failed', dbError);
                Alert.alert('Delete failed', 'Unable to delete photos from database.');
                return;
              }

              // Clear selection
              setSelectedAssets([]);

              // Refresh the list
              await loadAssets();

              Alert.alert('Success', `${count} photo${count > 1 ? 's' : ''} deleted successfully.`);
            } catch (error) {
              console.error('[Library] delete failed', error);
              Alert.alert('Delete failed', 'Something went wrong while deleting the photos.');
            }
          },
        },
      ]
    );
  };

  const handleAddToStory = () => {
    if (selectedAssets.length === 0) {
      Alert.alert('No photos selected', 'Please select at least one photo to add to a story.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Pass asset IDs as comma-separated string (more reliable than JSON in URL params)
    const newAssetIds = selectedAssets.map((a) => a.id).join(',');
    router.push({
      pathname: '/story-builder',
      params: {
        assetIds: newAssetIds,
        existingAssetIds: isAddingToStory ? existingAssetIds.join(',') : undefined,
        mode: isAddingToStory ? 'add' : 'new',
        storyName: params.storyName,
      },
    });
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header - Apple-style compact with integrated selection state */}
      <View className="bg-background border-b border-gray-100">
        <LibraryHeader
          onMenuPress={() => setIsMenuOpen(true)}
          onTagManagementPress={() => router.push('/tag-management')}
          onProfilePress={() => router.push('/profile')}
          selectedCount={selectedAssets.length}
          onCancelSelection={() => setSelectedAssets([])}
        />
      </View>

      {/* Search Bar - Content-first, immediately accessible */}
      <View className="bg-white px-5 py-3 border-b border-gray-100" style={{ zIndex: 1 }}>
        <TagSearchBar 
          selectedTags={selectedTags || []} 
          onToggleTag={toggleTagFilter} 
          availableTags={allAvailableTags || []}
          tagCounts={tagCounts}
        />
      </View>

      {/* Photo Grid */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#b38f5b" />
          <Text className="mt-4 text-[15px] font-medium text-gray-500">Loading…</Text>
        </View>
      ) : !campaignId ? (
        <View className="flex-1 items-center justify-center px-6">
          <View 
            className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text className="text-4xl">📷</Text>
          </View>
          <Text className="mb-1.5 text-center text-[20px] font-semibold text-gray-900">
            Initializing…
          </Text>
          <Text className="text-center text-[15px] leading-[20px] text-gray-500">
            Setting up your library
          </Text>
        </View>
      ) : filteredAssets.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View 
            className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-white"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <MaterialCommunityIcons name="image-multiple-outline" size={48} color="#b38f5b" />
          </View>
          <Text className="mb-2 text-center text-[24px] font-semibold text-gray-900" style={{ letterSpacing: -0.5 }}>
            No Photos Yet
          </Text>
          <Text className="mb-8 text-center text-[16px] leading-[22px] text-gray-500">
            Start building your library by importing photos
          </Text>
          <TouchableOpacity
            onPress={handleImport}
            disabled={isImporting}
            activeOpacity={0.85}
            className="w-full max-w-[320px] rounded-2xl py-4"
            style={{
              backgroundColor: '#b38f5b',
              shadowColor: '#b38f5b',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <View className="flex-row items-center justify-center">
              {isImporting ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                  <Text className="text-center text-[17px] font-semibold text-white" style={{ letterSpacing: -0.3 }}>
                    Importing...
                  </Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="image-plus" size={22} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text className="text-center text-[17px] font-semibold text-white" style={{ letterSpacing: -0.3 }}>
                    Import Photos
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1">
          <PhotoGrid
            assets={filteredAssets}
            selectedAssets={selectedAssets}
            onToggleSelect={toggleAssetSelection}
            onOpenTagModal={openTagModal}
            onLongPress={handleLongPress}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            autoTaggingAssets={autoTaggingAssets}
          />
        </View>
      )}

      {/* Bottom Actions - Apple-style contextual bar */}
      {selectedAssets.length > 0 && (
        <View 
          className="border-t border-gray-100 bg-white"
          style={{
            paddingBottom: Math.max(insets.bottom, 8),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          {/* Primary Action - Compact */}
          <View className="px-5 pt-3">
            <TouchableOpacity
              onPress={handleAddToStory}
              activeOpacity={0.85}
              className="w-full rounded-xl py-3"
              style={{
                backgroundColor: '#b38f5b',
                shadowColor: '#b38f5b',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Text className="text-center text-[16px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
                Add to Story
              </Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Actions - Refined compact row */}
          <View className="flex-row px-5 pt-2.5 pb-2 border-t border-gray-50">
            <TouchableOpacity
              onPress={openTagModalForMultiple}
              activeOpacity={0.6}
              className="flex-1 items-center py-2.5"
            >
              <View 
                className="h-9 w-9 items-center justify-center rounded-full mb-1"
                style={{
                  backgroundColor: 'rgba(179, 143, 91, 0.08)',
                }}
              >
                <MaterialCommunityIcons name="tag-outline" size={18} color="#b38f5b" />
              </View>
              <Text className="text-[12px] font-medium text-gray-600" style={{ letterSpacing: -0.1 }}>
                Tags
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDeleteMultipleAssets}
              activeOpacity={0.6}
              className="flex-1 items-center py-2.5"
            >
              <View 
                className="h-9 w-9 items-center justify-center rounded-full mb-1"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                }}
              >
                <MaterialCommunityIcons name="delete-outline" size={18} color="#ef4444" />
              </View>
              <Text className="text-[12px] font-medium text-red-600" style={{ letterSpacing: -0.1 }}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TagModal 
        asset={activeAsset} 
        visible={isTagModalOpen} 
        onClose={closeTagModal} 
        onUpdateTags={updateTags}
        allAvailableTags={allAvailableTags}
        multipleAssets={activeAssetsForTagging}
        onDelete={handleDeleteAsset}
      />


      {/* Auto-tagging completion toast */}
      {autoTaggingComplete && (
        <View
          className="absolute top-20 left-4 right-4 z-50"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 12,
          }}
        >
          <View
            className="overflow-hidden rounded-[14px] bg-white px-4 py-3"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(179, 143, 91, 0.2)',
            }}
          >
            <View className="flex-row items-center">
              <View
                className="mr-3 h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(179, 143, 91, 0.12)' }}
              >
                <Text className="text-base">✨</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-gray-900">
                  AI Tagging Complete
                </Text>
                <Text className="mt-0.5 text-[13px] text-gray-600">
                  {autoTaggingComplete.count === 1 
                    ? `${autoTaggingComplete.totalTags} ${autoTaggingComplete.totalTags === 1 ? 'tag' : 'tags'} added`
                    : `${autoTaggingComplete.count} photos tagged`}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Menu Drawer */}
      <MenuDrawer
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />

      {/* Floating Action Button - Import Photos */}
      {supabase && (
        <FloatingActionButton
          icon="image-plus"
          onPress={handleImport}
          visible={!isImporting && selectedAssets.length === 0}
        />
      )}
    </View>
  );
}
