import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase';
import { Asset, Campaign, TagVocabulary, BASE_TAGS, BRAND_TAGS } from '@/types';
import { queueAutoTag } from '@/utils/autoTagQueue';
import { compressImageForAI } from '@/utils/compressImageForAI';
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
  const [successfullyAutoTaggedCount, setSuccessfullyAutoTaggedCount] = useState(0);
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
  const [showRetryNotification, setShowRetryNotification] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryNotificationOpacity = useRef(new Animated.Value(0)).current;
  const retryNotificationTranslateY = useRef(new Animated.Value(-60)).current;
  const optimisticTagUpdatesRef = useRef<Map<string, { tags: TagVocabulary[], timestamp: number }>>(new Map()); // Track optimistic tag updates
  const [newlyImportedAssetIds, setNewlyImportedAssetIds] = useState<Set<string>>(new Set());

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
    } else     if (assetData) {
      const mapped = (assetData as Asset[]).map((asset) => {
        const { data } = supabase.storage.from('assets').getPublicUrl(asset.storage_path);
        const tags = Array.isArray(asset.tags) ? (asset.tags as string[]) : [];
        
        // Check if we have a recent optimistic update for this asset
        // If so, use optimistic tags instead of DB tags (they're more recent)
        const optimisticUpdate = optimisticTagUpdatesRef.current.get(asset.id);
        const isRecentOptimisticUpdate = optimisticUpdate && (Date.now() - optimisticUpdate.timestamp < 10000);
        const finalTags = isRecentOptimisticUpdate ? optimisticUpdate.tags : tags;
        
        if (isRecentOptimisticUpdate && JSON.stringify(tags.sort()) !== JSON.stringify(optimisticUpdate.tags.sort())) {
          console.log(`[CampaignDetail] loadCampaign: Using optimistic tags for asset ${asset.id}`, {
            dbTags: tags,
            optimisticTags: optimisticUpdate.tags
          });
        }
        
        return { ...asset, publicUrl: data.publicUrl, tags: finalTags } as Asset;
      });
      setAssets(mapped);
      
      // Sync pending assets with autoTaggingAssets Set and re-queue them for processing
      setAutoTaggingAssets((prev) => {
        const next = new Set(prev);
        mapped.forEach(asset => {
          if (asset.auto_tag_status === 'pending') {
            next.add(asset.id);
            // Re-queue pending assets for background retry
            // Add small delay to ensure asset is fully committed before queuing
            if (asset.publicUrl) {
              console.log(`[CampaignDetail] Re-queuing pending asset: ${asset.id}`);
              // Delay to avoid race conditions
              setTimeout(() => {
                queueAutoTag(asset.id, asset.publicUrl, {
                onSuccess: async (result) => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(asset.id);
                    return next;
                  });
                  setSuccessfullyAutoTaggedCount((prev) => prev + 1);
                  // Show temporary success indicator (if PhotoGrid is used in campaign screen)
                  // Note: Campaign screen may not use PhotoGrid, so this is optional
                  await loadCampaign();
                },
                onError: async (error) => {
                  // Only remove from Set if it's a final failure (not a retry)
                  const currentAsset = assets.find(a => a.id === asset.id);
                  if (currentAsset?.auto_tag_status !== 'pending') {
                    setAutoTaggingAssets((prev) => {
                      const next = new Set(prev);
                      next.delete(asset.id);
                      return next;
                    });
                  }
                  await loadCampaign();
                },
                onRetryStart: (assetId) => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.add(assetId);
                    return next;
                  });
                  showRetryNotificationBanner(1);
                  loadCampaign();
                },
              });
              }, 200); // 200ms delay to ensure asset is committed
            }
          } else if (asset.auto_tag_status === 'completed' || asset.auto_tag_status === 'failed') {
            next.delete(asset.id);
          }
        });
        return next;
      });
    }

    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  // Periodic check for pending/failed assets (every 30 seconds) to retry background processing
  // Only retry assets from the most recent import session
  useEffect(() => {
    if (!campaignId || !supabase) return;

    const interval = setInterval(async () => {
      // Only check newly imported assets, not all assets in the campaign
      if (newlyImportedAssetIds.size === 0) {
        return; // No recent imports to retry
      }
      
      const importedIdsArray = Array.from(newlyImportedAssetIds);
      
      // Check for pending/failed assets from the recent import session
      const { data: importedAssets } = await supabase
        .from('assets')
        .select('*')
        .in('id', importedIdsArray);
      
      if (!importedAssets || importedAssets.length === 0) {
        return;
      }
      
      // Filter assets that need retry (pending or failed with no tags)
      const assetsNeedingRetry = importedAssets.filter((asset: any) => {
        const hasNoTags = !asset.tags || asset.tags.length === 0;
        const isPendingOrFailed = asset.auto_tag_status === 'pending' || asset.auto_tag_status === 'failed';
        const notCurrentlyProcessing = !autoTaggingAssets.has(asset.id);
        return hasNoTags && isPendingOrFailed && notCurrentlyProcessing;
      });

      if (assetsNeedingRetry.length > 0) {
        console.log(`[CampaignDetail] Found ${assetsNeedingRetry.length} assets from recent import needing retry, re-queuing...`);
        
        // Show notification to user
        showRetryNotificationBanner(assetsNeedingRetry.length);
        
        assetsNeedingRetry.forEach((asset: any) => {
            const publicUrl = supabase.storage.from('assets').getPublicUrl(asset.storage_path).data.publicUrl;
            if (publicUrl) {
              // Mark as pending before retrying
              supabase
                .from('assets')
                .update({ auto_tag_status: 'pending' })
                .eq('id', asset.id)
                .then(() => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.add(asset.id);
                    return next;
                  });
                  queueAutoTag(asset.id, publicUrl, {
                onSuccess: async (result) => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(asset.id);
                    return next;
                  });
                  setSuccessfullyAutoTaggedCount((prev) => prev + 1);
                  await loadCampaign();
                },
                    onError: async (error) => {
                      // Reload to check current status
                      const { data: currentAsset } = await supabase
                        .from('assets')
                        .select('auto_tag_status')
                        .eq('id', asset.id)
                        .single();
                      
                      if (currentAsset?.auto_tag_status !== 'pending') {
                        setAutoTaggingAssets((prev) => {
                          const next = new Set(prev);
                          next.delete(asset.id);
                          return next;
                        });
                      }
                      await loadCampaign();
                    },
                    onRetryStart: (assetId) => {
                      setAutoTaggingAssets((prev) => {
                        const next = new Set(prev);
                        next.add(assetId);
                        return next;
                      });
                      showRetryNotificationBanner(1);
                      loadCampaign();
                    },
                  });
                });
            }
          });
        }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [campaignId, supabase, autoTaggingAssets, loadCampaign, newlyImportedAssetIds, showRetryNotificationBanner]);

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
    setSuccessfullyAutoTaggedCount(0); // Reset count for new import session

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
        // Store directly in A2 path (ai/ folder) - A2 is now the only version
        const filePath = `users/${userId}/campaigns/${campaignId}/ai/${fileName}`;

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
          auto_tag_status: 'pending',
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
                auto_tag_status: 'pending',
              })
              .select('*')
              .single();

            if (retryError) {
              throw retryError;
            }

            setImportProgress(prev => ({ ...prev, imported: prev.imported + 1 }));
            importedIds.add(retryInserted.id);
            
            const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
            if (edgeBase && retryInserted) {
              // Verify asset exists in database before queuing (avoid race condition)
              // Increased delay to ensure database transaction is fully committed and replicated
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Double-check asset exists with retries
              let verifyAsset = null;
              for (let retry = 0; retry < 3; retry++) {
                const { data, error } = await supabase
                  .from('assets')
                  .select('id')
                  .eq('id', retryInserted.id)
                  .single();
                
                if (data && !error) {
                  verifyAsset = data;
                  break;
                }
                
                if (retry < 2) {
                  console.log(`[CampaignDetail] Asset ${retryInserted.id} not found, retrying (${retry + 1}/3)...`);
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              }
              
              if (!verifyAsset) {
                console.warn(`[CampaignDetail] Asset ${retryInserted.id} not found after insert and retries, skipping auto-tag`);
                continue;
              }
              
              const publicUrl = supabase.storage.from('assets').getPublicUrl(filePath).data.publicUrl;
              setAutoTaggingAssets((prev) => new Set(prev).add(retryInserted.id));
              queueAutoTag(retryInserted.id, publicUrl, {
                onSuccess: async (result) => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(retryInserted.id);
                    return next;
                  });
                  setSuccessfullyAutoTaggedCount((prev) => prev + 1);
                  await loadCampaign();
                },
                onError: async (error) => {
                  // Only remove from Set if it's a final failure (not a retry)
                  // If status is still pending, keep it in the Set
                  const currentAsset = assets.find(a => a.id === retryInserted.id);
                  if (currentAsset?.auto_tag_status !== 'pending') {
                    setAutoTaggingAssets((prev) => {
                      const next = new Set(prev);
                      next.delete(retryInserted.id);
                      return next;
                    });
                  }
                  // Reload to get updated status from DB
                  await loadCampaign();
                },
                onRetryStart: (assetId) => {
                  // Retry started - add to Set to show loading
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.add(assetId);
                    return next;
                  });
                  showRetryNotificationBanner(1);
                  // Also reload to get updated status from DB
                  loadCampaign();
                },
              });
            }
            continue;
          }
          throw insertError;
        }

        setImportProgress(prev => ({ ...prev, imported: prev.imported + 1 }));
        importedIds.add(inserted.id);
        
        // Refresh assets incrementally to show photos as they're imported
        // Only refresh every 3 photos or on last photo to avoid too many updates
        const currentImported = importedIds.size;
        if (currentImported % 3 === 0) {
          await loadCampaign();
        }

        const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
        if (edgeBase && inserted) {
          // Verify asset exists in database before queuing (avoid race condition)
          // Increased delay to ensure database transaction is fully committed and replicated
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Double-check asset exists with retries
          let verifyAsset = null;
          for (let retry = 0; retry < 3; retry++) {
            const { data, error } = await supabase
              .from('assets')
              .select('id')
              .eq('id', inserted.id)
              .single();
            
            if (data && !error) {
              verifyAsset = data;
              break;
            }
            
            if (retry < 2) {
              console.log(`[CampaignDetail] Asset ${inserted.id} not found, retrying (${retry + 1}/3)...`);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          
          if (!verifyAsset) {
            console.warn(`[CampaignDetail] Asset ${inserted.id} not found after insert and retries, skipping auto-tag`);
            continue;
          }
          
          const publicUrl = supabase.storage.from('assets').getPublicUrl(filePath).data.publicUrl;
          setAutoTaggingAssets((prev) => new Set(prev).add(inserted.id));
          queueAutoTag(inserted.id, publicUrl, {
            onSuccess: async (result) => {
              setAutoTaggingAssets((prev) => {
                const next = new Set(prev);
                next.delete(inserted.id);
                return next;
              });
              setSuccessfullyAutoTaggedCount((prev) => prev + 1);
              await loadCampaign();
            },
            onError: async (error) => {
              // Only remove from Set if it's a final failure (not a retry)
              // If status is still pending, keep it in the Set
              const currentAsset = assets.find(a => a.id === inserted.id);
              if (currentAsset?.auto_tag_status !== 'pending') {
                setAutoTaggingAssets((prev) => {
                  const next = new Set(prev);
                  next.delete(inserted.id);
                  return next;
                });
              }
              // Reload to get updated status from DB
              await loadCampaign();
            },
            onRetryStart: (assetId) => {
              // Retry started - add to Set to show loading
              setAutoTaggingAssets((prev) => {
                const next = new Set(prev);
                next.add(assetId);
                return next;
              });
              showRetryNotificationBanner(1);
              // Also reload to get updated status from DB
              loadCampaign();
            },
          });
        }
      } catch (error) {
        console.error('[CampaignDetail] Error importing photo:', error);
        Alert.alert('Import failed', 'We could not import one or more photos.');
      }
    }

    // Final refresh to ensure all photos are shown
    await loadCampaign();
    
    // Store the newly imported asset IDs for retry notification
    setNewlyImportedAssetIds(importedIds);
    
    // Overlay will auto-dismiss via onDismiss callback
    
    // Check for pending/failed assets from THIS import session and show notification when overlay is dismissed
    // Use a small delay to ensure database state is consistent and overlay is dismissed
    const checkForRetries = async () => {
      if (campaignId && supabase && importedIds.size > 0) {
        console.log('[CampaignDetail] Checking for pending/failed assets from current import session...');
        console.log('[CampaignDetail] Newly imported asset IDs:', Array.from(importedIds));
        
        // Check database for the specific assets we just imported
        const importedIdsArray = Array.from(importedIds);
        const { data: importedAssets, error: importedError } = await supabase
          .from('assets')
          .select('id, tags, auto_tag_status')
          .in('id', importedIdsArray);
        
        if (importedError) {
          console.error('[CampaignDetail] Error fetching imported assets:', importedError);
        }
        
        // Count pending assets + failed assets with no tags from THIS import session
        const pendingCount = (importedAssets || []).filter((asset: any) => asset.auto_tag_status === 'pending').length;
        const failedCount = (importedAssets || []).filter((asset: any) => 
          asset.auto_tag_status === 'failed' && (!asset.tags || asset.tags.length === 0)
        ).length;
        const retryCount = pendingCount + failedCount;
        
        console.log('[CampaignDetail] Retry check results (current import only):', {
          pendingCount,
          failedCount,
          retryCount,
          importedAssets: importedAssets?.map((a: any) => ({ 
            id: a.id, 
            tags: a.tags?.length || 0, 
            status: a.auto_tag_status 
          })),
        });
        
        if (retryCount > 0) {
          console.log(`[CampaignDetail] ✅ Showing retry notification for ${retryCount} asset(s) from current import`);
          showRetryNotificationBanner(retryCount);
        } else {
          console.log('[CampaignDetail] ❌ No assets from current import need retry, skipping notification');
        }
      } else {
        console.log('[CampaignDetail] ⚠️  Cannot check for retries:', {
          hasCampaignId: !!campaignId,
          hasSupabase: !!supabase,
          importedIdsSize: importedIds.size,
        });
      }
    };
    
    // Delay the check to ensure progress bar is dismissed and database is consistent
    setTimeout(checkForRetries, 2000);
  }, [campaignId, loadCampaign, pendingImportData, showRetryNotificationBanner]);

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

      // Show import overlay IMMEDIATELY when photos are selected
      setIsImporting(true);
      setImportProgress({ total: result.assets.length, imported: 0, currentPhoto: 0 });

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

        // Compute hash from ORIGINAL image (before compression)
        // This ensures consistent hashing even if compression parameters differ
        // or if iOS re-encodes the image when saving to camera roll
        let hash = '';
        try {
          hash = await computeImageHash(imageUri);
          imageHashes.push(hash);
          console.log(`[CampaignDetail] Computed hash from original image for photo ${i + 1}`);
        } catch (hashError) {
          console.warn(`[CampaignDetail] Failed to compute hash for photo ${i + 1}:`, hashError);
          imageHashes.push('');
        }

        // Compress image to A2 format (1024px long edge for AI tagging) AFTER computing hash
        try {
          const compressed = await compressImageForAI(imageUri);
          compressedImages.push(compressed);
        } catch (compressError) {
          console.error(`[CampaignDetail] Failed to compress photo ${i + 1}:`, compressError);
          // If compression fails but we have a hash, we can still proceed
          // (though upload might fail if file is too large)
          if (!hash) {
            continue; // Skip if both hash and compression failed
          }
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
      
      // Check for pending/failed assets and show notification when overlay is dismissed
      setTimeout(async () => {
        if (campaignId && supabase) {
          console.log('[CampaignDetail] Checking for pending/failed assets after import error...');
          const { data: pendingAssets, error: pendingError } = await supabase
            .from('assets')
            .select('id, tags, auto_tag_status')
            .eq('campaign_id', campaignId)
            .eq('auto_tag_status', 'pending');
          
          if (pendingError) {
            console.error('[CampaignDetail] Error fetching pending assets:', pendingError);
          }
          
          const { data: failedAssets, error: failedError } = await supabase
            .from('assets')
            .select('id, tags, auto_tag_status')
            .eq('campaign_id', campaignId)
            .eq('auto_tag_status', 'failed');
          
          if (failedError) {
            console.error('[CampaignDetail] Error fetching failed assets:', failedError);
          }
          
          // Count pending assets + failed assets with no tags
          const pendingCount = pendingAssets?.length || 0;
          const failedCount = (failedAssets || []).filter((asset: any) => !asset.tags || asset.tags.length === 0).length;
          const retryCount = pendingCount + failedCount;
          
          console.log('[CampaignDetail] Retry check results (error path):', {
            pendingCount,
            failedCount,
            retryCount,
          });
          
          if (retryCount > 0) {
            console.log(`[CampaignDetail] Showing retry notification for ${retryCount} asset(s) after overlay dismissal (error)`);
            showRetryNotificationBanner(retryCount);
          }
        }
      }, 1000); // 1 second delay to ensure database state is consistent
      
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

  // Sync activeAsset with assets when it updates (for background refreshes)
  // This ensures TagModal shows the latest tags even after background refresh
  // BUT: Don't overwrite if we just made an optimistic tag update
  useEffect(() => {
    if (activeAsset && isTagModalOpen) {
      // Find updated asset in assets array
      const updatedAsset = assets.find(a => a.id === activeAsset.id);
      if (updatedAsset) {
        // Check if we have a recent optimistic update for this asset
        const optimisticUpdate = optimisticTagUpdatesRef.current.get(activeAsset.id);
        const isRecentOptimisticUpdate = optimisticUpdate && (Date.now() - optimisticUpdate.timestamp < 10000);
        
        // Check if tags or other properties changed
        const currentTagsStr = JSON.stringify(activeAsset.tags ?? []);
        const updatedTagsStr = JSON.stringify(updatedAsset.tags ?? []);
        const currentStatus = activeAsset.auto_tag_status;
        const updatedStatus = updatedAsset.auto_tag_status;
        
        // Only sync if tags/status changed AND we don't have a recent optimistic update
        // If we have a recent optimistic update, only sync if the DB tags match our optimistic tags
        // (meaning the DB update completed successfully)
        if (currentTagsStr !== updatedTagsStr || currentStatus !== updatedStatus) {
          if (isRecentOptimisticUpdate) {
            // Check if DB tags match our optimistic tags (update succeeded)
            const optimisticTagsStr = JSON.stringify(optimisticUpdate.tags.sort());
            const dbTagsStr = JSON.stringify((updatedAsset.tags ?? []).sort());
            console.log('[CampaignDetail] Sync check - optimistic update exists', {
              assetId: activeAsset.id,
              optimisticTags: optimisticUpdate.tags,
              dbTags: updatedAsset.tags,
              match: optimisticTagsStr === dbTagsStr
            });
            if (optimisticTagsStr === dbTagsStr) {
              // DB update completed successfully, safe to sync
              console.log('[CampaignDetail] ✅ Syncing activeAsset - DB update confirmed, tags match optimistic update');
              setActiveAsset(updatedAsset);
              // Clear optimistic tracking since DB is now in sync
              optimisticTagUpdatesRef.current.delete(activeAsset.id);
            } else {
              // DB has different tags - might be stale data, don't overwrite optimistic update
              console.log('[CampaignDetail] ⚠️ Skipping sync - optimistic update in progress, DB tags differ. Keeping optimistic tags.');
            }
          } else {
            // No recent optimistic update, safe to sync normally
            console.log('[CampaignDetail] Syncing activeAsset with updated data from assets (no optimistic update)');
            setActiveAsset(updatedAsset);
          }
        }
      }
    }
  }, [assets, isTagModalOpen]); // Removed activeAsset?.id to allow updates when tags change

  const openTagModal = (asset: Asset) => {
    setActiveAsset(asset);
    setIsTagModalOpen(true);
  };

  const closeTagModal = () => {
    setIsTagModalOpen(false);
    setActiveAsset(null);
  };

  // Helper function to show retry notification
  const showRetryNotificationBanner = useCallback((count: number) => {
    console.log(`[CampaignDetail] 🎯 showRetryNotificationBanner called with count: ${count}`);
    
    // Set state first
    setRetryCount(count);
    setShowRetryNotification(true);
    
    console.log(`[CampaignDetail] ✅ Set showRetryNotification to true, retryCount: ${count}`);
    
    // Reset animation values
    retryNotificationOpacity.setValue(0);
    retryNotificationTranslateY.setValue(-60);
    
    // Start animation after a tiny delay to ensure state is set
    setTimeout(() => {
      console.log(`[CampaignDetail] 🎬 Starting notification animation...`);
      Animated.parallel([
        Animated.spring(retryNotificationTranslateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(retryNotificationOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start((finished) => {
        console.log(`[CampaignDetail] ✅ Notification animation started, finished: ${finished}`);
      });
      
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        console.log(`[CampaignDetail] 🕐 Auto-dismissing notification...`);
        Animated.parallel([
          Animated.timing(retryNotificationTranslateY, {
            toValue: -60,
            duration: 300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(retryNotificationOpacity, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          console.log(`[CampaignDetail] ✅ Notification dismissed`);
          setShowRetryNotification(false);
        });
      }, 3000);
    }, 50); // Small delay to ensure state update is processed
  }, [retryNotificationOpacity, retryNotificationTranslateY]);

  const updateTags = async (newTags: TagVocabulary[]) => {
    if (!activeAsset || !supabase) {
      return;
    }
    
    console.log(`[CampaignDetail] Updating tags for asset ${activeAsset.id}:`, newTags);
    
    const { data, error } = await supabase
      .from('assets')
      .update({ tags: newTags })
      .eq('id', activeAsset.id)
      .select('id, tags')
      .single();
      
    if (error) {
      console.error('[CampaignDetail] ❌ update tags failed', error);
      Alert.alert('Update failed', 'Unable to update tags.');
      return;
    }
    
    // Verify the update actually persisted
    if (!data || JSON.stringify(data.tags?.sort()) !== JSON.stringify(newTags.sort())) {
      console.error('[CampaignDetail] ❌ Database update verification failed!', {
        expected: newTags,
        received: data?.tags
      });
      Alert.alert('Update failed', 'Tags were not saved correctly. Please try again.');
      return;
    }
    
    console.log(`[CampaignDetail] ✅ Tags successfully saved to database for asset ${activeAsset.id}:`, data.tags);
    
    // Track this optimistic update - prevent sync useEffect from overwriting for 10 seconds
    optimisticTagUpdatesRef.current.set(activeAsset.id, {
      tags: newTags,
      timestamp: Date.now()
    });
    
    // Optimistically update activeAsset immediately so TagModal shows new tags
    console.log(`[CampaignDetail] Optimistically updating activeAsset with tags:`, newTags);
    setActiveAsset({ ...activeAsset, tags: newTags });
    
    // Optimistically update assets array so filteredAssets has correct tags
    // This prevents sync useEffect from overwriting with stale data
    setAssets((prev) => {
      const updated = prev.map(a => a.id === activeAsset.id ? { ...a, tags: newTags } : a);
      console.log(`[CampaignDetail] Optimistically updated assets array. Asset ${activeAsset.id} now has tags:`, 
        updated.find(a => a.id === activeAsset.id)?.tags);
      return updated;
    });
    
    // Don't call loadCampaign() immediately - it would overwrite our optimistic update
    // The database update has already succeeded and been verified, so tags are persisted
    // Natural refresh cycles (navigate away/back, pull-to-refresh) will sync eventually
    // Clean up optimistic update tracking after 10 seconds
    setTimeout(() => {
      optimisticTagUpdatesRef.current.delete(activeAsset.id);
      console.log(`[CampaignDetail] Cleaned up optimistic update tracking for asset ${activeAsset.id}`);
    }, 10000);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Background Retry Notification */}
      {showRetryNotification && (
        <Animated.View
          style={{
            position: 'absolute',
            top: Math.max(insets.top, 16) + 56,
            left: 0,
            right: 0,
            zIndex: 10000, // Increased z-index to ensure it's on top
            opacity: retryNotificationOpacity,
            transform: [{ translateY: retryNotificationTranslateY }],
            alignItems: 'center',
            pointerEvents: 'box-none', // Allow touches to pass through
          }}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 18,
              flexDirection: 'row',
              alignItems: 'center',
              marginHorizontal: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          >
            <ActivityIndicator size="small" color="#b38f5b" style={{ marginRight: 10 }} />
            <Text
              style={{
                color: '#111827',
                fontSize: 14,
                fontWeight: '500',
                letterSpacing: -0.2,
              }}
            >
              Retrying auto-tagging for {retryCount} {retryCount === 1 ? 'photo' : 'photos'}...
            </Text>
          </View>
        </Animated.View>
      )}

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
        allAssets={filteredAssets}
        onAssetChange={(newAsset) => {
          setActiveAsset(newAsset);
        }}
        autoTaggingAssets={autoTaggingAssets}
      />

      {/* Import Loading Overlay */}
      <ImportLoadingOverlay
        visible={isImporting}
        totalPhotos={importProgress.total}
        importedCount={importProgress.imported}
        autoTaggingCount={autoTaggingAssets.size}
        successfullyAutoTaggedCount={successfullyAutoTaggedCount}
        currentPhoto={importProgress.currentPhoto}
        onDismiss={() => {
          // Overlay auto-dismisses after import completes
          setIsImporting(false);
        }}
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
            setIsImporting(false);
            setImportProgress({ total: 0, imported: 0, currentPhoto: 0 });
          }}
        />
      )}
    </View>
  );
}
