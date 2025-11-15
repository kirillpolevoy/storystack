import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Asset } from '@/types';
import { exportStorySequence } from '@/utils/exportStory';
import { StoryHeader } from '@/components/StoryHeader';
import { StoryNameCard } from '@/components/StoryNameCard';
import { StoryPhotoRow } from '@/components/StoryPhotoRow';
import { StoryActionBar } from '@/components/StoryActionBar';

export default function StoryBuilderScreen() {
  const router = useRouter();
  if (!router) {
    return null;
  }

  const params = useLocalSearchParams<{ assetIds?: string | string[] }>();
  
  // Parse asset IDs from params - use useMemo to avoid recalculating
  const assetIds = useMemo(() => {
    const assetIdsParam = params.assetIds;
    if (!assetIdsParam) {
      return [];
    }
    if (Array.isArray(assetIdsParam)) {
      return assetIdsParam;
    }
    if (typeof assetIdsParam === 'string') {
      // Split comma-separated string
      return assetIdsParam.split(',').filter((id) => id.trim().length > 0);
    }
    return [];
  }, [params.assetIds]);
  
  // Debug logging
  useEffect(() => {
    console.log('[StoryBuilder] params:', params);
    console.log('[StoryBuilder] parsed assetIds:', assetIds);
  }, [params, assetIds]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [orderedAssets, setOrderedAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storyName, setStoryName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

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
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .in('id', assetIds);

    if (assetError) {
      console.error('[StoryBuilder] asset fetch failed', assetError);
      Alert.alert('Error', 'Unable to load photos.');
    } else if (assetData) {
      const mapped = (assetData as Asset[]).map((asset) => {
        const { data } = supabase.storage.from('assets').getPublicUrl(asset.storage_path);
        const tags = Array.isArray(asset.tags) ? (asset.tags as string[]) : [];
        return { ...asset, publicUrl: data.publicUrl, tags } as Asset;
      });
      // Preserve order from assetIds
      const ordered = assetIds
        .map((id) => mapped.find((a) => a.id === id))
        .filter((a): a is Asset => a !== undefined);
      setAssets(mapped);
      setOrderedAssets(ordered);
    }

    setIsLoading(false);
  }, [assetIds]);

  useEffect(() => {
    if (assetIds.length > 0) {
      loadAssets();
    } else {
      setIsLoading(false);
      // If no assetIds, show error or redirect back
      if (!params.assetIds) {
        console.warn('[StoryBuilder] No assetIds in params');
      }
    }
  }, [assetIds, loadAssets, params.assetIds]);

  // Reordering functions
  const moveAssetUp = useCallback((index: number) => {
    if (index === 0) return;
    setOrderedAssets((prev) => {
      const newOrder = [...prev];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      return newOrder;
    });
  }, []);

  const moveAssetDown = useCallback((index: number) => {
    if (index >= orderedAssets.length - 1) return;
    setOrderedAssets((prev) => {
      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      return newOrder;
    });
  }, [orderedAssets.length]);

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
      // Show success message and optionally reset
      setTimeout(() => {
        setStoryName('');
        setOrderedAssets([]);
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StoryBuilder] export failed', errorMsg, error);
      Alert.alert('Export failed', `Something went wrong: ${errorMsg}\n\nPlease try again.`);
    } finally {
      setIsExporting(false);
    }
  }, [storyName, orderedAssets]);

  const renderStoryRow = ({ item, index }: { item: Asset; index: number }) => {
    return (
      <StoryPhotoRow
        asset={item}
        index={index}
        onMoveUp={() => moveAssetUp(index)}
        onMoveDown={() => moveAssetDown(index)}
        onRemove={() => removeAsset(item.id)}
        canMoveUp={index > 0}
        canMoveDown={index < orderedAssets.length - 1}
      />
    );
  };

  const canExport = storyName.trim().length > 0 && orderedAssets.length > 0;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <StoryHeader onBackPress={() => router.back()} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#b38f5b" />
          <Text className="mt-4 text-[15px] font-medium text-gray-500">Loading photos…</Text>
        </View>
      ) : orderedAssets.length === 0 ? (
        <View className="flex-1 items-center justify-center px-5">
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
            <Text className="text-4xl">📸</Text>
          </View>
          <Text className="mb-1.5 text-center text-[20px] font-semibold text-gray-900">
            No photos in this story yet
          </Text>
          <Text className="mb-6 text-center text-[15px] leading-[20px] text-gray-500">
            Please go back to the library and select photos to build your story.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="rounded-2xl bg-[#b38f5b] px-6 py-3"
            style={{
              shadowColor: '#b38f5b',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text className="text-[16px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
              Back to Library
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Story Name Card */}
          <StoryNameCard storyName={storyName} onStoryNameChange={setStoryName} />

          {/* Selected Photos List */}
          <FlatList
            data={orderedAssets}
            keyExtractor={(item) => item.id}
            renderItem={renderStoryRow}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={
              <View className="mt-8 items-center px-5">
                <Text className="text-center text-[15px] text-gray-500">No photos in this story.</Text>
              </View>
            }
          />

          {/* Bottom Action Bar */}
          <StoryActionBar
            photoCount={orderedAssets.length}
            onClear={clearStory}
            onExport={handleExport}
            canExport={canExport}
            isExporting={isExporting}
          />
        </>
      )}
    </View>
  );
}

