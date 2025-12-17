import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import type { ImagePickerAsset } from 'expo-image-picker';
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
import { BottomTabBar } from '@/components/BottomTabBar';
import { queueAutoTag, queueBulkAutoTag } from '@/utils/autoTagQueue';
import { compressImageForAI } from '@/utils/compressImageForAI';
import { ImportLoadingOverlay } from '@/components/ImportLoadingOverlay';
import { computeImageHash, checkForDuplicates } from '@/utils/duplicateDetection';
import { DuplicateDetectionDialog } from '@/components/DuplicateDetectionDialog';
import { extractLocationFromEXIF } from '@/utils/extractLocationFromEXIF';

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
  const [importProgress, setImportProgress] = useState({ total: 0, imported: 0, currentPhoto: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagVocabulary[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [activeAssetsForTagging, setActiveAssetsForTagging] = useState<Asset[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [autoTaggingAssets, setAutoTaggingAssets] = useState<Set<string>>(new Set());
  const [successfullyAutoTaggedCount, setSuccessfullyAutoTaggedCount] = useState(0);
  const [allAvailableTags, setAllAvailableTags] = useState<TagVocabulary[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasStartedAutoTagging, setHasStartedAutoTagging] = useState(false);
  const hasSeenAutoTaggingActive = useRef(false); // Track if we've seen autoTaggingAssets.size > 0
  const optimisticTagUpdatesRef = useRef<Map<string, { tags: TagVocabulary[], timestamp: number }>>(new Map()); // Track optimistic tag updates
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    assets: ImagePicker.ImagePickerAsset[];
    hashes: string[];
    compressedImages: Array<{ uri: string; width: number; height: number; size: number }>;
    duplicateIndices: number[];
    locations: (string | null)[];
  } | null>(null);
  const [showRetryNotification, setShowRetryNotification] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0); // Track failed count separately
  const retryNotificationOpacity = useRef(new Animated.Value(0)).current;
  const retryNotificationTranslateY = useRef(new Animated.Value(-60)).current;
  const [newlyImportedAssetIds, setNewlyImportedAssetIds] = useState<Set<string>>(new Set());
  const [recentlyTaggedAssets, setRecentlyTaggedAssets] = useState<Set<string>>(new Set()); // Track recently successfully tagged assets
  
  // Premium delete flow state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deletedAssetsCount, setDeletedAssetsCount] = useState(0);
  const [deletedAssetsForUndo, setDeletedAssetsForUndo] = useState<Asset[]>([]); // Store for undo
  const deleteSuccessOpacity = useRef(new Animated.Value(0)).current;
  const deleteSuccessTranslateY = useRef(new Animated.Value(-60)).current;

  // Function to check for retries when overlay is dismissed
  const checkForRetriesOnOverlayDismiss = useCallback(async () => {
    if (!supabase || newlyImportedAssetIds.size === 0) {
      console.log('[Library] ⚠️  Cannot check for retries on overlay dismiss:', {
        hasSupabase: !!supabase,
        newlyImportedAssetIdsSize: newlyImportedAssetIds.size,
      });
      return;
    }
    
    const importedIdsArray = Array.from(newlyImportedAssetIds);
    console.log('[Library] 🔍 Checking for pending/failed assets when overlay dismissed...');
    console.log('[Library] Newly imported asset IDs:', importedIdsArray);
    
    // Small delay to ensure database state is up to date
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check database for the specific assets we just imported
    const { data: importedAssets, error: importedError } = await supabase
      .from('assets')
      .select('id, tags, location, auto_tag_status')
      .in('id', importedIdsArray);
    
    if (importedError) {
      console.error('[Library] Error fetching imported assets:', importedError);
      return;
    }
    
        // Count pending assets + failed assets with no tags from THIS import session
        const pendingCount = (importedAssets || []).filter((asset: any) => asset.auto_tag_status === 'pending').length;
        const failedCountForNotification = (importedAssets || []).filter((asset: any) => 
          asset.auto_tag_status === 'failed' && (!asset.tags || asset.tags.length === 0)
        ).length;
        const retryCount = pendingCount + failedCountForNotification;
        
        console.log('[Library] 📊 Retry check results (on overlay dismiss):', {
          pendingCount,
          failedCount: failedCountForNotification,
          retryCount,
          importedAssets: importedAssets?.map((a: any) => ({ 
            id: a.id, 
            tags: a.tags?.length || 0, 
            status: a.auto_tag_status 
          })),
        });
        
        if (retryCount > 0) {
          console.log(`[Library] ✅ Showing retry notification for ${retryCount} asset(s) when overlay dismissed`);
          // Show notification directly with failed count
          setRetryCount(retryCount);
          setFailedCount(failedCountForNotification); // Track failed count
          setShowRetryNotification(true);
      retryNotificationOpacity.setValue(0);
      retryNotificationTranslateY.setValue(-60);
      
      setTimeout(() => {
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
        ]).start();
        
        setTimeout(() => {
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
            setShowRetryNotification(false);
          });
        }, 5000); // Show for 5 seconds instead of 3 to give users time to read
      }, 50);
    } else {
      console.log('[Library] ❌ No assets need retry when overlay dismissed');
    }
  }, [supabase, newlyImportedAssetIds, retryNotificationOpacity, retryNotificationTranslateY]);

  // Hide overlay when all auto-tagging is complete
  // This effect handles BOTH success and error cases consistently
  useEffect(() => {
    console.log('[Library] Overlay visibility check:', {
      isImporting,
      autoTaggingCount: autoTaggingAssets.size,
      imported: importProgress.imported,
      total: importProgress.total,
      hasStartedAutoTagging,
    });
    
    // Don't hide if we're not importing
    if (!isImporting) {
      // Reset flags when not importing
      if (hasStartedAutoTagging) {
        setHasStartedAutoTagging(false);
      }
      hasSeenAutoTaggingActive.current = false;
      return;
    }
    
    // Don't hide if there are assets being auto-tagged
    if (autoTaggingAssets.size > 0) {
      console.log('[Library] Still auto-tagging, keeping overlay visible');
      hasSeenAutoTaggingActive.current = true; // Mark that we've seen auto-tagging active
      return;
    }
    
    // Check if all photos have been processed (imported count matches total)
    // This handles both success and error cases:
    // - Success: imported === total (all photos imported)
    // - Error: imported === total (all photos processed, even if some failed)
    if (
      importProgress.imported === importProgress.total &&
      importProgress.total > 0
    ) {
      // If auto-tagging has started and we've seen it active, and now it's complete, hide overlay
      if (hasStartedAutoTagging && hasSeenAutoTaggingActive.current && autoTaggingAssets.size === 0) {
        console.log('[Library] All import and auto-tagging complete, hiding overlay in 1.5s');
        const timer = setTimeout(async () => {
          setIsImporting(false);
          setImportProgress({ total: 0, imported: 0, currentPhoto: 0 });
          setHasStartedAutoTagging(false);
          hasSeenAutoTaggingActive.current = false;
          
          // Check for pending/failed assets when overlay is dismissed
          await checkForRetriesOnOverlayDismiss();
        }, 1500); // Show success state for 1.5 seconds
        return () => clearTimeout(timer);
      }
      
      // If auto-tagging has started but we haven't seen it active yet, wait
      // This handles the race condition where useEffect runs before setAutoTaggingAssets updates
      if (hasStartedAutoTagging && !hasSeenAutoTaggingActive.current && autoTaggingAssets.size === 0) {
        console.log('[Library] Auto-tagging started but not active yet, waiting for state update...');
        // Don't hide yet - wait for the next render when autoTaggingAssets.size becomes > 0
        return;
      }
      
      // Auto-tagging hasn't started yet (either no photos imported or no auto-tagging needed)
      if (!hasStartedAutoTagging) {
        console.log('[Library] Import complete, waiting for auto-tagging to start...');
        let hideTimer: ReturnType<typeof setTimeout> | null = null;
        const checkTimer = setTimeout(() => {
          // If still no auto-tagging after delay, it means no assets were queued
          // (maybe edgeBase is not set, no assets were inserted, or all imports failed)
          if (!hasStartedAutoTagging && autoTaggingAssets.size === 0) {
            console.log('[Library] No auto-tagging needed, hiding overlay in 1.5s');
            hideTimer = setTimeout(async () => {
              setIsImporting(false);
              setImportProgress({ total: 0, imported: 0, currentPhoto: 0 });
              
              // Check for pending/failed assets when overlay is dismissed
              await checkForRetriesOnOverlayDismiss();
            }, 1500);
          }
        }, 1000); // Wait 1 second for auto-tagging to start
        return () => {
          clearTimeout(checkTimer);
          if (hideTimer) {
            clearTimeout(hideTimer);
          }
        };
      }
    }
  }, [isImporting, autoTaggingAssets.size, importProgress.imported, importProgress.total, hasStartedAutoTagging, checkForRetriesOnOverlayDismiss]);

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

    // Optimized initialization: load campaign first (blocking), then tags (non-blocking)
    const initializeData = async () => {
      try {
        // Load campaign first (required for assets)
        const campaignIdResult = await getDefaultCampaignId(userId);

        if (campaignIdResult) {
          setCampaignId(campaignIdResult);
        } else {
          console.error('[LibraryScreen] Failed to initialize campaign: No campaign ID returned');
          setIsLoading(false);
          return;
        }

        // Load tags in background (non-blocking) - don't await, let it complete asynchronously
        // This allows assets to load immediately while tags populate in the background
        getAllAvailableTags(userId)
          .then((tagsResult) => {
            setAllAvailableTags(tagsResult);
          })
          .catch((error) => {
            console.warn('[LibraryScreen] Failed to load tags (non-critical):', error);
            // Set empty tags array as fallback - tags will be populated as assets load
            setAllAvailableTags([]);
          });
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
    // Optimized: Batch URL generation and use efficient mapping
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('id, campaign_id, storage_path, source, tags, location, created_at, auto_tag_status')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500); // Reduced initial limit for faster load, FlatList handles scrolling

    if (assetError) {
      console.error('[Library] asset fetch failed', assetError);
    } else if (assetData) {
      // Batch process URLs and tags for better performance
      const mapped = (assetData as Asset[]).map((asset) => {
        const { data } = supabase?.storage.from('assets').getPublicUrl(asset.storage_path) || { data: { publicUrl: '' } };
        const tags = Array.isArray(asset.tags) ? (asset.tags as string[]) : [];
        
        // Check if we have a recent optimistic update for this asset
        // If so, use optimistic tags instead of DB tags (they're more recent)
        const optimisticUpdate = optimisticTagUpdatesRef.current.get(asset.id);
        const isRecentOptimisticUpdate = optimisticUpdate && (Date.now() - optimisticUpdate.timestamp < 10000);
        const finalTags = isRecentOptimisticUpdate ? optimisticUpdate.tags : tags;
        
        if (isRecentOptimisticUpdate && JSON.stringify(tags.sort()) !== JSON.stringify(optimisticUpdate.tags.sort())) {
          console.log(`[Library] loadAssets: Using optimistic tags for asset ${asset.id}`, {
            dbTags: tags,
            optimisticTags: optimisticUpdate.tags
          });
        }
        
        return { ...asset, publicUrl: data.publicUrl, tags: finalTags } as Asset;
      });
      
      // Batch state update - set assets and autoTaggingAssets together
      setAssets(mapped);
      
      // Sync pending assets with autoTaggingAssets Set to show loading indicators
      setAutoTaggingAssets((prev) => {
        const next = new Set(prev);
        mapped.forEach(asset => {
          if (asset.auto_tag_status === 'pending') {
            next.add(asset.id);
          } else if (asset.auto_tag_status === 'completed' || asset.auto_tag_status === 'failed') {
            next.delete(asset.id);
          }
        });
        return next;
      });

      // Extract tags efficiently using flatMap and Set (faster than nested loops)
      // Defer tag extraction to avoid blocking UI update
      if (mapped.length > 0) {
        // Use requestIdleCallback-like approach - defer non-critical work
        setTimeout(() => {
          const extractedTags = new Set<string>();
          for (const asset of mapped) {
            if (Array.isArray(asset.tags) && asset.tags.length > 0) {
              for (const tag of asset.tags) {
                if (tag?.trim()) {
                  extractedTags.add(tag.trim());
                }
              }
            }
          }

          // Merge with existing tags (update state only if new tags found)
          if (extractedTags.size > 0) {
            setAllAvailableTags((prevTags) => {
              const existingTagsSet = new Set(prevTags);
              extractedTags.forEach((tag) => existingTagsSet.add(tag));
              const mergedTags = Array.from(existingTagsSet).sort();
              // Only update if tags actually changed (avoid unnecessary re-renders)
              if (mergedTags.length !== prevTags.length || mergedTags.some((tag, i) => tag !== prevTags[i])) {
                return mergedTags;
              }
              return prevTags;
            });
          }
        }, 0); // Defer to next tick
      }
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

  // Sync activeAsset with filteredAssets when it updates (for background refreshes)
  // This ensures TagModal shows the latest tags even after background refresh
  // BUT: Don't overwrite if we just made an optimistic tag update
  useEffect(() => {
    if (activeAsset && isTagModalOpen) {
      // Find updated asset in filteredAssets
      const updatedAsset = filteredAssets.find(a => a.id === activeAsset.id);
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
            console.log('[Library] Sync check - optimistic update exists', {
              assetId: activeAsset.id,
              optimisticTags: optimisticUpdate.tags,
              dbTags: updatedAsset.tags,
              match: optimisticTagsStr === dbTagsStr
            });
            if (optimisticTagsStr === dbTagsStr) {
              // DB update completed successfully, safe to sync
              console.log('[Library] ✅ Syncing activeAsset - DB update confirmed, tags match optimistic update');
              setActiveAsset(updatedAsset);
              // Clear optimistic tracking since DB is now in sync
              optimisticTagUpdatesRef.current.delete(activeAsset.id);
            } else {
              // DB has different tags - might be stale data, don't overwrite optimistic update
              console.log('[Library] ⚠️ Skipping sync - optimistic update in progress, DB tags differ. Keeping optimistic tags.');
            }
          } else {
            // No recent optimistic update, safe to sync normally
            console.log('[Library] Syncing activeAsset with updated data from filteredAssets (no optimistic update)');
            setActiveAsset(updatedAsset);
          }
        }
      }
    }
  }, [filteredAssets, isTagModalOpen]); // Removed activeAsset?.id to allow updates when tags change

  // Parse existing asset IDs from params (when adding to existing story)
  const existingAssetIds = useMemo(() => {
    const existingParam = params.existingAssetIds;
    if (!existingParam) {
      return [];
    }
    return existingParam.split(',').filter((id) => id.trim().length > 0);
  }, [params.existingAssetIds]);

  const isAddingToStory = existingAssetIds.length > 0;
  const isStoryMode = isAddingToStory || (params.storyName !== undefined && params.storyName !== null);

  // Auto-enable selection mode when navigating from story builder (creating new or adding to existing)
  useEffect(() => {
    if (isStoryMode) {
      setIsSelectionMode(true);
    }
  }, [isStoryMode]);

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

  const processImport = useCallback(async (
    assetsToImport: ImagePicker.ImagePickerAsset[],
    compressedImages: Array<{ uri: string; width: number; height: number; size: number }>,
    imageHashes: string[],
    skipDuplicates: boolean,
    locations: (string | null)[] = []
  ) => {
    if (!campaignId || !supabase || !session?.user?.id) {
      return;
    }

    const userId = session.user.id;
    setIsImporting(true);
    setImportProgress({ total: assetsToImport.length, imported: 0, currentPhoto: 0 });
    setSuccessfullyAutoTaggedCount(0); // Reset count for new import session

    // Track newly imported asset IDs for this import session
    const importedIds = new Set<string>();

    const errors: string[] = [];
    let successCount = 0;
    let failCount = 0;
    
    // Collect all successfully imported assets for batch tagging
    const importedAssetsForTagging: Array<{ assetId: string; publicUrl: string; onSuccess?: (result: { assetId: string; tags: string[] }) => void; onError?: (error: Error) => void; onRetryStart?: (assetId: string) => void }> = [];

    for (let i = 0; i < assetsToImport.length; i++) {
      // Skip duplicates if user chose to skip them
      if (skipDuplicates && pendingImportData?.duplicateIndices.includes(i)) {
        console.log(`[Library] Skipping duplicate photo ${i + 1}`);
        continue;
      }

      const pickerAsset = assetsToImport[i];
      const compressedImage = compressedImages[i];
      
      try {
        setImportProgress(prev => ({ ...prev, currentPhoto: i + 1 }));
        console.log(`[Library] Uploading photo ${i + 1}/${assetsToImport.length}...`);

        // Use location extracted BEFORE compression (EXIF data is lost during compression)
        const locationValue = locations[i] || null;
        if (locationValue) {
          console.log(`[Library] Using pre-extracted location for photo ${i + 1}: ${locationValue}`);
        }

        // Prepare initial tags array (location is now stored in separate column)
        const initialTags: string[] = [];

        // Fetch compressed image data
        let arrayBuffer: ArrayBuffer;
        try {
          const fetchResponse = await fetch(compressedImage.uri);
          if (!fetchResponse.ok) {
            throw new Error(`Failed to read compressed image: ${fetchResponse.status} ${fetchResponse.statusText}`);
          }
          arrayBuffer = await fetchResponse.arrayBuffer();
        } catch (fetchError) {
          const errorMsg = `Failed to read compressed image file: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
          console.error(`[Library] ${errorMsg}`);
          errors.push(`Photo ${i + 1}: ${errorMsg}`);
          failCount++;
          continue;
        }

        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const fileName = `${uniqueSuffix}.jpg`;
        // Store directly in A2 path (ai/ folder) - A2 is now the only version
        const filePath = `users/${userId}/campaigns/${campaignId}/ai/${fileName}`;

        // Upload compressed image to storage
        const { error: uploadError } = await supabase.storage.from('assets').upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        
        if (uploadError) {
          const errorMsg = uploadError.message || 'Storage upload failed';
          console.error(`[Library] Storage upload failed for photo ${i + 1}:`, uploadError);
          errors.push(`Photo ${i + 1}: ${errorMsg}`);
          failCount++;
          continue;
        }

        // Insert into database with user_id and file_hash
        // Include location in separate column if extracted from EXIF
        const insertData: any = {
          user_id: userId,
          campaign_id: campaignId,
          storage_path: filePath,
          source: 'local',
          tags: initialTags,
        };

        // Add location if available (stored in separate column, not as tag)
        if (locationValue) {
          insertData.location = locationValue;
        }

        // Add file_hash if available (column may not exist yet)
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
            console.warn('[Library] file_hash column does not exist, inserting without hash');
            const retryInsertData: any = {
              user_id: userId,
              campaign_id: campaignId,
              storage_path: filePath,
              source: 'local',
              tags: initialTags,
            };
            if (locationValue) {
              retryInsertData.location = locationValue;
            }
            const { data: retryInserted, error: retryError } = await supabase
              .from('assets')
              .insert(retryInsertData)
              .select('*')
              .single();

            if (retryError) {
              const errorMsg = retryError.message || 'Database insert failed';
              console.error(`[Library] Database insert failed for photo ${i + 1}:`, retryError);
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

            // Success without hash
            successCount++;
            setImportProgress(prev => ({ ...prev, imported: successCount }));
            importedIds.add(retryInserted.id);
            console.log(`[Library] ✅ Successfully imported photo ${i + 1} (without hash)`);
            
            // Refresh assets incrementally
            if (successCount % 3 === 0 || successCount === assetsToImport.length) {
              await loadAssets();
            }
            
            // Collect asset for batch tagging (will trigger after all uploads complete)
            const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
            if (edgeBase && retryInserted) {
              // Verify asset exists in database before queuing (avoid race condition)
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const { data: verifyAsset } = await supabase
                .from('assets')
                .select('id')
                .eq('id', retryInserted.id)
                .single();
              
              if (!verifyAsset) {
                console.warn(`[Library] Asset ${retryInserted.id} not found after insert, skipping auto-tag`);
                continue;
              }
              
              const publicUrl = supabase.storage.from('assets').getPublicUrl(filePath).data.publicUrl;
              const assetId = retryInserted.id;
              
              importedAssetsForTagging.push({
                assetId,
                publicUrl,
                onSuccess: (result) => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(assetId);
                    return next;
                  });
                  setSuccessfullyAutoTaggedCount((prev) => prev + 1);
                  setTimeout(async () => {
                    await loadAssets();
                  }, 1000);
                },
                onError: (error) => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.delete(assetId);
                    return next;
                  });
                },
              });
              
              // Mark as pending for visual feedback
              setAutoTaggingAssets((prev) => new Set(prev).add(assetId));
              setHasStartedAutoTagging(true);
            }
            continue;
          }

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
        importedIds.add(inserted.id);
        console.log(`[Library] ✅ Successfully imported photo ${i + 1}`);
        setImportProgress(prev => ({ ...prev, imported: successCount }));
        
        // Refresh assets incrementally to show photos as they're imported
        // Only refresh every 3 photos or on last photo to avoid too many updates
        if (successCount % 3 === 0 || successCount === assetsToImport.length) {
          await loadAssets();
        }

        // Trigger auto-tagging
        const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
        if (edgeBase && inserted) {
          // Verify asset exists in database before queuing (avoid race condition)
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const { data: verifyAsset } = await supabase
            .from('assets')
            .select('id')
            .eq('id', inserted.id)
            .single();
          
          if (!verifyAsset) {
            console.warn(`[Library] Asset ${inserted.id} not found after insert, skipping auto-tag`);
            continue;
          }
          
          const publicUrl = supabase.storage.from('assets').getPublicUrl(filePath).data.publicUrl;
          const assetId = inserted.id;
          
          // Collect asset for batch tagging (will trigger after all uploads complete)
          importedAssetsForTagging.push({
            assetId,
            publicUrl,
            onSuccess: (result) => {
              setAutoTaggingAssets((prev) => {
                const next = new Set(prev);
                next.delete(assetId);
                return next;
              });
              setSuccessfullyAutoTaggedCount((prev) => prev + 1);
              // Show temporary success indicator (only if not already showing)
              setRecentlyTaggedAssets((prev) => {
                if (prev.has(assetId)) {
                  // Already showing, don't add again (prevents double flash)
                  return prev;
                }
                const next = new Set(prev);
                next.add(assetId);
                return next;
              });
              // Remove success indicator after 5.5 seconds (slightly longer than animation to ensure cleanup)
              setTimeout(() => {
                setRecentlyTaggedAssets((prev) => {
                  const next = new Set(prev);
                  next.delete(assetId);
                  return next;
                });
              }, 5500);
              setTimeout(async () => {
                await loadAssets();
              }, 1000);
            },
            onError: (error) => {
              setAutoTaggingAssets((prev) => {
                const next = new Set(prev);
                next.delete(assetId);
                return next;
              });
            },
            onRetryStart: (retryAssetId) => {
              // Show notification when background retry starts
              setAutoTaggingAssets((prev) => {
                const next = new Set(prev);
                next.add(retryAssetId);
                return next;
              });
              // Check if this asset was failed before retrying
              const retryAsset = assets.find(a => a.id === retryAssetId);
              const wasFailed = retryAsset?.auto_tag_status === 'failed';
              showRetryNotificationBanner(1, wasFailed ? 1 : 0);
            },
          });
          
          // Mark as pending for visual feedback
          setAutoTaggingAssets((prev) => new Set(prev).add(assetId));
          setHasStartedAutoTagging(true);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Library] Unexpected error importing photo ${i + 1}:`, error);
        errors.push(`Photo ${i + 1}: ${errorMsg}`);
        failCount++;
      }
    }

    // Final refresh to ensure all photos are shown
    await loadAssets();
    
    // Batch trigger auto-tagging for all imported assets
    // This is more efficient than individual calls, especially for 20+ assets
    // The queue will use OpenAI Batch API for 20+ images (50% cost savings)
    if (importedAssetsForTagging.length > 0) {
      console.log(`[Library] Triggering batch auto-tagging for ${importedAssetsForTagging.length} imported assets`);
      
      // Use queueBulkAutoTag for efficient batch processing
      // This will send all images in a single batch to OpenAI (uses Batch API for 20+)
      queueBulkAutoTag(importedAssetsForTagging);
    }
    
    // Store the newly imported asset IDs for retry notification
    const importedIdsArray = Array.from(importedIds);
    setNewlyImportedAssetIds(importedIds);
    
    // Overlay will auto-dismiss via onDismiss callback
    // Don't manually set isImporting to false - let overlay handle it
    
    // Check for pending/failed assets from THIS import session and show notification when overlay is dismissed
    const checkForRetries = async () => {
      if (campaignId && supabase && importedIdsArray.length > 0) {
        console.log('[Library] Checking for pending/failed assets from current import session...');
        console.log('[Library] Newly imported asset IDs:', importedIdsArray);
        
        // Check database for the specific assets we just imported
        const { data: importedAssets, error: importedError } = await supabase
          .from('assets')
          .select('id, tags, auto_tag_status')
          .in('id', importedIdsArray);
        
        if (importedError) {
          console.error('[Library] Error fetching imported assets:', importedError);
        }
        
        // Count pending assets + failed assets with no tags from THIS import session
        const pendingCount = (importedAssets || []).filter((asset: any) => asset.auto_tag_status === 'pending').length;
        const failedCount = (importedAssets || []).filter((asset: any) => 
          asset.auto_tag_status === 'failed' && (!asset.tags || asset.tags.length === 0)
        ).length;
        const retryCount = pendingCount + failedCount;
        
        console.log('[Library] Retry check results (current import only):', {
          pendingCount,
          failedCount,
          retryCount,
        });
        
        if (retryCount > 0) {
          console.log(`[Library] ✅ Showing retry notification for ${retryCount} asset(s) from current import`);
          // Show notification directly (inline to avoid dependency on function defined later)
          setRetryCount(retryCount);
          setFailedCount(failedCount); // Track failed count
          setShowRetryNotification(true);
          retryNotificationOpacity.setValue(0);
          retryNotificationTranslateY.setValue(-60);
          
          setTimeout(() => {
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
            ]).start();
            
            setTimeout(() => {
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
                setShowRetryNotification(false);
              });
            }, 3000);
          }, 50);
        } else {
          console.log('[Library] ❌ No assets from current import need retry, skipping notification');
        }
      } else {
        console.log('[Library] ⚠️  Cannot check for retries:', {
          hasCampaignId: !!campaignId,
          hasSupabase: !!supabase,
          importedIdsArrayLength: importedIdsArray.length,
        });
      }
    };
    
    // Delay the check to ensure overlay is dismissed and database is consistent
    setTimeout(checkForRetries, 1500);

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
      console.log(`[Library] ✅ Successfully imported ${successCount} photo${successCount > 1 ? 's' : ''}`);
    }
  }, [campaignId, loadAssets, session, pendingImportData]);

  const handleImport = useCallback(async () => {
    if (!campaignId) {
      Alert.alert('Error', 'Library not initialized. Please try again.');
      return;
    }

    if (!supabase) {
      Alert.alert('Supabase unavailable', 'Connect Supabase to import assets.');
      return;
    }

    // Strongly encourage tag setup before import (but allow skipping)
    let shouldProceedWithImport = true;
    if (session?.user?.id) {
      const { hasTagsSetUp } = await import('@/utils/tagSetup');
      const hasTags = await hasTagsSetUp(session.user.id);
      
      if (!hasTags) {
        // Show alert and wait for user choice
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Set Up Tags First',
            'Tags are the core of StoryStack. Creating tags before importing photos ensures your photos can be properly organized and automatically categorized. You can skip this, but we strongly recommend setting up tags first.',
            [
              { 
                text: 'Skip for Now', 
                style: 'cancel',
                onPress: () => {
                  shouldProceedWithImport = true;
                  resolve();
                }
              },
              {
                text: 'Set Up Tags',
                style: 'default',
                onPress: () => {
                  shouldProceedWithImport = false;
                  router.push('/tag-management?setup=true');
                  resolve();
                },
              },
            ]
          );
        });
        
        // If user chose to set up tags, don't proceed with import
        if (!shouldProceedWithImport) {
          return;
        }
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 100,
        quality: 1,
        exif: true, // Include EXIF data for location extraction
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      if (!session?.user?.id) {
        Alert.alert('Error', 'You must be signed in to import photos.');
        return;
      }
      const userId = session.user.id;

      // Show import overlay IMMEDIATELY when photos are selected
      setIsImporting(true);
      setImportProgress({ total: result.assets.length, imported: 0, currentPhoto: 0 });

      // Step 1: Process and compress all images in batches
      console.log('[Library] Processing and compressing images for duplicate detection...');
      const compressedImages: Array<{ uri: string; width: number; height: number; size: number }> = [];
      const imageHashes: string[] = [];

      const BATCH_SIZE = 5; // Process 5 images at a time to avoid blocking UI

      // Extract locations BEFORE compression (EXIF data is lost during compression)
      const locations: (string | null)[] = [];
      console.log('[Library] Extracting locations from EXIF before compression...');
      for (let j = 0; j < result.assets.length; j++) {
        try {
          const locationTag = await extractLocationFromEXIF(result.assets[j]);
          locations[j] = locationTag;
          if (locationTag) {
            console.log(`[Library] ✅ Extracted location for photo ${j + 1}: ${locationTag}`);
          } else {
            // Log EXIF data for debugging
            const exif = result.assets[j].exif;
            console.log(`[Library] ⚠️  No location found for photo ${j + 1}. EXIF data:`, exif ? JSON.stringify(exif).substring(0, 200) : 'No EXIF data');
          }
        } catch (locationError) {
          console.warn(`[Library] Failed to extract location for photo ${j + 1}:`, locationError);
          locations[j] = null;
        }
      }

      for (let i = 0; i < result.assets.length; i += BATCH_SIZE) {
        const batch = result.assets.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.all(
          batch.map(async (pickerAsset, batchIndex) => {
            const index = i + batchIndex;
            
            // Convert unsupported formats to JPEG
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
                console.error(`[Library] Failed to convert photo ${index + 1}:`, convertError);
                // Continue with original URI
              }
            }

            // Compute hash from ORIGINAL image (before compression)
            // This ensures consistent hashing even if compression parameters differ
            // or if compression algorithm changes (A1 vs A2)
            let hash = '';
            try {
              hash = await computeImageHash(imageUri);
              console.log(`[Library] Computed hash from original image for photo ${index + 1}`);
            } catch (hashError) {
              console.warn(`[Library] Failed to compute hash for photo ${index + 1}:`, hashError);
            }
            
            // Compress image to A2 format (1024px long edge for AI tagging) AFTER computing hash
            try {
              const compressed = await compressImageForAI(imageUri);
              return { compressed, hash, index };
            } catch (compressError) {
              console.error(`[Library] Failed to compress photo ${index + 1}:`, compressError);
              // If compression fails but we have a hash, we can still proceed
              // (though upload might fail if file is too large)
              if (!hash) {
                return null; // Skip if both hash and compression failed
              }
              // Return with empty compressed object if hash exists (will fail gracefully later)
              return { compressed: { uri: imageUri, width: 0, height: 0, size: 0 }, hash, index };
            }
          })
        );

        // Store results in correct order
        batchResults.forEach((result) => {
          if (result) {
            compressedImages[result.index] = result.compressed;
            imageHashes[result.index] = result.hash;
          }
        });

        // Log progress
        console.log(`[Library] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(result.assets.length / BATCH_SIZE)}`);
      }

      // Filter out any null results (failed compressions) and maintain order
      const validCompressedImages = compressedImages.filter(Boolean) as Array<{ uri: string; width: number; height: number; size: number }>;
      const validHashes = imageHashes.filter(h => h !== '');

      if (validCompressedImages.length === 0) {
        Alert.alert('Error', 'No photos could be processed for import.');
        setIsImporting(false);
        setImportProgress({ total: 0, imported: 0, currentPhoto: 0 });
        return;
      }

      // Step 2: Check for duplicates
      console.log('[Library] Checking for duplicates...');
      const duplicateIndices = await checkForDuplicates(userId, validHashes);

      if (duplicateIndices.length > 0) {
        // Show duplicate dialog
        setPendingImportData({
          assets: result.assets.slice(0, validCompressedImages.length),
          hashes: imageHashes,
          compressedImages: validCompressedImages,
          duplicateIndices,
          locations: locations.slice(0, validCompressedImages.length), // Include locations
        });
        setShowDuplicateDialog(true);
        return;
      }

      // No duplicates found, proceed with import
      // Pass locations array (extracted before compression)
      await processImport(result.assets.slice(0, validCompressedImages.length), validCompressedImages, imageHashes, false, locations.slice(0, validCompressedImages.length));
    } catch (error) {
      console.error('[Library] Import failed with unexpected error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Import Failed', `An unexpected error occurred: ${errorMessage}`);
      setIsImporting(false);
      setImportProgress(prev => {
        if (prev.imported === 0 && prev.total > 0) {
          return { ...prev, imported: prev.total };
        }
        return prev;
      });
    }
  }, [campaignId, loadAssets, session, processImport, showRetryNotificationBanner]);

  // Periodic check for pending/failed assets (every 30 seconds) to retry background processing
  // Only retry assets from the most recent import session
  useEffect(() => {
    if (!supabase) return;

    const interval = setInterval(async () => {
      // Only check newly imported assets, not all assets in the campaign
      if (newlyImportedAssetIds.size === 0) {
        return; // No recent imports to retry
      }
      
      const importedIdsArray = Array.from(newlyImportedAssetIds);
      
      // Check for pending/failed assets from the recent import session
      const { data: importedAssets, error: importedError } = await supabase
        .from('assets')
        .select('*')
        .in('id', importedIdsArray);
      
      if (importedError) {
        console.error('[Library] Error fetching imported assets for periodic retry check:', importedError);
        return;
      }
      
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

      // Count failed vs pending separately
      const failedAssets = assetsNeedingRetry.filter((asset: any) => asset.auto_tag_status === 'failed');
      const failedCount = failedAssets.length;

      if (assetsNeedingRetry.length > 0) {
        console.log(`[Library] Found ${assetsNeedingRetry.length} assets from recent import needing retry (${failedCount} failed), re-queuing...`);
        
        // Show notification to user with failed count
        showRetryNotificationBanner(assetsNeedingRetry.length, failedCount);
        
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
                    // Show temporary success indicator (only if not already showing)
                    setRecentlyTaggedAssets((prev) => {
                      if (prev.has(asset.id)) {
                        // Already showing, don't add again (prevents double flash)
                        return prev;
                      }
                      const next = new Set(prev);
                      next.add(asset.id);
                      return next;
                    });
                    // Remove success indicator after 5.5 seconds (consistent with other success indicators)
                    setTimeout(() => {
                      setRecentlyTaggedAssets((prev) => {
                        const next = new Set(prev);
                        next.delete(asset.id);
                        return next;
                      });
                    }, 5500);
                    await loadAssets();
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
                    await loadAssets();
                  },
                onRetryStart: (assetId) => {
                  setAutoTaggingAssets((prev) => {
                    const next = new Set(prev);
                    next.add(assetId);
                    return next;
                  });
                  // Check if this asset was failed before retrying
                  const asset = assets.find(a => a.id === assetId);
                  const wasFailed = asset?.auto_tag_status === 'failed';
                  showRetryNotificationBanner(1, wasFailed ? 1 : 0);
                  loadAssets();
                },
                });
              });
          }
        });
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [supabase, autoTaggingAssets, loadAssets, newlyImportedAssetIds, showRetryNotificationBanner]);

  // Check for failed/pending assets when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!supabase || newlyImportedAssetIds.size === 0) return;

      const checkForRetries = async () => {
        const importedIdsArray = Array.from(newlyImportedAssetIds);
        
        const { data: importedAssets, error } = await supabase
          .from('assets')
          .select('id, tags, auto_tag_status')
          .in('id', importedIdsArray);
        
        if (error || !importedAssets) return;
        
        // Filter assets that need retry (pending or failed with no tags)
        const assetsNeedingRetry = importedAssets.filter((asset: any) => {
          const hasNoTags = !asset.tags || asset.tags.length === 0;
          const isPendingOrFailed = asset.auto_tag_status === 'pending' || asset.auto_tag_status === 'failed';
          const notCurrentlyProcessing = !autoTaggingAssets.has(asset.id);
          return hasNoTags && isPendingOrFailed && notCurrentlyProcessing;
        });

        if (assetsNeedingRetry.length > 0) {
          const failedCount = assetsNeedingRetry.filter((asset: any) => asset.auto_tag_status === 'failed').length;
          console.log(`[Library] Screen focused: Found ${assetsNeedingRetry.length} assets needing retry (${failedCount} failed)`);
          showRetryNotificationBanner(assetsNeedingRetry.length, failedCount);
        }
      };

      // Small delay to avoid checking immediately on focus
      const timeoutId = setTimeout(checkForRetries, 500);
      return () => clearTimeout(timeoutId);
    }, [supabase, newlyImportedAssetIds, autoTaggingAssets, showRetryNotificationBanner])
  );

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

  // Special constant for "no tags" filter
  const NO_TAGS_FILTER = '__NO_TAGS__' as TagVocabulary;
  const LOCATION_PREFIX = '__LOCATION__' as TagVocabulary;

  // Helper to check if a filter is a location filter
  const isLocationFilter = (value: TagVocabulary): boolean => {
    return typeof value === 'string' && value.startsWith(LOCATION_PREFIX);
  };

  // Extract location name from location filter
  const getLocationName = (locationFilter: TagVocabulary): string => {
    return locationFilter.replace(LOCATION_PREFIX, '');
  };

  // Extract unique locations from assets
  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    assets.forEach((asset) => {
      if (asset.location && asset.location.trim()) {
        locations.add(asset.location.trim());
      }
    });
    return Array.from(locations).sort();
  }, [assets]);

  // Calculate location counts (how many photos have each location)
  const locationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    assets.forEach((asset) => {
      if (asset.location && asset.location.trim()) {
        const location = asset.location.trim();
        counts.set(location, (counts.get(location) || 0) + 1);
      }
    });
    return counts;
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
    // Add count for "no tags" filter
    const noTagsCount = assets.filter((asset) => !asset.tags || asset.tags.length === 0).length;
    counts.set(NO_TAGS_FILTER, noTagsCount);
    return counts;
  }, [assets]);

  // Filter assets using OR logic: show photos that have ANY of the selected tags or locations
  // Special handling for "no tags" filter and location filters
  const filteredAssets = useMemo(() => {
    if (!selectedTags.length) return assets;
    
    const hasNoTagsFilter = selectedTags.includes(NO_TAGS_FILTER);
    const locationFilters = selectedTags.filter((tag) => isLocationFilter(tag));
    const regularTags = selectedTags.filter((tag) => tag !== NO_TAGS_FILTER && !isLocationFilter(tag));
    
    const selectedLocations = locationFilters.map((filter) => getLocationName(filter));
    
    // If only "no tags" filter selected
    if (hasNoTagsFilter && regularTags.length === 0 && selectedLocations.length === 0) {
      return assets.filter((asset) => !asset.tags || asset.tags.length === 0);
    }
    
    // Filter assets that match any of the selected criteria (OR logic)
    return assets.filter((asset) => {
      // Check if asset matches location filter
      const matchesLocation = selectedLocations.length > 0 && 
        asset.location && 
        selectedLocations.includes(asset.location.trim());
      
      // Check if asset matches tag filter
      const hasNoTags = !asset.tags || asset.tags.length === 0;
      const matchesNoTagsFilter = hasNoTagsFilter && hasNoTags;
      const matchesRegularTags = regularTags.length > 0 && regularTags.some((tag) => asset.tags.includes(tag));
      const matchesTags = matchesNoTagsFilter || matchesRegularTags;
      
      // OR logic: match location OR match tags
      // If no filters of a type are selected, that type doesn't restrict results
      const locationMatches = selectedLocations.length === 0 || matchesLocation;
      const tagMatches = (hasNoTagsFilter && regularTags.length === 0) ? matchesNoTagsFilter : 
                        (regularTags.length === 0 && !hasNoTagsFilter) ? true : 
                        matchesTags;
      
      // Asset matches if it satisfies location filters OR tag filters
      // If both types are selected, asset must match at least one type
      if (selectedLocations.length > 0 && (hasNoTagsFilter || regularTags.length > 0)) {
        return matchesLocation || matchesTags;
      }
      
      // Only one type of filter selected
      return locationMatches && tagMatches;
    });
  }, [assets, selectedTags]);

  const toggleTagFilter = (tag: TagVocabulary) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };


  const toggleAssetSelection = (asset: Asset) => {
    // Enter selection mode if not already in it
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    
    setSelectedAssets((prev) => {
      const exists = prev.some((a) => a.id === asset.id);
      if (exists) {
        // Deselecting
        return prev.filter((a) => a.id !== asset.id);
      } else {
        // Selecting
        return [...prev, asset];
      }
    });
  };

  // Handle selection mode exit when all items are deselected
  // Only exit if we had items selected before (not when first entering selection mode)
  const prevSelectedCountRef = useRef(selectedAssets.length);
  useEffect(() => {
    const hadItemsBefore = prevSelectedCountRef.current > 0;
    const hasNoItemsNow = selectedAssets.length === 0;
    
    // Only exit if we had items before and now have none (user deselected all)
    if (isSelectionMode && hadItemsBefore && hasNoItemsNow) {
      setIsSelectionMode(false);
    }
    
    prevSelectedCountRef.current = selectedAssets.length;
  }, [selectedAssets.length, isSelectionMode]);

  const handleEnterSelectionMode = () => {
    // Optimize: Set state immediately, haptic is handled in button
    setIsSelectionMode(true);
  };

  const handleCancelSelection = () => {
    // Smooth exit with haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // If we're in story selection mode, navigate back to story builder
    if (isStoryMode) {
      router.back();
      return;
    }
    
    // Clear selection and exit mode simultaneously
    setSelectedAssets([]);
    setIsSelectionMode(false);
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
    
    // Clear selection when closing modal (especially important for multi-edit mode)
    // Selection is also cleared in updateTags, but this ensures it's cleared even if modal is closed without saving
    setSelectedAssets([]);
    
    // Refresh assets in background (don't block UI)
    // This ensures manual auto-tagging triggered in TagModal is visible
    loadAssets().catch((error) => {
      console.error('[Library] Failed to refresh assets after modal close:', error);
    });
  };

  // Callback for manual retagging success - show green checkmark
  const handleManualAutoTagSuccess = useCallback((assetId: string) => {
    setRecentlyTaggedAssets((prev) => {
      if (prev.has(assetId)) {
        // Already showing, don't add again (prevents double flash)
        return prev;
      }
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });
    // Remove success indicator after 5.5 seconds
    setTimeout(() => {
      setRecentlyTaggedAssets((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }, 5500);
  }, []);

  const updateTags = async (newTags: TagVocabulary[], location?: string | null) => {
    if (!activeAssetsForTagging.length || !supabase) {
      return;
    }

    try {
      const assetIds = activeAssetsForTagging.map((a) => a.id);
      
      if (activeAssetsForTagging.length === 1) {
        // Single asset: replace tags and location (normal behavior)
        const assetId = assetIds[0];
        console.log(`[Library] Updating tags for asset ${assetId}:`, newTags);
        if (location !== undefined) {
          console.log(`[Library] Updating location for asset ${assetId}:`, location);
        }
        
        const updateData: any = { tags: newTags };
        if (location !== undefined) {
          updateData.location = location;
        }
        
        const { data, error } = await supabase
          .from('assets')
          .update(updateData)
          .eq('id', assetId)
          .select('id, tags, location')
          .single();

        if (error) {
          console.error('[Library] ❌ update tags failed', error);
          Alert.alert('Update failed', 'Unable to update tags.');
          return;
        }
        
        // Verify the update actually persisted
        if (!data || JSON.stringify(data.tags?.sort()) !== JSON.stringify(newTags.sort())) {
          console.error('[Library] ❌ Database update verification failed!', {
            expected: newTags,
            received: data?.tags
          });
          Alert.alert('Update failed', 'Tags were not saved correctly. Please try again.');
          return;
        }
        
        // Verify location was saved correctly
        if (location !== undefined && data.location !== location) {
          console.error('[Library] ❌ Location update verification failed!', {
            expected: location,
            received: data?.location
          });
          Alert.alert('Update failed', 'Location was not saved correctly. Please try again.');
          return;
        }
        
        console.log(`[Library] ✅ Tags successfully saved to database for asset ${assetId}:`, data.tags);
        if (location !== undefined) {
          console.log(`[Library] ✅ Location successfully saved to database for asset ${assetId}:`, data.location);
        }
        
        // Track this optimistic update - prevent sync useEffect from overwriting for 10 seconds
        optimisticTagUpdatesRef.current.set(assetId, {
          tags: newTags,
          timestamp: Date.now()
        });
        
        // Optimistically update activeAsset immediately so TagModal shows new tags
        if (activeAsset && activeAsset.id === assetId) {
          console.log(`[Library] Optimistically updating activeAsset with tags:`, newTags);
          const updatedAsset = { ...activeAsset, tags: newTags };
          if (location !== undefined) {
            updatedAsset.location = location;
          }
          setActiveAsset(updatedAsset);
        }
        // Also update activeAssetsForTagging
        setActiveAssetsForTagging((prev) => 
          prev.map(a => {
            if (a.id === assetId) {
              const updated = { ...a, tags: newTags };
              if (location !== undefined) {
                updated.location = location;
              }
              return updated;
            }
            return a;
          })
        );
        
        // Optimistically update assets array so filteredAssets has correct tags
        // This prevents sync useEffect from overwriting with stale data
        setAssets((prev) => {
          const updated = prev.map(a => {
            if (a.id === assetId) {
              const updatedAsset = { ...a, tags: newTags };
              if (location !== undefined) {
                updatedAsset.location = location;
              }
              return updatedAsset;
            }
            return a;
          });
          console.log(`[Library] Optimistically updated assets array. Asset ${assetId} now has tags:`, 
            updated.find(a => a.id === assetId)?.tags);
          return updated;
        });
        
        // Don't call loadAssets() immediately - it would overwrite our optimistic update
        // The database update has already succeeded and been verified, so tags are persisted
        // Natural refresh cycles (navigate away/back, pull-to-refresh) will sync eventually
        // Clean up optimistic update tracking after 10 seconds
        setTimeout(() => {
          optimisticTagUpdatesRef.current.delete(assetId);
          console.log(`[Library] Cleaned up optimistic update tracking for asset ${assetId}`);
        }, 10000);
      } else {
        // Multiple assets: merge tags (add new tags to existing tags)
        // Fetch current tags for all assets
        const { data: currentAssets, error: fetchError } = await supabase
          .from('assets')
          .select('id, tags, location')
          .in('id', assetIds);

        if (fetchError) {
          console.error('[Library] fetch tags failed', fetchError);
          Alert.alert('Update failed', 'Unable to fetch current tags.');
          return;
        }

        // Calculate final tags for all updated assets BEFORE updating
        const finalTagsMap = new Map<string, TagVocabulary[]>();
        currentAssets.forEach((currentAsset) => {
          const existingTags = (currentAsset.tags ?? []) as TagVocabulary[];
          // Merge: combine existing tags with new tags, remove duplicates
          const finalTags = Array.from(new Set([...existingTags, ...newTags]));
          finalTagsMap.set(currentAsset.id, finalTags);
        });
        
        console.log(`[Library] Updating tags for ${assetIds.length} assets (merge mode):`, newTags);
        if (location !== undefined) {
          console.log(`[Library] Updating location for ${assetIds.length} assets:`, location);
        }
        
        // Update each asset with merged tags and location
        const updates = currentAssets.map((currentAsset) => {
          const finalTags = finalTagsMap.get(currentAsset.id)!;
          const updateData: any = { tags: finalTags };
          if (location !== undefined) {
            updateData.location = location;
          }
          return supabase
            .from('assets')
            .update(updateData)
            .eq('id', currentAsset.id);
        });

        const results = await Promise.all(updates);
        const hasError = results.some((result) => result.error);

        if (hasError) {
          const errorResult = results.find((r) => r.error);
          console.error('[Library] ❌ Bulk update tags failed', errorResult?.error);
          Alert.alert('Update failed', 'Unable to update tags for some photos.');
          return;
        }
        
        // Verify updates persisted by fetching updated assets
        console.log(`[Library] Verifying bulk tag updates for ${assetIds.length} assets...`);
        const { data: verifiedAssets, error: verifyError } = await supabase
          .from('assets')
          .select('id, tags, location')
          .in('id', assetIds);
          
        if (verifyError) {
          console.error('[Library] ❌ Failed to verify bulk tag updates', verifyError);
          Alert.alert('Update failed', 'Tags may not have been saved correctly. Please try again.');
          return;
        }
        
        // Verify each asset was updated correctly
        const verificationFailed: string[] = [];
        verifiedAssets.forEach((verifiedAsset) => {
          const expectedTags = finalTagsMap.get(verifiedAsset.id);
          if (expectedTags) {
            const expectedStr = JSON.stringify(expectedTags.sort());
            const actualStr = JSON.stringify((verifiedAsset.tags ?? []).sort());
            if (expectedStr !== actualStr) {
              verificationFailed.push(verifiedAsset.id);
              console.error(`[Library] ❌ Verification failed for asset ${verifiedAsset.id}`, {
                expected: expectedTags,
                received: verifiedAsset.tags
              });
            }
          }
        });
        
        if (verificationFailed.length > 0) {
          console.error('[Library] ❌ Bulk update verification failed for assets:', verificationFailed);
          Alert.alert('Update failed', 'Some tags were not saved correctly. Please try again.');
          return;
        }
        
        console.log(`[Library] ✅ Bulk tags successfully saved to database for ${assetIds.length} assets`);
        
        // All updates succeeded and verified
        {
          
          // Optimistically update activeAsset and activeAssetsForTagging with merged tags
          if (activeAsset && assetIds.includes(activeAsset.id)) {
            const finalTags = finalTagsMap.get(activeAsset.id) ?? activeAsset.tags;
            setActiveAsset({ ...activeAsset, tags: finalTags });
          }
          setActiveAssetsForTagging((prev) =>
            prev.map(a => {
              const finalTags = finalTagsMap.get(a.id);
              if (finalTags) {
                return { ...a, tags: finalTags };
              }
              return a;
            })
          );
          
          // Track optimistic updates for all assets - prevent sync useEffect from overwriting
          assetIds.forEach(assetId => {
            const finalTags = finalTagsMap.get(assetId);
            if (finalTags) {
              optimisticTagUpdatesRef.current.set(assetId, {
                tags: finalTags,
                timestamp: Date.now()
              });
            }
          });
          
          // Optimistically update assets array so filteredAssets has correct tags
          // This prevents sync useEffect from overwriting with stale data
          setAssets((prev) =>
            prev.map(a => {
              const finalTags = finalTagsMap.get(a.id);
              if (finalTags) {
                return { ...a, tags: finalTags };
              }
              return a;
            })
          );
          
          // Clear selection after bulk update
          setSelectedAssets([]);
          
          // Don't call loadAssets() immediately - it would overwrite our optimistic updates
          // The database updates have already succeeded, so tags are persisted
          // Natural refresh cycles (navigate away/back, pull-to-refresh) will sync eventually
          // Clean up optimistic update tracking after 10 seconds
          setTimeout(() => {
            assetIds.forEach(assetId => {
              optimisticTagUpdatesRef.current.delete(assetId);
            });
          }, 10000);
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

  const handleDeleteMultipleAssets = () => {
    if (!supabase) {
      Alert.alert('Error', 'Supabase is not configured.');
      return;
    }

    if (selectedAssets.length === 0) {
      return;
    }

    // Premium haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Show premium confirmation modal
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteMultipleAssets = async () => {
    if (!supabase || selectedAssets.length === 0) {
      return;
    }

    const count = selectedAssets.length;
    const assetsToDelete = [...selectedAssets]; // Store for undo
    
    // Close confirmation modal
    setShowDeleteConfirmation(false);
    
    // Haptic feedback for confirmation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Start deletion process
    setIsDeleting(true);
    setDeleteProgress({ current: 0, total: count });
    
    try {
      const assetIds = selectedAssets.map((a) => a.id);
      const storagePaths = selectedAssets
        .map((a) => a.storage_path)
        .filter((path): path is string => Boolean(path));

      // Optimistic update: Remove from UI immediately with animation
      setAssets((prev) => {
        const assetIdsSet = new Set(assetIds);
        return prev.filter((asset) => !assetIdsSet.has(asset.id));
      });
      
      // Clear selection immediately for smooth UX
      setSelectedAssets([]);
      setIsSelectionMode(false);

      // Delete from storage with progress tracking
      if (storagePaths.length > 0) {
        setDeleteProgress({ current: Math.floor(count * 0.3), total: count });
        const { error: storageError } = await supabase.storage
          .from('assets')
          .remove(storagePaths);
        if (storageError) {
          console.error('[Library] storage delete failed', storageError);
          // Continue with DB delete even if storage delete fails
        }
      }

      // Delete from database with progress tracking
      setDeleteProgress({ current: Math.floor(count * 0.7), total: count });
      const { error: dbError } = await supabase.from('assets').delete().in('id', assetIds);
      
      if (dbError) {
        console.error('[Library] database delete failed', dbError);
        // Rollback optimistic update on error
        setAssets((prev) => {
          const existingIds = new Set(prev.map(a => a.id));
          const toRestore = assetsToDelete.filter(a => !existingIds.has(a.id));
          return [...toRestore, ...prev].sort((a, b) => 
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
        });
        setIsDeleting(false);
        Alert.alert('Delete failed', 'Unable to delete photos from database.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // Complete progress
      setDeleteProgress({ current: count, total: count });
      
      // Store for undo (clear after 5 seconds)
      setDeletedAssetsForUndo(assetsToDelete);
      setTimeout(() => {
        setDeletedAssetsForUndo([]);
      }, 5000);

      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show premium success notification
      setDeletedAssetsCount(count);
      setShowDeleteSuccess(true);
      deleteSuccessOpacity.setValue(0);
      deleteSuccessTranslateY.setValue(-60);
      
      Animated.parallel([
        Animated.spring(deleteSuccessTranslateY, {
          toValue: 0,
          tension: 200,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(deleteSuccessOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss success notification after 3 seconds
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(deleteSuccessTranslateY, {
            toValue: -60,
            duration: 300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(deleteSuccessOpacity, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowDeleteSuccess(false);
        });
      }, 3000);

      // Refresh the list in background (optimistic update already shown)
      loadAssets().catch((error) => {
        console.error('[Library] Failed to refresh after delete:', error);
      });
      
    } catch (error) {
      console.error('[Library] delete failed', error);
      
      // Rollback optimistic update on error
      setAssets((prev) => {
        const existingIds = new Set(prev.map(a => a.id));
        const toRestore = assetsToDelete.filter(a => !existingIds.has(a.id));
        return [...toRestore, ...prev].sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      });
      
      setIsDeleting(false);
      Alert.alert('Delete failed', 'Something went wrong while deleting the photos.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeleting(false);
      setDeleteProgress({ current: 0, total: 0 });
    }
  };

  const handleUndoDelete = async () => {
    if (!supabase || deletedAssetsForUndo.length === 0) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      // Restore assets optimistically
      setAssets((prev) => {
        const existingIds = new Set(prev.map(a => a.id));
        const toRestore = deletedAssetsForUndo.filter(a => !existingIds.has(a.id));
        return [...toRestore, ...prev].sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      });

      // Re-upload assets to storage and database
      // Note: This is a simplified undo - in production, you'd want to restore from a backup
      // For now, we'll just restore the UI state and let the user know
      Alert.alert(
        'Undo',
        'Assets restored. Note: Files may need to be re-uploaded if they were already deleted from storage.',
        [{ text: 'OK' }]
      );

      setDeletedAssetsForUndo([]);
      setShowDeleteSuccess(false);
      
      // Refresh to sync with server
      await loadAssets();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[Library] undo failed', error);
      Alert.alert('Undo failed', 'Unable to restore deleted photos.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
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

  const handleDoneSelection = () => {
    if (selectedAssets.length === 0) {
      Alert.alert('No photos selected', 'Please select at least one photo.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate back to story builder with selected assets
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

  const handleRerunAutotagging = useCallback(async () => {
    if (selectedAssets.length === 0) {
      Alert.alert('No photos selected', 'Please select at least one photo to rerun autotagging.');
      return;
    }

    if (!supabase) {
      Alert.alert('Error', 'Unable to connect to database.');
      return;
    }

    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to rerun autotagging.');
      return;
    }

    // Check if user has tags enabled for autotagging
    const { data: tagConfig, error: configError } = await supabase
      .from('tag_config')
      .select('auto_tags')
      .eq('user_id', session.user.id)
      .single();
    
    if (configError) {
      console.error('[Library] Failed to check tag config:', configError);
      if (configError.code === 'PGRST116') {
        // No row found - user hasn't set up tag config
        Alert.alert(
          'No Tags Configured',
          'You need to enable at least one tag for autotagging to work. Please go to Tag Management and enable some tags.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Configuration Error',
          'Unable to check your tag configuration. Please ensure you have tags enabled in tag management.',
          [{ text: 'OK' }]
        );
      }
      return;
    }
    
    const enabledTags = tagConfig?.auto_tags || [];
    if (!Array.isArray(enabledTags) || enabledTags.length === 0) {
      Alert.alert(
        'No Tags Enabled',
        'You need to enable at least one tag for autotagging to work. Please go to Tag Management and enable some tags.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    console.log(`[Library] ✅ User has ${enabledTags.length} tags enabled for autotagging:`, enabledTags);
    console.log(`[Library] Tag config full object:`, JSON.stringify(tagConfig, null, 2));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update all selected assets to pending status and queue for autotagging
    const assetsToRetag = selectedAssets.filter((asset) => asset.publicUrl);
    
    if (assetsToRetag.length === 0) {
      Alert.alert('Error', 'Selected photos do not have valid URLs.');
      return;
    }

    // Show loading state for all assets being retagged
    setAutoTaggingAssets((prev) => {
      const next = new Set(prev);
      assetsToRetag.forEach((asset) => {
        next.add(asset.id);
      });
      return next;
    });

    // Update database status and queue for autotagging
    console.log(`[Library] 🔄 Retagging ${assetsToRetag.length} assets...`);
    console.log(`[Library] Asset IDs:`, assetsToRetag.map(a => a.id));
    console.log(`[Library] Asset URLs:`, assetsToRetag.map(a => a.publicUrl?.substring(0, 100)));
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/index.tsx:1755',message:'Starting bulk retagging',data:{assetsCount:assetsToRetag.length,isBulkOperation:assetsToRetag.length>=15,assetIds:assetsToRetag.map(a=>a.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Update all assets to pending status first
    const updatePromises = assetsToRetag.map(async (asset) => {
      try {
        const updateResult = await supabase
          .from('assets')
          .update({ auto_tag_status: 'pending' })
          .eq('id', asset.id);
        
        if (updateResult.error) {
          console.error(`[Library] Failed to update status for asset ${asset.id}:`, updateResult.error);
        }
      } catch (error) {
        console.error(`[Library] Error updating asset ${asset.id}:`, error);
      }
    });
    
    await Promise.all(updatePromises);
    
    // For bulk operations (20+), use bulk queue method to send all in one Batch API call
    if (assetsToRetag.length >= 20) {
      console.log(`[Library] 🚀 Using BULK queue for ${assetsToRetag.length} assets (OpenAI Batch API - 50% cost savings)`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/index.tsx:1775',message:'Using bulk queue method',data:{assetsCount:assetsToRetag.length,assetIds:assetsToRetag.map(a=>a.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      queueBulkAutoTag(assetsToRetag
        .filter(asset => asset.publicUrl)
        .map(asset => ({
          assetId: asset.id,
          imageUrl: asset.publicUrl!,
          onSuccess: async (result) => {
            console.log(`[Library] ✅✅✅ Autotagging success for asset ${asset.id} ✅✅✅`);
            console.log(`[Library] Tags returned:`, result.tags);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/index.tsx:1779',message:'onSuccess callback fired',data:{assetId:asset.id,tagsCount:result.tags?.length||0,tags:result.tags},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            setAutoTaggingAssets((prev) => {
              const next = new Set(prev);
              next.delete(asset.id);
              return next;
            });
            setRecentlyTaggedAssets((prev) => {
              if (prev.has(asset.id)) {
                return prev;
              }
              const next = new Set(prev);
              next.add(asset.id);
              return next;
            });
            setTimeout(() => {
              setRecentlyTaggedAssets((prev) => {
                const next = new Set(prev);
                next.delete(asset.id);
                return next;
              });
            }, 5500);
            await new Promise(resolve => setTimeout(resolve, 500));
            await loadAssets();
            if (result.tags && result.tags.length > 0) {
              const { data: updatedAsset } = await supabase
                .from('assets')
                .select('tags, auto_tag_status')
                .eq('id', asset.id)
                .single();
              console.log(`[Library] Verified asset ${asset.id} tags after reload:`, updatedAsset?.tags);
              if (!updatedAsset?.tags || updatedAsset.tags.length === 0) {
                console.error(`[Library] ⚠️  Tags not saved for asset ${asset.id}! Expected:`, result.tags);
              }
            }
          },
          onError: async (error) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/index.tsx:1820',message:'onError callback fired',data:{assetId:asset.id,errorMessage:error.message,errorType:error.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
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
            await loadAssets();
          },
          onRetryStart: (assetId) => {
            setAutoTaggingAssets((prev) => {
              const next = new Set(prev);
              next.add(assetId);
              return next;
            });
          },
        }))
      );
    } else {
      // For smaller operations, queue individually (normal batching)
      assetsToRetag.forEach((asset, idx) => {
        console.log(`[Library] Processing asset ${idx + 1}/${assetsToRetag.length}: ${asset.id}`);
        
        // Queue for autotagging
        if (asset.publicUrl) {
          console.log(`[Library] 📤 Enqueuing asset ${asset.id} for autotagging...`);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/index.tsx:1775',message:'Enqueuing asset for autotagging',data:{assetId:asset.id,hasPublicUrl:!!asset.publicUrl,urlPreview:asset.publicUrl?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          queueAutoTag(asset.id, asset.publicUrl, {
            onSuccess: async (result) => {
              console.log(`[Library] ✅✅✅ Autotagging success for asset ${asset.id} ✅✅✅`);
              console.log(`[Library] Tags returned:`, result.tags);
              console.log(`[Library] Tags length:`, result.tags?.length || 0);
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/index.tsx:1779',message:'onSuccess callback fired',data:{assetId:asset.id,tagsCount:result.tags?.length||0,tags:result.tags},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              setAutoTaggingAssets((prev) => {
                const next = new Set(prev);
                next.delete(asset.id);
                return next;
              });
              // Show temporary success indicator
              setRecentlyTaggedAssets((prev) => {
                if (prev.has(asset.id)) {
                  return prev;
                }
                const next = new Set(prev);
                next.add(asset.id);
                return next;
              });
              // Remove success indicator after 5.5 seconds
              setTimeout(() => {
                setRecentlyTaggedAssets((prev) => {
                  const next = new Set(prev);
                  next.delete(asset.id);
                  return next;
                });
              }, 5500);
              // Wait a bit for database update to complete before reloading
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadAssets();
              // Verify tags were saved
              if (result.tags && result.tags.length > 0) {
                const { data: updatedAsset } = await supabase
                  .from('assets')
                  .select('tags, auto_tag_status')
                  .eq('id', asset.id)
                  .single();
                console.log(`[Library] Verified asset ${asset.id} tags after reload:`, updatedAsset?.tags);
                if (!updatedAsset?.tags || updatedAsset.tags.length === 0) {
                  console.error(`[Library] ⚠️  Tags not saved for asset ${asset.id}! Expected:`, result.tags);
                }
              }
            },
            onError: async (error) => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/4ad6fae5-1e95-448c-8aed-85cb2ebf1745',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/index.tsx:1820',message:'onError callback fired',data:{assetId:asset.id,errorMessage:error.message,errorType:error.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
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
              await loadAssets();
            },
            onRetryStart: (assetId) => {
              setAutoTaggingAssets((prev) => {
                const next = new Set(prev);
                next.add(assetId);
                return next;
              });
            },
          });
        }
      });
    }
    
    // Reload assets to reflect updated statuses
    await loadAssets();
  }, [selectedAssets, supabase, loadAssets, session]);

  // Helper function to show retry notification
  const showRetryNotificationBanner = useCallback((count: number, failed: number = 0) => {
    console.log(`[Library] 🎯 showRetryNotificationBanner called with count: ${count}, failed: ${failed}`);
    
    // Set state first
    setRetryCount(count);
    setFailedCount(failed); // Track failed count
    setShowRetryNotification(true);
    
    console.log(`[Library] ✅ Set showRetryNotification to true, retryCount: ${count}`);
    
    // Reset animation values
    retryNotificationOpacity.setValue(0);
    retryNotificationTranslateY.setValue(-60);
    
    // Start animation after a tiny delay to ensure state is set
    setTimeout(() => {
      console.log(`[Library] 🎬 Starting notification animation...`);
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
        console.log(`[Library] ✅ Notification animation started, finished: ${finished}`);
      });
      
      // Auto-dismiss after 5 seconds (longer to give users time to read)
      setTimeout(() => {
        console.log(`[Library] 🕐 Auto-dismissing notification...`);
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
          console.log(`[Library] ✅ Notification dismissed`);
          setShowRetryNotification(false);
        });
      }, 5000); // Increased from 3000 to 5000
    }, 50); // Small delay to ensure state update is processed
  }, [retryNotificationOpacity, retryNotificationTranslateY]);

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
            <MaterialCommunityIcons 
              name={failedCount > 0 ? "alert-circle" : "refresh"} 
              size={18} 
              color={failedCount > 0 ? "#ef4444" : "#b38f5b"} 
              style={{ marginRight: 10 }} 
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: failedCount > 0 ? '#dc2626' : '#111827',
                  fontSize: 14,
                  fontWeight: '600',
                  letterSpacing: -0.2,
                  marginBottom: 2,
                }}
              >
                {failedCount > 0 
                  ? `Auto-tagging failed for ${failedCount} ${failedCount === 1 ? 'photo' : 'photos'}`
                  : 'Auto-tagging in progress'}
              </Text>
              <Text
                style={{
                  color: '#6b7280',
                  fontSize: 12,
                  fontWeight: '400',
                  letterSpacing: -0.1,
                }}
              >
                {failedCount > 0
                  ? `Retrying shortly in background`
                  : `Retrying ${retryCount} ${retryCount === 1 ? 'photo' : 'photos'} in background`}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Header - Apple-style compact with integrated selection state */}
      <View className="bg-background border-b border-gray-100">
        <LibraryHeader
          onMenuPress={() => setIsMenuOpen(true)}
          onTagManagementPress={() => router.push('/tag-management')}
          onProfilePress={() => router.push('/profile')}
          selectedCount={selectedAssets.length}
          isSelectionMode={isSelectionMode}
          onEnterSelectionMode={handleEnterSelectionMode}
          onCancelSelection={handleCancelSelection}
        />
      </View>

      {/* Search Bar - Content-first, immediately accessible */}
      <View className="bg-white px-5 py-3 border-b border-gray-100" style={{ zIndex: 1 }}>
        <TagSearchBar 
          selectedTags={selectedTags || []} 
          onToggleTag={toggleTagFilter}
          availableTags={allAvailableTags || []}
          tagCounts={tagCounts}
          showNoTagsOption={true}
          availableLocations={availableLocations}
          locationCounts={locationCounts}
          noTagsLabel="No Tags"
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
            isSelectionMode={isSelectionMode}
            onToggleSelect={toggleAssetSelection}
            onOpenTagModal={openTagModal}
            onLongPress={handleLongPress}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            autoTaggingAssets={autoTaggingAssets}
            recentlyTaggedAssets={recentlyTaggedAssets}
          />
        </View>
      )}

      {/* Bottom Actions - Apple-style contextual bar */}
      {selectedAssets.length > 0 && (
        <View 
          className="border-t border-gray-100 bg-white"
          style={{
            paddingBottom: Math.max(insets.bottom, 8) + 80, // Extra padding for tab bar
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
              onPress={isStoryMode ? handleDoneSelection : handleAddToStory}
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
                {isStoryMode ? 'Done' : 'Add to Story'}
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
              onPress={handleRerunAutotagging}
              activeOpacity={0.6}
              className="flex-1 items-center py-2.5"
            >
              <View 
                className="h-9 w-9 items-center justify-center rounded-full mb-1"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                }}
              >
                <MaterialCommunityIcons name="refresh" size={18} color="#3b82f6" />
              </View>
              <Text className="text-[12px] font-medium text-blue-600" style={{ letterSpacing: -0.1 }}>
                Retag
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
        onAutoTagSuccess={handleManualAutoTagSuccess}
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
          // Check for retries when overlay is dismissed
          checkForRetriesOnOverlayDismiss();
        }}
      />

      {/* Menu Drawer */}
      <MenuDrawer
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />

      {/* Bottom Tab Bar */}
      <BottomTabBar onAddPress={handleImport} />

      {/* Premium Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <View
          className="absolute inset-0 z-50 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <View
            className="mx-6 rounded-3xl bg-white p-6"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 24,
              elevation: 10,
              maxWidth: 400,
              width: '100%',
            }}
          >
            <View className="mb-4 items-center">
              <View
                className="mb-4 h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              >
                <MaterialCommunityIcons name="delete-outline" size={32} color="#ef4444" />
              </View>
              <Text className="mb-2 text-center text-[22px] font-semibold text-gray-900" style={{ letterSpacing: -0.5 }}>
                Delete {selectedAssets.length} Photo{selectedAssets.length > 1 ? 's' : ''}?
              </Text>
              <Text className="text-center text-[15px] leading-[20px] text-gray-600">
                This action cannot be undone. The selected photos will be permanently deleted.
              </Text>
            </View>
            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteConfirmation(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
                className="flex-1 rounded-xl border border-gray-300 bg-white py-3.5"
              >
                <Text className="text-center text-[16px] font-semibold text-gray-700" style={{ letterSpacing: -0.2 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDeleteMultipleAssets}
                activeOpacity={0.85}
                className="flex-1 rounded-xl py-3.5"
                style={{ backgroundColor: '#ef4444' }}
              >
                <Text className="text-center text-[16px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Delete Progress Overlay */}
      {isDeleting && (
        <View
          className="absolute inset-0 z-40 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <View
            className="mx-8 rounded-3xl bg-white p-6"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 24,
              elevation: 10,
              maxWidth: 300,
              width: '100%',
            }}
          >
            <View className="mb-4 items-center">
              <ActivityIndicator size="large" color="#ef4444" />
              <Text className="mt-4 text-center text-[17px] font-semibold text-gray-900" style={{ letterSpacing: -0.3 }}>
                Deleting Photos...
              </Text>
              <Text className="mt-2 text-center text-[14px] text-gray-600">
                {deleteProgress.current} of {deleteProgress.total}
              </Text>
            </View>
            {/* Progress bar */}
            <View className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: '#ef4444',
                  width: `${(deleteProgress.current / deleteProgress.total) * 100}%`,
                }}
              />
            </View>
          </View>
        </View>
      )}

      {/* Premium Success Toast Notification */}
      {showDeleteSuccess && (
        <Animated.View
          className="absolute left-0 right-0 z-50 px-5"
          style={{
            top: Math.max(insets.top + 16, 60),
            opacity: deleteSuccessOpacity,
            transform: [{ translateY: deleteSuccessTranslateY }],
          }}
        >
          <View
            className="flex-row items-center rounded-2xl bg-white p-4"
            style={{
              shadowColor: '#22c55e',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <View
              className="mr-3 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
            >
              <MaterialCommunityIcons name="check-circle" size={24} color="#22c55e" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-gray-900" style={{ letterSpacing: -0.2 }}>
                {deletedAssetsCount} photo{deletedAssetsCount > 1 ? 's' : ''} deleted
              </Text>
              {deletedAssetsForUndo.length > 0 && (
                <Text className="mt-0.5 text-[13px] text-gray-600">
                  Tap to undo
                </Text>
              )}
            </View>
            {deletedAssetsForUndo.length > 0 && (
              <TouchableOpacity
                onPress={handleUndoDelete}
                activeOpacity={0.7}
                className="ml-2 rounded-xl bg-gray-100 px-4 py-2"
              >
                <Text className="text-[14px] font-semibold text-gray-700" style={{ letterSpacing: -0.1 }}>
                  Undo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

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
              false, // Import all including duplicates
              pendingImportData.locations
            );
            setPendingImportData(null);
          }}
          onSkipDuplicates={async () => {
            setShowDuplicateDialog(false);
            await processImport(
              pendingImportData.assets,
              pendingImportData.compressedImages,
              pendingImportData.hashes,
              true, // Skip duplicates
              pendingImportData.locations
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
