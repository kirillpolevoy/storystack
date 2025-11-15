import { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type TagRowProps = {
  tagName: string;
  isAutoTag: boolean;
  onToggle: () => void;
  onPress?: () => void;
  onDelete?: () => void;
  isToggling?: boolean;
  usageCount?: number;
};

export const TagRow = memo(function TagRow({ 
  tagName, 
  isAutoTag, 
  onToggle, 
  onPress, 
  onDelete,
  isToggling = false,
  usageCount = 0
}: TagRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Subtle animation when state changes
  useEffect(() => {
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
    ]).start();
  }, [isAutoTag]);

  const handlePress = () => {
    // Light press animation on the icon when toggling
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.9,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.7,
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

    onToggle();
  };

  const renderRightActions = () => {
    if (!onDelete) return null;
    
    return (
      <View className="flex-row items-center justify-end">
        <TouchableOpacity
          onPress={() => {
            swipeableRef.current?.close();
            onDelete();
          }}
          activeOpacity={0.9}
          style={{ 
            backgroundColor: '#FF3B30',
            height: '100%',
            minHeight: 52,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
          }}
        >
          <Text 
            className="text-white"
            style={{ 
              fontSize: 17,
              fontWeight: '400',
              letterSpacing: -0.41,
            }}
          >
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const rowContent = (
    <Pressable
      onPress={onPress || handlePress}
      disabled={isToggling}
      className="flex-row items-center justify-between px-4 py-3.5 bg-white"
      style={{ minHeight: 52 }}
    >
      <View className="flex-1 pr-4">
        <View className="flex-row items-center">
          <Text
            className="text-[16px] font-medium text-gray-900"
            numberOfLines={1}
            style={{ letterSpacing: -0.2 }}
          >
            {tagName}
          </Text>
          {usageCount > 0 && (
            <View className="ml-2 rounded-full bg-gray-100 px-2 py-0.5">
              <Text className="text-[11px] font-medium text-gray-600">
                {usageCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          handlePress();
        }}
        disabled={isToggling}
      >
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
          className="px-1 py-1"
        >
          <MaterialCommunityIcons
            name="star-four-points"
            size={18}
            color={isAutoTag ? '#b38f5b' : '#c4c4c4'}
            style={{ opacity: isAutoTag ? 1 : 0.4 }}
          />
        </Animated.View>
      </Pressable>
    </Pressable>
  );

  if (onDelete) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        {rowContent}
      </Swipeable>
    );
  }

  return rowContent;
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.tagName === nextProps.tagName &&
    prevProps.isAutoTag === nextProps.isAutoTag &&
    prevProps.isToggling === nextProps.isToggling &&
    prevProps.usageCount === nextProps.usageCount &&
    prevProps.onToggle === nextProps.onToggle &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onDelete === nextProps.onDelete
  );
});

