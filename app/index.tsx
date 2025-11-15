import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { Asset, TagVocabulary, STORYSTACK_TAGS } from '@/types';
import { TagModal } from '@/components/TagModal';
import { PhotoGrid } from '@/components/PhotoGrid';
import { LibraryHeader } from '@/components/LibraryHeader';
import { BottomCTA } from '@/components/BottomCTA';
import { TagFilterBar } from '@/components/TagFilterBar';
import { getDefaultCampaignId } from '@/utils/getDefaultCampaign';
import { getAllAvailableTags } from '@/utils/getAllAvailableTags';

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  if (!router) {
    return null;
  }

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagVocabulary[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [activeAssetsForTagging, setActiveAssetsForTagging] = useState<Asset[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [autoTaggingAssets, setAutoTaggingAssets] = useState<Set<string>>(new Set());
  const [autoTaggingComplete, setAutoTaggingComplete] = useState<{ count: number; totalTags: number } | null>(null);
  const [allAvailableTags, setAllAvailableTags] = useState<TagVocabulary[]>([]);

  // Initialize default campaign
  useEffect(() => {
    const initCampaign = async () => {
      const id = await getDefaultCampaignId();
      setCampaignId(id);
    };
    initCampaign();
  }, []);

  const loadAssets = useCallback(async () => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }

    if (!supabase) {
      setAssets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (assetError) {
      console.error('[Library] asset fetch failed', assetError);
    } else if (assetData) {
      const mapped = (assetData as Asset[]).map((asset) => {
        const { data } = supabase.storage.from('assets').getPublicUrl(asset.storage_path);
        const tags = Array.isArray(asset.tags) ? (asset.tags as string[]) : [];
        return { ...asset, publicUrl: data.publicUrl, tags } as Asset;
      });
      setAssets(mapped);
    }

    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) {
      loadAssets();
    }
  }, [campaignId, loadAssets]);

  // Load all available tags from tag library
  useEffect(() => {
    const loadAvailableTags = async () => {
      const tags = await getAllAvailableTags();
      setAllAvailableTags(tags);
    };
    loadAvailableTags();
  }, []);

  // Reload available tags when tag modal opens (to reflect any changes from tag management)
  useEffect(() => {
    if (isTagModalOpen) {
      const loadAvailableTags = async () => {
        const tags = await getAllAvailableTags();
        setAllAvailableTags(tags);
      };
      loadAvailableTags();
    }
  }, [isTagModalOpen]);

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

      const errors: string[] = [];
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < result.assets.length; i++) {
        const pickerAsset = result.assets[i];
        try {
          console.log(`[Library] Uploading photo ${i + 1}/${result.assets.length}...`);
          
          // Fetch image data
          let arrayBuffer: ArrayBuffer;
          try {
            const fetchResponse = await fetch(pickerAsset.uri);
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

          const extension = pickerAsset.uri.split('.').pop() ?? 'jpg';
          const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const fileName = `${uniqueSuffix}.${extension}`;
          const filePath = `campaigns/${campaignId}/${fileName}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage.from('assets').upload(filePath, arrayBuffer, {
            contentType: pickerAsset.mimeType ?? 'image/jpeg',
            upsert: false,
          });
          
          if (uploadError) {
            const errorMsg = uploadError.message || 'Storage upload failed';
            console.error(`[Library] Storage upload failed for photo ${i + 1}:`, uploadError);
            errors.push(`Photo ${i + 1}: ${errorMsg}`);
            failCount++;
            continue;
          }

          // Insert into database
          const { data: inserted, error: insertError } = await supabase
            .from('assets')
            .insert({
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
  }, [campaignId, loadAssets]);

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

  // Custom tags (tags not in STORYSTACK_TAGS)
  const customFilterTags = useMemo(() => {
    const defaults = new Set<string>(STORYSTACK_TAGS);
    return allLibraryTags.filter((tag) => !defaults.has(tag));
  }, [allLibraryTags]);

  const filteredAssets = useMemo(() => {
    if (!selectedTags.length) return assets;
    return assets.filter((asset) => selectedTags.every((tag) => asset.tags.includes(tag)));
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

  const handleLongPress = (asset: Asset) => {
    // Long press directly opens tag edit modal
    openTagModal(asset);
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
          const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
          // Limit to MAX_TAGS (5)
          const finalTags = mergedTags.slice(0, 5);
          
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

  const handleBuildStory = () => {
    if (selectedAssets.length === 0) {
      Alert.alert('No photos selected', 'Please select at least one photo to build a story.');
      return;
    }
    // Pass asset IDs as comma-separated string (more reliable than JSON in URL params)
    const assetIds = selectedAssets.map((a) => a.id).join(',');
    router.push({
      pathname: '/story-builder',
      params: {
        assetIds,
      },
    });
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-background">
        <LibraryHeader 
          onTagManagementPress={() => router.push('/tag-management')}
        />
        
        {/* Import Button - Premium gold styling */}
        <View className="px-5 pb-4">
          {supabase ? (
            <TouchableOpacity
              onPress={handleImport}
              disabled={isImporting}
              activeOpacity={0.85}
              className="w-full rounded-2xl py-4"
              style={{
                backgroundColor: isImporting ? '#e5e7eb' : '#b38f5b',
                shadowColor: isImporting ? 'transparent' : '#b38f5b',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isImporting ? 0 : 0.2,
                shadowRadius: 8,
                elevation: isImporting ? 0 : 3,
              }}
            >
              <Text className="text-center text-[17px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
                {isImporting ? 'Importing…' : 'Import Photos'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="w-full rounded-2xl bg-gray-50 px-5 py-3.5">
              <Text className="text-center text-[14px] leading-[18px] text-gray-500">
                Supabase not configured
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Selection Bar - Refined integrated bar */}
      {selectedAssets.length > 0 && (
        <View 
          className="border-b border-gray-100 bg-white px-5 py-3.5"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 0.5 },
            shadowOpacity: 0.03,
            shadowRadius: 1,
            elevation: 1,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[17px] font-semibold text-gray-900" style={{ letterSpacing: -0.3 }}>
              {selectedAssets.length} {selectedAssets.length === 1 ? 'Photo' : 'Photos'}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedAssets([])}
              activeOpacity={0.5}
            >
              <Text className="text-[17px] font-semibold text-accent" style={{ letterSpacing: -0.3 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Filter Bar - Premium styling */}
      {allLibraryTags.length > 0 && (
        <View className="bg-white px-5 py-3">
          <TagFilterBar selectedTags={selectedTags} onToggleTag={toggleTagFilter} availableTags={allLibraryTags} />
        </View>
      )}

      {/* Photo Grid */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#b38f5b" />
          <Text className="mt-4 text-[15px] font-medium text-gray-500">Loading…</Text>
        </View>
      ) : filteredAssets.length === 0 ? (
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
            No Photos
          </Text>
          <Text className="text-center text-[15px] leading-[20px] text-gray-500">
            Import photos to get started
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          <PhotoGrid
            assets={filteredAssets}
            selectedAssets={selectedAssets}
            onToggleSelect={toggleAssetSelection}
            onOpenTagModal={openTagModal}
            onLongPress={handleLongPress}
            refreshing={false}
            onRefresh={loadAssets}
            autoTaggingAssets={autoTaggingAssets}
          />
        </View>
      )}

      {/* Bottom CTA - When photos are selected, show additional actions */}
      {selectedAssets.length > 0 ? (
        <View 
          className="border-t border-gray-200 bg-white px-5 pt-4"
          style={{
            paddingBottom: Math.max(insets.bottom, 20),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {/* Primary Action */}
          <TouchableOpacity
            onPress={handleBuildStory}
            activeOpacity={0.85}
            className="mb-3 w-full rounded-2xl py-4"
            style={{
              backgroundColor: '#b38f5b',
              shadowColor: '#b38f5b',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text className="text-center text-[17px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
              Build Story ({selectedAssets.length} selected)
            </Text>
          </TouchableOpacity>

          {/* Secondary Actions - Horizontal */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={openTagModalForMultiple}
              activeOpacity={0.6}
              className="flex-1 rounded-xl bg-white py-3.5"
              style={{
                borderWidth: 1,
                borderColor: '#e5e7eb',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              <Text className="text-center text-[15px] font-semibold text-gray-900" style={{ letterSpacing: -0.2 }}>
                Edit Tags
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDeleteMultipleAssets}
              activeOpacity={0.6}
              className="flex-1 rounded-xl bg-white py-3.5"
              style={{
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.3)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              <Text className="text-center text-[15px] font-semibold text-red-600" style={{ letterSpacing: -0.2 }}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <BottomCTA selectedCount={selectedAssets.length} onPress={handleBuildStory} />
      )}

      <TagModal 
        asset={activeAsset} 
        visible={isTagModalOpen} 
        onClose={closeTagModal} 
        onUpdateTags={updateTags}
        allAvailableTags={allAvailableTags}
        multipleAssets={activeAssetsForTagging}
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
    </View>
  );
}
