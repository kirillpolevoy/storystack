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
        className="mb-4 flex-row items-center rounded-2xl bg-white px-4 py-4"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        {/* Thumbnail with Index Badge Overlay */}
        <View className="mr-4 relative">
          {asset.publicUrl ? (
            <Image
              source={{ uri: asset.publicUrl }}
              className="h-24 w-24 rounded-xl"
              resizeMode="cover"
              style={{ backgroundColor: '#f5f5f5' }}
            />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-xl bg-gray-100">
              <Text className="text-[10px] text-gray-400">Loading</Text>
            </View>
          )}
          {/* Index Badge - Overlay on thumbnail corner */}
          <View
            className="absolute -top-1 -left-1 h-6 w-6 items-center justify-center rounded-full"
            style={{
              backgroundColor: '#b38f5b',
              borderWidth: 2,
              borderColor: '#ffffff',
            }}
          >
            <Text className="text-[10px] font-bold text-white">{index + 1}</Text>
          </View>
        </View>

        {/* Content Area */}
        <View className="flex-1">
          {/* Tags as pills */}
          {asset.tags.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5 mb-2">
              {asset.tags.slice(0, 3).map((tag, tagIndex) => (
                <View
                  key={tagIndex}
                  className="px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'rgba(179, 143, 91, 0.1)',
                  }}
                >
                  <Text className="text-[11px] font-medium" style={{ color: '#b38f5b' }}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-[13px] text-gray-400 mb-2">No tags</Text>
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
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: canMoveUp ? 'rgba(179, 143, 91, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <Text style={{ fontSize: 18, color: canMoveUp ? '#b38f5b' : '#d1d5db', fontWeight: '600' }}>▲</Text>
          </TouchableOpacity>

          {/* Move Down */}
          <TouchableOpacity
            onPress={() => {
              handlePress();
              onMoveDown?.();
            }}
            disabled={!canMoveDown}
            activeOpacity={0.6}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: canMoveDown ? 'rgba(179, 143, 91, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <Text style={{ fontSize: 18, color: canMoveDown ? '#b38f5b' : '#d1d5db', fontWeight: '600' }}>▼</Text>
          </TouchableOpacity>

          {/* Remove */}
          {onRemove && (
            <TouchableOpacity
              onPress={() => {
                handlePress();
                onRemove();
              }}
              activeOpacity={0.6}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }}
            >
              <Text style={{ fontSize: 20, color: '#ef4444', fontWeight: '600' }}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}


