import { useCallback } from 'react';
import { ActivityIndicator, Dimensions, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Asset } from '@/types';

type PhotoGridProps = {
  assets: Asset[];
  selectedAssets: Asset[];
  isSelectionMode?: boolean;
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
  const handlePress = () => {
    if (isMultiSelectMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggleSelect(asset);
    } else {
      onOpenTagModal(asset);
    }
  };

  const handleLongPressAction = () => {
    if (onLongPress) {
      onLongPress(asset);
    } else {
      onToggleSelect(asset);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        aspectRatio: 1,
        margin: 1.5,
        opacity: isMultiSelectMode && isSelected ? 0.7 : 1,
      }}
    >
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPressAction}
        className="relative h-full w-full overflow-hidden rounded-2xl"
        activeOpacity={0.8}
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

        {/* Selection border */}
        {isMultiSelectMode && isSelected && (
          <View 
            className="absolute inset-0 rounded-2xl"
            style={{ 
              borderWidth: 3,
              borderColor: '#b38f5b',
              zIndex: 1,
            }}
          />
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

        {/* Selection checkmark */}
        {isMultiSelectMode && (
          <View 
            className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full"
            style={{
              backgroundColor: isSelected ? '#b38f5b' : 'rgba(0, 0, 0, 0.3)',
              zIndex: 2,
            }}
          >
            {isSelected && (
              <Text className="text-[14px] font-bold text-white">
                ✓
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function PhotoGrid({
  assets,
  selectedAssets,
  isSelectionMode = false,
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
      const isMultiSelectMode = isSelectionMode;
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
    [selectedAssets, isSelectionMode, onToggleSelect, onOpenTagModal, onLongPress, autoTaggingAssets],
  );

  return (
    <FlatList
      data={assets}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={3}
      contentContainerStyle={{ padding: 3, paddingBottom: 180 }} // Extra padding for tab bar
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
