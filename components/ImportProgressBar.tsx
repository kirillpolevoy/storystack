import { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

// Try to import BlurView, fallback to regular View if not available
let BlurView: any = null;
try {
  BlurView = require('expo-blur').BlurView;
} catch {
  // BlurView not available, will use regular View
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  background: 'rgba(255, 255, 255, 0.95)',
  backgroundDark: 'rgba(0, 0, 0, 0.85)',
  accent: '#b38f5b',
  success: '#34C759',
  textPrimary: '#000000',
  textSecondary: 'rgba(0, 0, 0, 0.6)',
  progressTrack: 'rgba(0, 0, 0, 0.1)',
  progressFill: '#b38f5b',
};

type ImportProgressBarProps = {
  visible: boolean;
  totalPhotos: number;
  importedCount: number;
  currentPhoto?: number;
};

export function ImportProgressBar({
  visible,
  totalPhotos,
  importedCount,
}: ImportProgressBarProps) {
  const insets = useSafeAreaInsets();
  
  const translateY = useRef(new Animated.Value(100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  
  const progress = useMemo(() => {
    if (totalPhotos === 0) return 0;
    return importedCount / totalPhotos;
  }, [importedCount, totalPhotos]);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 100,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacityAnim]);

  // Animate progress
  useEffect(() => {
    if (visible) {
      Animated.spring(progressAnim, {
        toValue: progress,
        tension: 65,
        friction: 10,
        useNativeDriver: false, // scaleX doesn't work with native driver
      }).start();
    }
  }, [visible, progress, progressAnim]);

  const progressScaleX = useMemo(
    () =>
      progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    [progressAnim]
  );

  if (!visible && opacityAnim._value === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity: opacityAnim,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
      pointerEvents="box-none"
    >
      {Platform.OS === 'ios' && BlurView ? (
        <BlurView intensity={80} tint="light" style={styles.blurContainer}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="upload" size={20} color={COLORS.accent} />
            </View>
            
            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1}>
                Importing {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {importedCount} of {totalPhotos}
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      transform: [{ scaleX: progressScaleX }, { translateX: -50 }],
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </BlurView>
      ) : (
        <View style={styles.solidContainer}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="upload" size={20} color={COLORS.accent} />
            </View>
            
            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1}>
                Importing {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {importedCount} of {totalPhotos}
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      transform: [{ scaleX: progressScaleX }, { translateX: -50 }],
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    elevation: 9998,
  },
  blurContainer: {
    borderRadius: 0,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  solidContainer: {
    backgroundColor: COLORS.background,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(179, 143, 91, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textSecondary,
    letterSpacing: -0.2,
  },
  progressContainer: {
    width: 60,
    height: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '100%',
    backgroundColor: COLORS.progressFill,
    borderRadius: 2,
  },
});









