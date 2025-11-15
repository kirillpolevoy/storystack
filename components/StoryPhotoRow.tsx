import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { Asset } from '@/types';

type StoryPhotoRowProps = {
  asset: Asset;
  index: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export function StoryPhotoRow({
  asset,
  index,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}: StoryPhotoRowProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.98,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.9,
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
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      <View
        className="mb-3 flex-row items-center rounded-2xl bg-white px-4 py-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        {/* Index Badge */}
        <View
          className="mr-3 h-8 w-8 items-center justify-center rounded-full"
          style={{
            backgroundColor: '#b38f5b',
          }}
        >
          <Text className="text-[13px] font-bold text-white">{index + 1}</Text>
        </View>

        {/* Thumbnail */}
        <View className="mr-3 overflow-hidden rounded-xl">
          {asset.publicUrl ? (
            <Image
              source={{ uri: asset.publicUrl }}
              className="h-16 w-16"
              resizeMode="cover"
              style={{ backgroundColor: '#f5f5f5' }}
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center bg-gray-100">
              <Text className="text-[10px] text-gray-400">Loading</Text>
            </View>
          )}
        </View>

        {/* Content Area */}
        <View className="flex-1">
          {asset.tags.length > 0 ? (
            <Text className="text-[13px] font-medium text-gray-700" numberOfLines={1}>
              {asset.tags[0]}
            </Text>
          ) : (
            <Text className="text-[13px] text-gray-400">No tags</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View className="flex-row items-center gap-2">
          {/* Move Up */}
          <TouchableOpacity
            onPress={() => {
              handlePress();
              onMoveUp?.();
            }}
            disabled={!canMoveUp}
            activeOpacity={0.6}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: canMoveUp ? 'rgba(179, 143, 91, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <Text style={{ fontSize: 16, color: canMoveUp ? '#b38f5b' : '#d1d5db' }}>↑</Text>
          </TouchableOpacity>

          {/* Move Down */}
          <TouchableOpacity
            onPress={() => {
              handlePress();
              onMoveDown?.();
            }}
            disabled={!canMoveDown}
            activeOpacity={0.6}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: canMoveDown ? 'rgba(179, 143, 91, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <Text style={{ fontSize: 16, color: canMoveDown ? '#b38f5b' : '#d1d5db' }}>↓</Text>
          </TouchableOpacity>

          {/* Remove */}
          {onRemove && (
            <TouchableOpacity
              onPress={() => {
                handlePress();
                onRemove();
              }}
              activeOpacity={0.6}
              className="ml-1 h-8 w-8 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }}
            >
              <Text style={{ fontSize: 16, color: '#ef4444' }}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}


