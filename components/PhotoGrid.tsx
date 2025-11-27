import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Dimensions, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Asset } from '@/types';

type PhotoGridProps = {
  assets: Asset[];
  selectedAssets: Asset[];
  onToggleSelect: (asset: Asset) => void;
  onOpenTagModal: (asset: Asset) => void;
  onLongPress?: (asset: Asset) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  autoTaggingAssets?: Set<string>;
};

const keyExtractor = (item: Asset) => item.id;

function PhotoTile({
  asset,
  isSelected,
  onToggleSelect,
  onOpenTagModal,
  onLongPress,
  isAutoTagging,
  isMultiSelectMode,
}: {
  asset: Asset;
  isSelected: boolean;
  onToggleSelect: (asset: Asset) => void;
  onOpenTagModal: (asset: Asset) => void;
  onLongPress?: (asset: Asset) => void;
  isAutoTagging?: boolean;
  isMultiSelectMode: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 0.95 : 1,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }),
      Animated.timing(opacityAnim, {
        toValue: isSelected ? 0.9 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected]);

  const handlePress = () => {
    // Apple Photos behavior:
    // - If NOT in multi-select mode: tap opens photo
    // - If IN multi-select mode: tap toggles selection
    if (isMultiSelectMode) {
      // In multi-select mode: toggle selection
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 0.92,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.85,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: isSelected ? 0.95 : 1,
            useNativeDriver: true,
            tension: 300,
            friction: 20,
          }),
          Animated.timing(opacityAnim, {
            toValue: isSelected ? 0.9 : 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
      onToggleSelect(asset);
    } else {
      // Not in multi-select mode: open photo
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 0.92,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.85,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 300,
            friction: 20,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
      onOpenTagModal(asset);
    }
  };

  const handleLongPress = () => {
    // Long press enables multi-select mode (selects this photo)
    // In Apple Photos, long press always enables multi-select
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.92,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: isSelected ? 0.95 : 1,
          useNativeDriver: true,
          tension: 300,
          friction: 20,
        }),
        Animated.timing(opacityAnim, {
          toValue: isSelected ? 0.9 : 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    onToggleSelect(asset);
  };

  return (
    <Animated.View
      style={{
        flex: 1,
        aspectRatio: 1,
        margin: 1.5,
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        className="relative h-full w-full overflow-hidden rounded-2xl"
        activeOpacity={1}
      >
        {asset.publicUrl ? (
          <Image 
            source={{ uri: asset.publicUrl }} 
            className="h-full w-full rounded-2xl" 
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
            style={{
              backgroundColor: '#f5f5f5',
            }}
          />
        ) : (
          <View className="h-full w-full items-center justify-center rounded-2xl bg-gray-100">
            <Text className="text-[11px] font-medium text-gray-400">Processing…</Text>
          </View>
        )}

        {/* Selection overlay - refined Apple-style */}
        {isSelected && (
          <>
            <View 
              className="absolute inset-0 rounded-2xl"
              style={{ 
                backgroundColor: 'rgba(179, 143, 91, 0.08)',
                borderWidth: 2.5,
                borderColor: '#b38f5b',
                zIndex: 1,
              }}
            />
            {/* Subtle inner glow for depth */}
            <View 
              className="absolute inset-0 rounded-2xl"
              style={{ 
                backgroundColor: 'rgba(179, 143, 91, 0.03)',
                borderWidth: 1,
                borderColor: 'rgba(179, 143, 91, 0.2)',
                zIndex: 2,
                margin: 2,
              }}
            />
          </>
        )}

        {/* Auto-tagging indicator */}
        {isAutoTagging && (
          <View 
            className="absolute left-2 top-2 z-10"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.12,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <View 
              className="flex-row items-center rounded-full px-2.5 py-1"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
              }}
            >
              <ActivityIndicator 
                size="small" 
                color="#b38f5b" 
                style={{ 
                  width: 10, 
                  height: 10,
                  marginRight: 4,
                }} 
              />
              <Text className="text-[9px] font-semibold text-gray-900" style={{ letterSpacing: -0.1 }}>
                Tagging
              </Text>
            </View>
          </View>
        )}

        {/* Selection indicator - refined Apple-style */}
        {isSelected && !isAutoTagging && (
          <View 
            className="absolute right-2.5 top-2.5 h-7 w-7 items-center justify-center rounded-full"
            style={{
              backgroundColor: '#b38f5b',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 3,
              zIndex: 4,
            }}
          >
            {/* Inner white circle for depth */}
            <View 
              className="absolute inset-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 0.5,
                borderColor: 'rgba(255, 255, 255, 0.3)',
              }}
            />
            <Text 
              className="text-[14px] font-bold text-white" 
              style={{ 
                textShadowColor: 'rgba(0, 0, 0, 0.2)',
                textShadowOffset: { width: 0, height: 0.5 },
                textShadowRadius: 1,
              }}
            >
              ✓
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function PhotoGrid({
  assets,
  selectedAssets,
  onToggleSelect,
  onOpenTagModal,
  onLongPress,
  refreshing,
  onRefresh,
  autoTaggingAssets = new Set(),
}: PhotoGridProps) {
  const renderItem = useCallback(
    ({ item }: { item: Asset }) => {
      const isSelected = selectedAssets.some((asset) => asset.id === item.id);
      const isAutoTagging = autoTaggingAssets.has(item.id);
      const isMultiSelectMode = selectedAssets.length > 0;
      return (
        <PhotoTile 
          asset={item} 
          isSelected={isSelected} 
          onToggleSelect={onToggleSelect} 
          onOpenTagModal={onOpenTagModal}
          onLongPress={onLongPress}
          isAutoTagging={isAutoTagging}
          isMultiSelectMode={isMultiSelectMode}
        />
      );
    },
    [selectedAssets, onToggleSelect, onOpenTagModal, onLongPress, autoTaggingAssets],
  );

  return (
    <FlatList
      data={assets}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={3}
      contentContainerStyle={{ padding: 3, paddingBottom: 100 }}
      columnWrapperStyle={{ paddingHorizontal: 1.5 }}
      showsVerticalScrollIndicator={true}
      refreshing={refreshing}
      onRefresh={onRefresh}
      refreshControl={
        refreshing !== undefined && onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#b38f5b"
            colors={['#b38f5b']}
            progressViewOffset={0}
            style={{ backgroundColor: 'transparent' }}
          />
        ) : undefined
      }
      scrollIndicatorInsets={{ right: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      // Performance optimizations
      initialNumToRender={12}
      maxToRenderPerBatch={6}
      updateCellsBatchingPeriod={50}
      windowSize={10}
      removeClippedSubviews={true}
      getItemLayout={useCallback((data: ArrayLike<Asset> | null | undefined, index: number) => {
        const screenWidth = Dimensions.get('window').width;
        const itemSize = (screenWidth - 16) / 3; // Account for padding
        const row = Math.floor(index / 3);
        return {
          length: itemSize,
          offset: itemSize * row,
          index,
        };
      }, [])}
      ListEmptyComponent={
        <View className="mt-24 items-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Text className="text-3xl">📷</Text>
          </View>
          <Text className="mb-1 text-center text-[17px] font-semibold text-gray-900">
            No photos yet
          </Text>
          <Text className="text-center text-[15px] leading-[20px] text-gray-500">
            Import photos from your camera roll to get started
          </Text>
        </View>
      }
    />
  );
}
