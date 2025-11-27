import { TouchableOpacity, Animated, Easing, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';

type FloatingActionButtonProps = {
  icon: string;
  onPress: () => void;
  color?: string;
  visible?: boolean;
};

export function FloatingActionButton({ 
  icon, 
  onPress, 
  color = '#D4A574', // Vibrant, saturated gold - more prominent while staying true to brand
  visible = true 
}: FloatingActionButtonProps) {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animate FAB entrance
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom + 20, 40),
        right: 20,
        opacity: opacityAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          // Enhanced shadow for depth and prominence
          shadowColor: color,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.6,
          shadowRadius: 20,
          elevation: 12,
          // Subtle inner highlight for premium feel
          borderWidth: 0,
        }}
      >
        {/* Inner highlight for depth */}
        <View
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            right: 4,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
          }}
        />
        <MaterialCommunityIcons name={icon as any} size={32} color="#ffffff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

