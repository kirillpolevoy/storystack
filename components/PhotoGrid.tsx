import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Dimensions, Easing, FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Asset } from '@/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  recentlyTaggedAssets?: Set<string>;
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
  showSuccessIndicator,
}: {
  asset: Asset;
  isSelected: boolean;
  onToggleSelect: (asset: Asset) => void;
  onOpenTagModal: (asset: Asset) => void;
  onLongPress?: (asset: Asset) => void;
  isAutoTagging?: boolean;
  isMultiSelectMode: boolean;
  showSuccessIndicator?: boolean;
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

  // Animate success indicator with Apple-style spring physics
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.5)).current; // Start smaller for more dramatic pop
  const checkmarkScale = useRef(new Animated.Value(0)).current; // Separate animation for checkmark

  // Use refs to track timeouts for proper cleanup
  const checkmarkTimeoutRef = useRef<number | null>(null);
  const fadeOutTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Cleanup any pending timeouts
    if (checkmarkTimeoutRef.current) {
      clearTimeout(checkmarkTimeoutRef.current);
      checkmarkTimeoutRef.current = null;
    }
    if (fadeOutTimeoutRef.current) {
      clearTimeout(fadeOutTimeoutRef.current);
      fadeOutTimeoutRef.current = null;
    }

    if (showSuccessIndicator) {
      // Haptic feedback for success (Apple-style)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Staggered animation: badge appears first, then checkmark pops in
      // Badge animation - smooth spring with slight overshoot (Apple-style)
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          tension: 200, // Higher tension for snappier feel
          friction: 7, // Lower friction for more bounce
          useNativeDriver: true,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 200, // Reduced from 250ms for snappier feel
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Checkmark animation - delayed pop for delightful detail
      checkmarkTimeoutRef.current = setTimeout(() => {
        Animated.spring(checkmarkScale, {
          toValue: 1,
          tension: 300,
          friction: 5,
          useNativeDriver: true,
        }).start();
      }, 100);

      // Animate out after 4 seconds (balanced visibility without being intrusive)
      fadeOutTimeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(successOpacity, {
            toValue: 0,
            duration: 300, // Reduced from 400ms for snappier exit
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(successScale, {
            toValue: 0.9, // Slight scale down on exit
            duration: 300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      }, 4000);
    } else {
      // Reset when indicator is hidden
      successOpacity.setValue(0);
      successScale.setValue(0.5);
      checkmarkScale.setValue(0);
    }

    // Cleanup function
    return () => {
      if (checkmarkTimeoutRef.current) {
        clearTimeout(checkmarkTimeoutRef.current);
      }
      if (fadeOutTimeoutRef.current) {
        clearTimeout(fadeOutTimeoutRef.current);
      }
    };
  }, [showSuccessIndicator, successOpacity, successScale, checkmarkScale]);

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
            transition={100}
            cachePolicy="memory-disk"
            priority="low"
            recyclingKey={asset.id}
            allowDownscaling={true}
            placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
            style={{
              backgroundColor: '#f5f5f5',
            }}
            // Performance optimizations
            contentPosition="center"
            enableLiveTextInteraction={false}
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
        {isAutoTagging && !showSuccessIndicator && (
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

        {/* Success indicator - Apple-style design: subtle, delightful, clear */}
        {showSuccessIndicator && (
          <Animated.View 
            className="absolute right-2 top-2 z-10"
            style={{
              opacity: successOpacity,
              transform: [{ scale: successScale }],
              shadowColor: '#22c55e',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            {/* Circular badge with blur backdrop for depth (Apple-style) */}
            <View 
              className="h-6 w-6 items-center justify-center rounded-full"
              style={{
                backgroundColor: '#22c55e', // iOS system green
                // Subtle inner shadow for depth
                borderWidth: 0.5,
                borderColor: 'rgba(255, 255, 255, 0.3)',
              }}
            >
              {/* Animated checkmark with pop effect */}
              <Animated.View
                style={{
                  transform: [{ scale: checkmarkScale }],
                }}
              >
                <MaterialCommunityIcons 
                  name="check" 
                  size={14} 
                  color="#ffffff" 
                  style={{ fontWeight: '700' }}
                />
              </Animated.View>
            </View>
          </Animated.View>
        )}

        {/* No Tags Applied indicator - Show for any photo with no tags that's not currently being tagged */}
        {/* Hide when success indicator is showing to avoid flicker */}
        {!isAutoTagging && !showSuccessIndicator && asset.tags.length === 0 && (
          <View 
            className="absolute right-2 top-2 z-10"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.12,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <View 
              className="rounded-full px-2.5 py-1"
              style={{
                backgroundColor: asset.auto_tag_status === 'failed' 
                  ? 'rgba(254, 243, 199, 0.95)' // Light orange/amber for failed
                  : 'rgba(243, 244, 246, 0.95)', // Light gray for pending/null
              }}
            >
              <Text 
                className="text-[9px] font-semibold" 
                style={{ 
                  letterSpacing: -0.1,
                  color: asset.auto_tag_status === 'failed' ? '#92400e' : '#6b7280',
                }}
              >
                No Tags Applied
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
    prevProps.isMultiSelectMode === nextProps.isMultiSelectMode &&
    prevProps.asset.tags.length === nextProps.asset.tags.length &&
    prevProps.asset.auto_tag_status === nextProps.asset.auto_tag_status &&
    prevProps.showSuccessIndicator === nextProps.showSuccessIndicator
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
  recentlyTaggedAssets = new Set(),
}: PhotoGridProps) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  
  // Create selected assets Set for O(1) lookup
  const selectedAssetsSet = useMemo(() => {
    return new Set(selectedAssets.map(asset => asset.id));
  }, [selectedAssets]);

  // Memoized render function for each photo tile
  // Optimized: Pre-compute all props to avoid repeated lookups
  const renderItem = useCallback(({ item: asset }: { item: Asset }) => {
    const isSelected = selectedAssetsSet.has(asset.id);
    const isAutoTagging = autoTaggingAssets?.has(asset.id) ?? false;
    // Also show loading if status is pending (for background retries)
    const isPendingAutoTag = isAutoTagging || asset.auto_tag_status === 'pending';
    const showSuccessIndicator = recentlyTaggedAssets?.has(asset.id) ?? false;
    
    return (
      <PhotoTile
        asset={asset}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        onOpenTagModal={onOpenTagModal}
        onLongPress={onLongPress}
        isAutoTagging={isPendingAutoTag}
        isMultiSelectMode={isSelectionMode}
        showSuccessIndicator={showSuccessIndicator}
      />
    );
  }, [selectedAssetsSet, autoTaggingAssets, recentlyTaggedAssets, isSelectionMode, onToggleSelect, onOpenTagModal, onLongPress]);

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: Asset) => item.id, []);

  // Extra data for FlatList - tells it to re-render when these change
  // Critical for auto-tagging indicators to update properly
  const extraData = useMemo(() => {
    return {
      autoTaggingCount: autoTaggingAssets.size,
      recentlyTaggedCount: recentlyTaggedAssets.size,
      isSelectionMode,
      selectedCount: selectedAssets.length,
    };
  }, [autoTaggingAssets.size, recentlyTaggedAssets.size, isSelectionMode, selectedAssets.length]);

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
    <FlatList
      data={assets}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      extraData={extraData}
      numColumns={3}
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
      // Performance optimizations for Instagram-level smoothness
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={15}
      windowSize={10}
      // Smooth scrolling
      decelerationRate="normal"
      bounces={true}
      scrollEventThrottle={16}
    />
  );
}
