import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase';
import { Asset, Campaign, TagVocabulary, BASE_TAGS, BRAND_TAGS } from '@/types';
import { queueAutoTag } from '@/utils/autoTagQueue';
import { compressImageForUpload } from '@/utils/compressImage';
import { TagFilterBar } from '@/components/TagFilterBar';
import { ImportLoadingOverlay } from '@/components/ImportLoadingOverlay';
import { TagModal } from '@/components/TagModal';
import { MenuDrawer } from '@/components/MenuDrawer';
import { getAllAvailableTags } from '@/utils/getAllAvailableTags';
import * as Haptics from 'expo-haptics';
import { computeImageHash, checkForDuplicates } from '@/utils/duplicateDetection';
import { DuplicateDetectionDialog } from '@/components/DuplicateDetectionDialog';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

const fallbackCampaign: Campaign = {
  id: 'fallback',
  name: 'Untitled Campaign',
  created_at: new Date().toISOString(),
  user_id: null,
};

const fallbackAssets: Asset[] = [];

export default function CampaignDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  if (!router) {
    return null;
  }

  const params = useLocalSearchParams<{ id: string }>();
  const campaignIdParam = params.id;
  const campaignId = Array.isArray(campaignIdParam) ? campaignIdParam[0] : campaignIdParam;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [assets, setAssets] = useState<Asset[]>(fallbackAssets);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, imported: 0, currentPhoto: 0 });
  const [autoTaggingAssets, setAutoTaggingAssets] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<TagVocabulary[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [allAvailableTags, setAllAvailableTags] = useState<TagVocabulary[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    assets: ImagePickerAsset[];
    hashes: string[];
    compressedImages: Array<{ uri: string; width: number; height: number; size: number }>;
    duplicateIndices: number[];
  } | null>(null);

  const loadCampaign = useCallback(async () => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }

    if (!supabase) {
      setCampaign({ ...fallbackCampaign, id: campaignId, name: `Campaign ${campaignId.slice(0, 6)}` });
      setAssets(fallbackAssets);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError) {
      console.error('[CampaignDetail] campaign fetch failed', campaignError);
    } else if (campaignData) {
      setCampaign(campaignData as Campaign);
    }

    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (assetError) {
      console.error('[CampaignDetail] asset fetch failed', assetError);
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
    loadCampaign();
  }, [loadCampaign]);

  // Load all available tags from tag library
  useEffect(() => {
    const loadAvailableTags = async () => {
      try {
        const tags = await getAllAvailableTags();
        setAllAvailableTags(tags);
      } catch (error) {
        console.error('[CampaignDetail] Failed to load available tags:', error);
        // Continue with empty tags array
        setAllAvailableTags([]);
      }
    };
    loadAvailableTags();
  }, []);

  // Reload available tags when tag modal opens (to reflect any changes from tag management)
  useEffect(() => {
    if (isTagModalOpen) {
      const loadAvailableTags = async () => {
        try {
          const tags = await getAllAvailableTags();
          setAllAvailableTags(tags);
        } catch (error) {
          console.error('[CampaignDetail] Failed to reload available tags:', error);
          // Continue with existing tags
        }
      };
      loadAvailableTags();
    }
  }, [isTagModalOpen]);

  const processImport = useCallback(async (
    assetsToImport: ImagePickerAsset[],
    compressedImages: Array<{ uri: string; width: number; height: number; size: number }>,
    imageHashes: string[],
    skipDuplicates: boolean
  ) => {
    if (!campaignId || !supabase) {
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be signed in to import photos.');
      return;
    }
    const userId = user.id;

    setIsImporting(true);
    setImportProgress({ total: assetsToImport.length, imported: 0, currentPhoto: 0 });

    for (let i = 0; i < assetsToImport.length; i++) {
      // Skip duplicates if user chose to skip them
      if (skipDuplicates && pendingImportData?.duplicateIndices.includes(i)) {
        console.log(`[CampaignDetail] Skipping duplicate photo ${i + 1}`);
        continue;
      }

      const compressedImage = compressedImages[i];
      
      try {
        setImportProgress(prev => ({ ...prev, currentPhoto: i + 1 }));
        console.log('[CampaignDetail] Compressing image to ensure under 5MB...');
        
        const arrayBuffer = await fetch(compressedImage.uri).then((res) => res.arrayBuffer());

        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const fileName = `${uniqueSuffix}.jpg`;
        const filePath = `users/${userId}/campaigns/${campaignId}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('assets').upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        if (uploadError) {
          throw uploadError;
        }

        const insertData: any = {
          user_id: userId,
          campaign_id: campaignId,
          storage_path: filePath,
          source: 'local',
          tags: [],
        };

        // Add file_hash if available
        const hash = imageHashes[i];
        if (hash) {
          insertData.file_hash = hash;
        }

        const { data: inserted, error: insertError } = await supabase
          .from('assets')
          .insert(insertData)
          .select('*')
          .single();

        if (insertError) {
          // If error is due to file_hash column not existing, try without it
          if (insertError.message?.includes('column') && insertError.message?.includes('file_hash')) {
            const { data: retryInserted, error: retryError } = await supabase
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

            if (retryError) {
              throw retryError;
            }

            setImportProgress(prev => ({ ...prev, imported: prev.imported + 1 }));
            
            const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
            if (edgeBase && retryInserted) {
              const publicUrl = supabase.storage.from('assets').getPublicUrl(filePath).data.publicUrl;
              setAutoTaggingAssets((prev) => new Set(prev).add(retryInserted.id));
              queueAutoTag(retryInserted.id, publicUrl, {
                onSuccess: async (result) => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(retryInserted.id);
                    return next;
                  });
                  await loadCampaign();
                },
                onError: (error) => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(retryInserted.id);
                    return next;
                  });
                },
              });
            }
            continue;
          }
          throw insertError;
        }

        setImportProgress(prev => ({ ...prev, imported: prev.imported + 1 }));

        const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
        if (edgeBase && inserted) {
          const publicUrl = supabase.storage.from('assets').getPublicUrl(filePath).data.publicUrl;
          setAutoTaggingAssets((prev) => new Set(prev).add(inserted.id));
          queueAutoTag(inserted.id, publicUrl, {
            onSuccess: async (result) => {
              setAutoTaggingAssets((prev) => {
                const next = new Set(prev);
                next.delete(inserted.id);
                return next;
              });
              await loadCampaign();
            },
            onError: (error) => {
              setAutoTaggingAssets((prev) => {
                const next = new Set(prev);
                next.delete(inserted.id);
                return next;
              });
            },
          });
        }
      } catch (error) {
        console.error('[CampaignDetail] Error importing photo:', error);
        Alert.alert('Import failed', 'We could not import one or more photos.');
      }
    }

    await loadCampaign();
    setIsImporting(false);
  }, [campaignId, loadCampaign, pendingImportData]);

  const handleImport = useCallback(async () => {
    if (!campaignId) {
      Alert.alert('Missing campaign', 'Cannot import without a campaign.');
      return;
    }

    if (!supabase) {
      Alert.alert('Supabase unavailable', 'Connect Supabase to import assets.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 100,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be signed in to import photos.');
        return;
      }
      const userId = user.id;

      // Process and compress all images
      console.log('[CampaignDetail] Processing images for duplicate detection...');
      const compressedImages: Array<{ uri: string; width: number; height: number; size: number }> = [];
      const imageHashes: string[] = [];

      for (let i = 0; i < result.assets.length; i++) {
        const pickerAsset = result.assets[i];
        
        // Convert unsupported formats if needed
        let imageUri = pickerAsset.uri;
        const uriParts = pickerAsset.uri.split('.');
        const hasExtension = uriParts.length > 1 && uriParts[uriParts.length - 1].length > 0;
        const rawExtension = hasExtension ? uriParts[uriParts.length - 1].toLowerCase() : null;
        let extension = rawExtension ?? 'jpg';
        let mimeType = pickerAsset.mimeType ?? 'image/jpeg';

        const unsupportedFormats = ['heic', 'heif', 'hevc'];
        const supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const isUnsupportedFormat = 
          unsupportedFormats.includes(extension) || 
          mimeType?.toLowerCase().includes('heic') || 
          mimeType?.toLowerCase().includes('heif') ||
          !hasExtension ||
          (!supportedFormats.includes(extension) && mimeType && !mimeType.includes('jpeg') && !mimeType.includes('jpg') && !mimeType.includes('png') && !mimeType.includes('gif') && !mimeType.includes('webp'));

        if (isUnsupportedFormat) {
          try {
            const manipulatedImage = await ImageManipulator.manipulateAsync(
              pickerAsset.uri,
              [],
              { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );
            imageUri = manipulatedImage.uri;
          } catch (convertError) {
            console.error(`[CampaignDetail] Failed to convert photo ${i + 1}:`, convertError);
          }
        }

        // Compress image
        try {
          const compressed = await compressImageForUpload(imageUri);
          compressedImages.push(compressed);

          // Compute hash
          try {
            const hash = await computeImageHash(compressed.uri);
            imageHashes.push(hash);
          } catch (hashError) {
            console.warn(`[CampaignDetail] Failed to compute hash for photo ${i + 1}:`, hashError);
            imageHashes.push('');
          }
        } catch (compressError) {
          console.error(`[CampaignDetail] Failed to compress photo ${i + 1}:`, compressError);
          continue;
        }
      }

      if (compressedImages.length === 0) {
        Alert.alert('Error', 'No photos could be processed for import.');
        return;
      }

      // Check for duplicates
      console.log('[CampaignDetail] Checking for duplicates...');
      const duplicateIndices = await checkForDuplicates(userId, imageHashes.filter(h => h !== ''));

      if (duplicateIndices.length > 0) {
        setPendingImportData({
          assets: result.assets.slice(0, compressedImages.length),
          hashes: imageHashes,
          compressedImages,
          duplicateIndices,
        });
        setShowDuplicateDialog(true);
        return;
      }

      // No duplicates, proceed with import
      await processImport(result.assets.slice(0, compressedImages.length), compressedImages, imageHashes, false);
    } catch (error) {
      console.error('[CampaignDetail] import failed', error);
      Alert.alert('Import failed', 'We could not import one or more photos.');
      setIsImporting(false);
    }
  }, [campaignId, loadCampaign, processImport]);

  const headerTitle = campaign?.name ?? `Campaign ${campaignId?.slice(0, 6) ?? ''}`;

  // Collect all unique tags from all assets in the campaign
  const allCampaignTags = useMemo(() => {
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

  const customFilterTags = useMemo(() => {
    const defaults = new Set<string>([...BASE_TAGS, ...BRAND_TAGS]);
    const extras = new Set<string>();
    assets.forEach((asset) => {
      (asset.tags ?? []).forEach((tag) => {
        if (tag && !defaults.has(tag)) {
          extras.add(tag);
        }
      });
    });
    return Array.from(extras);
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (!selectedTags.length) return assets;
    return assets.filter((asset) => selectedTags.every((tag) => asset.tags.includes(tag)));
  }, [assets, selectedTags]);

  const toggleTagFilter = (tag: TagVocabulary) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const openTagModal = (asset: Asset) => {
    setActiveAsset(asset);
    setIsTagModalOpen(true);
  };

  const closeTagModal = () => {
    setIsTagModalOpen(false);
    setActiveAsset(null);
  };

  const updateTags = async (newTags: TagVocabulary[]) => {
    if (!activeAsset || !supabase) {
      return;
    }
    const { error } = await supabase
      .from('assets')
      .update({ tags: newTags })
      .eq('id', activeAsset.id);
    if (error) {
      console.error('[CampaignDetail] update tags failed', error);
      Alert.alert('Update failed', 'Unable to update tags.');
    } else {
      await loadCampaign();
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', letterSpacing: -0.5 }}>
              {headerTitle}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: '#6b7280', letterSpacing: -0.1 }}>
              Created {campaign?.created_at ? dayjs(campaign.created_at).format('MMM D, YYYY') : 'recently'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsMenuOpen(true);
            }}
            activeOpacity={0.6}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(179, 143, 91, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 16,
            }}
          >
            <MaterialCommunityIcons name="menu" size={20} color="#b38f5b" />
          </TouchableOpacity>
        </View>
        {supabase ? (
          <TouchableOpacity
            onPress={handleImport}
            disabled={isImporting}
            style={{
              marginTop: 12,
              borderRadius: 12,
              backgroundColor: isImporting ? '#e5e7eb' : '#b38f5b',
              paddingVertical: 12,
              paddingHorizontal: 20,
              alignSelf: 'flex-start',
              shadowColor: isImporting ? 'transparent' : '#b38f5b',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isImporting ? 0 : 0.15,
              shadowRadius: 8,
              elevation: isImporting ? 0 : 3,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}>
              {isImporting ? 'Importing…' : 'Import Photos'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ marginTop: 12, fontSize: 13, color: '#b38f5b' }}>
            Supabase not configured. Connect Supabase to import photos.
          </Text>
        )}
      </View>
      
      {/* Menu Drawer */}
      <MenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FF9500" />
          <Text style={{ marginTop: 8, color: '#6B7280' }}>Loading campaign…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <View style={{ padding: 20, borderRadius: 24, backgroundColor: '#fff', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>Overview</Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: '#6B7280' }}>
              {assets.length} asset{assets.length === 1 ? '' : 's'} in this campaign.
            </Text>
            {!supabase ? (
              <Text style={{ marginTop: 12, fontSize: 13, color: '#FF9500' }}>
                Supabase is not configured, so this view is showing placeholder data.
              </Text>
            ) : null}
          </View>

          <TagFilterBar
            selectedTags={selectedTags}
            onToggleTag={toggleTagFilter}
            availableTags={allCampaignTags}
          />

          {filteredAssets.map((asset) => (
            <TouchableOpacity
              key={asset.id}
              onPress={() => openTagModal(asset)}
              activeOpacity={0.85}
              style={{ marginBottom: 12, borderRadius: 20, backgroundColor: '#fff', padding: 16 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Asset {asset.id.slice(0, 6)}</Text>
              <Text style={{ marginTop: 6, fontSize: 13, color: '#6B7280' }}>
                Added {dayjs(asset.created_at).format('MMM D, YYYY h:mm A')}
              </Text>
              {asset.publicUrl ? (
                <Image
                  source={{ uri: asset.publicUrl }}
                  style={{ marginTop: 12, width: '100%', height: 200, borderRadius: 16 }}
                  resizeMode="cover"
                />
              ) : null}
              {asset.tags.length ? (
                <Text style={{ marginTop: 8, fontSize: 13, color: '#4B5563' }}>Tags: {asset.tags.join(', ')}</Text>
              ) : (
                <Text style={{ marginTop: 8, fontSize: 13, color: '#9CA3AF' }}>No tags yet</Text>
              )}
              <Text style={{ marginTop: 10, fontSize: 12, color: '#9CA3AF' }}>Tap to edit tags</Text>
            </TouchableOpacity>
          ))}

          {!filteredAssets.length ? (
            <View style={{ marginTop: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#6B7280' }}>No assets match the selected tags.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <TagModal
        asset={activeAsset}
        visible={isTagModalOpen}
        onClose={closeTagModal}
        onUpdateTags={updateTags}
        allAvailableTags={allAvailableTags}
      />

      {/* Import Loading Overlay */}
      <ImportLoadingOverlay
        visible={isImporting}
        totalPhotos={importProgress.total}
        importedCount={importProgress.imported}
        autoTaggingCount={autoTaggingAssets.size}
        currentPhoto={importProgress.currentPhoto}
      />

      {/* Duplicate Detection Dialog */}
      {pendingImportData && (
        <DuplicateDetectionDialog
          visible={showDuplicateDialog}
          duplicateCount={pendingImportData.duplicateIndices.length}
          totalCount={pendingImportData.assets.length}
          duplicatePhotos={pendingImportData.duplicateIndices.map((index) => ({
            uri: pendingImportData.compressedImages[index]?.uri || pendingImportData.assets[index]?.uri || '',
            index,
          })).filter(photo => photo.uri)}
          onProceed={async () => {
            setShowDuplicateDialog(false);
            await processImport(
              pendingImportData.assets,
              pendingImportData.compressedImages,
              pendingImportData.hashes,
              false
            );
            setPendingImportData(null);
          }}
          onSkipDuplicates={async () => {
            setShowDuplicateDialog(false);
            await processImport(
              pendingImportData.assets,
              pendingImportData.compressedImages,
              pendingImportData.hashes,
              true
            );
            setPendingImportData(null);
          }}
          onCancel={() => {
            setShowDuplicateDialog(false);
            setPendingImportData(null);
          }}
        />
      )}
    </View>
  );
}
