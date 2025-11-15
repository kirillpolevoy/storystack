import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
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
}: {
  asset: Asset;
  isSelected: boolean;
  onToggleSelect: (asset: Asset) => void;
  onOpenTagModal: (asset: Asset) => void;
  onLongPress?: (asset: Asset) => void;
  isAutoTagging?: boolean;
}) {
  const limitedTags = asset.tags.slice(0, 2);
  const extraCount = asset.tags.length - limitedTags.length;
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
        margin: 2,
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={() => {
          if (onLongPress) {
            onLongPress(asset);
          } else {
            onOpenTagModal(asset);
          }
        }}
        className="relative h-full w-full overflow-hidden rounded-2xl"
        activeOpacity={1}
      >
        {asset.publicUrl ? (
          <Image 
            source={{ uri: asset.publicUrl }} 
            className="h-full w-full rounded-2xl" 
            resizeMode="cover"
            style={{
              backgroundColor: '#f5f5f5',
            }}
          />
        ) : (
          <View className="h-full w-full items-center justify-center rounded-2xl bg-gray-100">
            <Text className="text-[11px] font-medium text-gray-400">Processing…</Text>
          </View>
        )}

        {/* Selection overlay - subtle border */}
        {isSelected && (
          <View 
            className="absolute inset-0 rounded-2xl"
            style={{ 
              backgroundColor: 'rgba(179, 143, 91, 0.08)',
              borderWidth: 2,
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

        {/* Checkmark badge - gold */}
        {isSelected && !isAutoTagging && (
          <View 
            className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full"
            style={{
              backgroundColor: '#b38f5b',
              shadowColor: '#b38f5b',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 3,
              zIndex: 4,
            }}
          >
            <Text className="text-[14px] font-bold text-white">✓</Text>
          </View>
        )}

        {/* Tag overlay at bottom - subtle translucent */}
        {asset.tags.length > 0 && (
          <View
            className="absolute bottom-0 left-0 right-0 flex-row flex-wrap items-end rounded-b-2xl px-2 py-1.5"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.75)',
              zIndex: 2,
            }}
          >
            <View className="flex-row flex-wrap items-center">
              {limitedTags.map((tag, idx) => (
                <View
                  key={idx}
                  className="mb-0.5 mr-1 rounded-full px-1.5 py-0.5"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                >
                  <Text 
                    className="text-[9px] font-medium text-gray-800" 
                    numberOfLines={1}
                    style={{ maxWidth: 50 }}
                  >
                    {tag}
                  </Text>
                </View>
              ))}
              {extraCount > 0 && (
                <View 
                  className="mb-0.5 rounded-full px-1.5 py-0.5" 
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                >
                  <Text className="text-[9px] font-medium text-gray-800">+{extraCount}</Text>
                </View>
              )}
            </View>
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
      return (
        <PhotoTile 
          asset={item} 
          isSelected={isSelected} 
          onToggleSelect={onToggleSelect} 
          onOpenTagModal={onOpenTagModal}
          onLongPress={onLongPress}
          isAutoTagging={isAutoTagging}
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
      contentContainerStyle={{ padding: 4, paddingBottom: 100 }}
      columnWrapperStyle={{ paddingHorizontal: 2 }}
      showsVerticalScrollIndicator={true}
      refreshing={refreshing}
      onRefresh={onRefresh}
      scrollIndicatorInsets={{ right: 1 }}
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
