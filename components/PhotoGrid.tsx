import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

// Memoized PhotoTile component for optimal performance
const PhotoTile = React.memo(({
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
}) => {
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
        backgroundColor: '#f5f5f5', // Always show background to prevent blank spaces
      }}
    >
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPressAction}
        className="relative h-full w-full overflow-hidden rounded-2xl"
        activeOpacity={0.8}
        style={{
          backgroundColor: '#f5f5f5', // Always show background
        }}
      >
        {asset.publicUrl ? (
          <Image 
            source={{ uri: asset.publicUrl }} 
            className="h-full w-full rounded-2xl" 
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            priority="low"
            recyclingKey={asset.id}
            allowDownscaling={true}
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
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.asset.id === nextProps.asset.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isAutoTagging === nextProps.isAutoTagging &&
    prevProps.isMultiSelectMode === nextProps.isMultiSelectMode
  );
});

PhotoTile.displayName = 'PhotoTile';

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
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  
  // Calculate item size for 3-column grid
  const itemSize = useMemo(() => {
    const padding = 6; // 3px on each side
    const gaps = 3; // 1.5px margin on each side of 3 items = 3 gaps
    return (screenWidth - padding - gaps) / 3;
  }, [screenWidth]);

  // Convert assets array into rows of 3 items each
  const rows = useMemo(() => {
    const rowsArray: Asset[][] = [];
    for (let i = 0; i < assets.length; i += 3) {
      rowsArray.push(assets.slice(i, i + 3));
    }
    return rowsArray;
  }, [assets]);

  // Create selected assets Set for O(1) lookup
  const selectedAssetsSet = useMemo(() => {
    return new Set(selectedAssets.map(asset => asset.id));
  }, [selectedAssets]);

  const renderRow = useCallback((row: Asset[], rowIndex: number) => {
    return (
      <View
        key={`row-${rowIndex}`}
        style={{
          flexDirection: 'row',
          paddingHorizontal: 1.5,
          marginBottom: 0, // Margin handled by PhotoTile
        }}
      >
        {row.map((asset) => {
          const isSelected = selectedAssetsSet.has(asset.id);
          const isAutoTagging = autoTaggingAssets.has(asset.id);
          return (
            <PhotoTile
              key={asset.id}
              asset={asset}
              isSelected={isSelected}
              onToggleSelect={onToggleSelect}
              onOpenTagModal={onOpenTagModal}
              onLongPress={onLongPress}
              isAutoTagging={isAutoTagging}
              isMultiSelectMode={isSelectionMode}
            />
          );
        })}
        {/* Fill remaining columns if row has less than 3 items */}
        {row.length < 3 && (
          Array.from({ length: 3 - row.length }).map((_, idx) => (
            <View key={`spacer-${idx}`} style={{ flex: 1, margin: 1.5 }} />
          ))
        )}
      </View>
    );
  }, [selectedAssetsSet, autoTaggingAssets, isSelectionMode, onToggleSelect, onOpenTagModal, onLongPress]);

  const bottomPadding = useMemo(() => {
    return Math.max(insets.bottom + 100, 120) + 80; // Extra padding for tab bar
  }, [insets.bottom]);

  if (assets.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 96,
          paddingBottom: bottomPadding,
        }}
        refreshControl={
          refreshing !== undefined && onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#b38f5b"
              colors={['#b38f5b']}
            />
          ) : undefined
        }
      >
        <View className="items-center px-8">
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
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 3,
        paddingBottom: bottomPadding,
      }}
      showsVerticalScrollIndicator={true}
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
      // Optimize scroll performance
      decelerationRate="normal"
      // Remove momentum scrolling issues
      bounces={true}
      // Smooth scrolling
      scrollEventThrottle={16}
    >
      {rows.map((row, index) => renderRow(row, index))}
    </ScrollView>
  );
}
