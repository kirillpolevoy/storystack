import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { Asset } from '@/types';
import { exportStorySequence } from '@/utils/exportStory';
import { StoryHeader } from '@/components/StoryHeader';

// Color palette
const COLORS = {
  background: '#fafafa',
  card: '#ffffff',
  accent: '#b38f5b',
  accentLight: 'rgba(179, 143, 91, 0.1)',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.1)',
  disabled: '#E5E7EB',
  disabledText: '#9CA3AF',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StoryBuilderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  if (!router) {
    return null;
  }

  const params = useLocalSearchParams<{ 
    assetIds?: string | string[];
    existingAssetIds?: string | string[];
    mode?: 'new' | 'add';
  }>();
  
  // Parse new asset IDs from params
  const newAssetIds = useMemo(() => {
    const assetIdsParam = params.assetIds;
    if (!assetIdsParam) {
      return [];
    }
    if (Array.isArray(assetIdsParam)) {
      return assetIdsParam;
    }
    if (typeof assetIdsParam === 'string') {
      return assetIdsParam.split(',').filter((id) => id.trim().length > 0);
    }
    return [];
  }, [params.assetIds]);

  // Parse existing asset IDs from params (for adding to existing story)
  const existingAssetIds = useMemo(() => {
    const existingParam = params.existingAssetIds;
    if (!existingParam) {
      return [];
    }
    if (Array.isArray(existingParam)) {
      return existingParam;
    }
    if (typeof existingParam === 'string') {
      return existingParam.split(',').filter((id) => id.trim().length > 0);
    }
    return [];
  }, [params.existingAssetIds]);

  // Determine if we're adding to existing story or creating new
  const isAddMode = params.mode === 'add' || existingAssetIds.length > 0;
  
  // Combine existing and new asset IDs (deduplicated, preserving order)
  const assetIds = useMemo(() => {
    if (!isAddMode) {
      return newAssetIds;
    }
    // Merge: existing first, then new (avoiding duplicates)
    const existingSet = new Set(existingAssetIds);
    const newIds = newAssetIds.filter((id) => !existingSet.has(id));
    return [...existingAssetIds, ...newIds];
  }, [isAddMode, existingAssetIds, newAssetIds]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [orderedAssets, setOrderedAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storyName, setStoryName] = useState('');

  // Initialize story name from params if provided
  useEffect(() => {
    if (params.storyName && !storyName) {
      setStoryName(params.storyName);
    }
  }, [params.storyName]);
  const [isExporting, setIsExporting] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({});

  // Load assets from Supabase
  const loadAssets = useCallback(async () => {
    if (!assetIds.length) {
      setIsLoading(false);
      return;
    }

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // In add mode, only load new assets (not existing ones)
    const idsToLoad = isAddMode ? newAssetIds : assetIds;
    
    if (idsToLoad.length === 0) {
      setIsLoading(false);
      return;
    }

    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .in('id', idsToLoad);

    if (assetError) {
      console.error('[StoryBuilder] asset fetch failed', assetError);
      Alert.alert('Error', 'Unable to load photos.');
    } else if (assetData) {
      const mapped = (assetData as Asset[]).map((asset) => {
        const { data } = supabase.storage.from('assets').getPublicUrl(asset.storage_path);
        const tags = Array.isArray(asset.tags) ? (asset.tags as string[]) : [];
        return { ...asset, publicUrl: data.publicUrl, tags } as Asset;
      });
      
      if (isAddMode) {
        // In add mode: preserve existing assets and append new ones
        setOrderedAssets((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const newAssets = mapped.filter((a) => !existingIds.has(a.id));
          // Preserve order: existing first, then new (in the order they were selected)
          const orderedNew = newAssetIds
            .map((id) => newAssets.find((a) => a.id === id))
            .filter((a): a is Asset => a !== undefined);
          return [...prev, ...orderedNew];
        });
        
        // Update assets map
        setAssets((prev) => {
          const updated = new Map(prev.map((a) => [a.id, a]));
          mapped.forEach((asset) => updated.set(asset.id, asset));
          return Array.from(updated.values());
        });
        
        // Update local tags for new assets
        setLocalTags((prev) => {
          const updated = { ...prev };
          mapped.forEach((asset) => {
            updated[asset.id] = asset.tags || [];
          });
          return updated;
        });
      } else {
        // New story: replace everything
        const ordered = assetIds
          .map((id) => mapped.find((a) => a.id === id))
          .filter((a): a is Asset => a !== undefined);
        setAssets(mapped);
        setOrderedAssets(ordered);
        
        // Initialize local tags
        const initialTags: Record<string, string[]> = {};
        ordered.forEach((asset) => {
          initialTags[asset.id] = asset.tags || [];
        });
        setLocalTags(initialTags);
      }
    }

    setIsLoading(false);
  }, [assetIds, isAddMode, newAssetIds]);

  useEffect(() => {
    if (assetIds.length > 0) {
      loadAssets();
    } else {
      setIsLoading(false);
    }
  }, [assetIds, loadAssets]);

  const removeAsset = useCallback((assetId: string) => {
    setOrderedAssets((prev) => prev.filter((a) => a.id !== assetId));
  }, []);

  const clearStory = useCallback(() => {
    Alert.alert('Clear Story', 'Are you sure you want to clear this story?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setOrderedAssets([]);
          setStoryName('');
          setLocalTags({});
        },
      },
    ]);
  }, []);

  const handleExport = useCallback(async () => {
    if (!storyName.trim()) {
      Alert.alert('Story name required', 'Please enter a name for your story.');
      return;
    }

    if (orderedAssets.length === 0) {
      Alert.alert('No photos', 'Please add photos to your story.');
      return;
    }

    setIsExporting(true);
    try {
      await exportStorySequence(orderedAssets, storyName.trim());
      setTimeout(() => {
        setStoryName('');
        setOrderedAssets([]);
        setLocalTags({});
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StoryBuilder] export failed', errorMsg, error);
      Alert.alert('Export failed', `Something went wrong: ${errorMsg}\n\nPlease try again.`);
    } finally {
      setIsExporting(false);
    }
  }, [storyName, orderedAssets]);

  // Tag management - only remove tags, no adding
  const handleRemoveTag = useCallback((assetId: string, tag: string) => {
    setLocalTags((prev) => {
      const currentTags = prev[assetId] || [];
      return { ...prev, [assetId]: currentTags.filter((t) => t !== tag) };
    });
  }, []);

  const canExport = orderedAssets.length > 0;

  // Photo Card Component
  const PhotoCard = ({ asset, index }: { asset: Asset; index: number }) => {
    const assetTags = localTags[asset.id] || asset.tags || [];
    const swipeableRef = useRef<Swipeable>(null);

    const renderRightActions = () => (
      <View style={styles.swipeDeleteContainer}>
        <TouchableOpacity
          onPress={() => {
            swipeableRef.current?.close();
            removeAsset(asset.id);
          }}
          activeOpacity={0.9}
          style={styles.swipeDeleteButton}
        >
          <Text style={styles.swipeDeleteText}>Delete</Text>
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
        <View style={styles.photoCard}>
          <View style={styles.photoCardContent}>
            {/* Thumbnail with Index Badge */}
            <TouchableOpacity
              onPress={() => setPreviewAsset(asset)}
              activeOpacity={0.8}
              style={styles.thumbnailContainer}
            >
              {asset.publicUrl ? (
                <Image
                  source={{ uri: asset.publicUrl }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <Text style={styles.thumbnailPlaceholderText}>Loading</Text>
                </View>
              )}
              <View style={styles.indexBadge}>
                <Text style={styles.indexBadgeText}>{index + 1}</Text>
              </View>
            </TouchableOpacity>

            {/* Content */}
            <View style={styles.photoCardContentRight}>
              {/* Tags Row */}
              {assetTags.length > 0 && (
                <View style={styles.tagsRow}>
                  {assetTags.map((tag, tagIndex) => (
                    <View key={tagIndex} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {/* Header */}
        <StoryHeader 
          onBackPress={() => router.back()} 
          onAddMorePress={() => {
            // Navigate to library with current story's asset IDs
            const currentAssetIds = orderedAssets.map((a) => a.id).join(',');
            router.push({
              pathname: '/',
              params: {
                existingAssetIds: currentAssetIds,
                storyName: storyName,
              },
            });
          }}
          showAddMore={orderedAssets.length > 0}
        />

        {isLoading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading photos…</Text>
          </View>
        ) : orderedAssets.length === 0 ? (
          <View style={styles.centerContent}>
            <View style={styles.emptyStateIcon}>
              <Text style={styles.emptyStateEmoji}>📸</Text>
            </View>
            <Text style={styles.emptyStateTitle}>No photos in this story yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Please go back to the library and select photos to build your story.
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>Back to Library</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              {/* Story Details Section */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Story details</Text>
                <View style={styles.storyNameCard}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>Story name</Text>
                    <Text style={[styles.characterCount, storyName.length > 40 && styles.characterCountWarning]}>
                      {storyName.length}/50
                    </Text>
                  </View>
                  <TextInput
                    placeholder="e.g. Aria launch, Layered looks, Holiday drop"
                    placeholderTextColor={COLORS.textTertiary}
                    value={storyName}
                    onChangeText={(text) => {
                      if (text.length <= 50) {
                        setStoryName(text);
                      }
                    }}
                    maxLength={50}
                    style={styles.textInput}
                  />
                  <Text style={styles.helperText}>
                    This will also be the name of the exported album.
                  </Text>
                </View>
              </View>

              {/* Selected Photos Section */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  Selected photos ({orderedAssets.length})
                </Text>
                {orderedAssets.map((asset, index) => (
                  <PhotoCard key={asset.id} asset={asset} index={index} />
                ))}
              </View>
            </ScrollView>

            {/* Sticky Bottom Action Bar */}
            <View
              style={[
                styles.bottomBar,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <TouchableOpacity
                onPress={clearStory}
                disabled={orderedAssets.length === 0}
                style={[
                  styles.clearButton,
                  orderedAssets.length === 0 && styles.clearButtonDisabled,
                ]}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.clearButtonText,
                    orderedAssets.length === 0 && styles.clearButtonTextDisabled,
                  ]}
                >
                  Clear
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleExport}
                disabled={isExporting}
                style={[
                  styles.exportButton,
                  isExporting && styles.exportButtonDisabled,
                ]}
                activeOpacity={!isExporting ? 0.85 : 1}
              >
                <Text
                  style={[
                    styles.exportButtonText,
                    isExporting && styles.exportButtonTextDisabled,
                  ]}
                >
                  {isExporting ? 'Exporting…' : 'Export Story'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Photo Preview Modal */}
        <Modal
          visible={previewAsset !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewAsset(null)}
        >
          <View style={styles.previewModal}>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setPreviewAsset(null)}
            >
              <Text style={styles.previewCloseButtonText}>×</Text>
            </TouchableOpacity>
            {previewAsset?.publicUrl && (
              <ScrollView
                maximumZoomScale={3}
                minimumZoomScale={1}
                contentContainerStyle={styles.previewImageContainer}
              >
                <Image
                  source={{ uri: previewAsset.publicUrl }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </ScrollView>
            )}
          </View>
        </Modal>

      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyStateEmoji: {
    fontSize: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  storyNameCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  characterCount: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textTertiary,
    letterSpacing: -0.1,
  },
  characterCountWarning: {
    color: COLORS.error,
  },
  textInput: {
    fontSize: 17,
    color: COLORS.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  helperText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  photoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  photoCardContent: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'flex-start',
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 16,
  },
  thumbnail: {
    width: 112,
    height: 112,
    borderRadius: 16,
    backgroundColor: COLORS.borderLight,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  indexBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  indexBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  photoCardContentRight: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 112,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.accent,
    letterSpacing: -0.1,
  },
  swipeDeleteContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  swipeDeleteButton: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 80,
  },
  swipeDeleteText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 20,
    paddingTop: 20,
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  clearButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  clearButtonDisabled: {
    borderColor: COLORS.disabled,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  clearButtonTextDisabled: {
    color: COLORS.disabledText,
  },
  exportButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  exportButtonDisabled: {
    backgroundColor: COLORS.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  exportButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  exportButtonTextDisabled: {
    color: COLORS.disabledText,
  },
  previewModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  previewCloseButtonText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '300',
  },
  previewImageContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
});
