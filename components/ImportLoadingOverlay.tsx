import { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Platform, Dimensions, ActivityIndicator } from 'react-native';
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

// Try to import LinearGradient, fallback to regular View if not available
let LinearGradient: any = null;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  // LinearGradient not available, will use regular View
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  background: '#FFFFFF',
  accent: '#b38f5b', // Gold - matches app color scheme
  accentLight: '#c9a575', // Lighter gold
  success: '#34C759',
  textPrimary: '#000000',
  textSecondary: 'rgba(0, 0, 0, 0.6)',
  progressTrack: 'rgba(0, 0, 0, 0.1)',
  progressFill: '#b38f5b', // Gold - matches app color scheme
  progressGradient: ['#b38f5b', '#c9a575', '#d4b890'], // Gold gradient
};

type ImportLoadingOverlayProps = {
  visible: boolean;
  totalPhotos: number;
  importedCount: number;
  autoTaggingCount: number;
  currentPhoto?: number;
};

export function ImportLoadingOverlay({
  visible,
  totalPhotos,
  importedCount,
  autoTaggingCount,
}: ImportLoadingOverlayProps) {
  const insets = useSafeAreaInsets();
  
  // Simple animation values - consumer-grade approach
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const spinnerScale = useRef(new Animated.Value(0)).current;
  const spinnerOpacity = useRef(new Animated.Value(0)).current;
  
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);
  const [lastTotalPhotos, setLastTotalPhotos] = useState(totalPhotos);
  
  // Animation refs
  const shimmerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine phase: importing -> tagging -> complete
  const phase = useMemo(() => {
    const isImportComplete = importedCount === totalPhotos && totalPhotos > 0;
    const isTaggingComplete = autoTaggingCount === 0;
    
    if (isImportComplete && isTaggingComplete) {
      return 'complete';
    } else if (isImportComplete && autoTaggingCount > 0) {
      return 'tagging';
    } else {
      return 'importing';
    }
  }, [importedCount, totalPhotos, autoTaggingCount]);

  // Calculate progress: 0 to 1
  const progress = useMemo(() => {
    if (totalPhotos === 0) return 0;
    
    if (phase === 'importing') {
      return importedCount / totalPhotos;
    } else if (phase === 'tagging') {
      return 1.0; // Keep at 100% during tagging
    } else {
      return 1;
    }
  }, [phase, importedCount, totalPhotos, autoTaggingCount]);

  // Spinner color - consistent across all phases (gold to match app)
  const spinnerColor = COLORS.accent;

  // Haptic feedback on phase changes
  useEffect(() => {
    if (phase === 'tagging') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (phase === 'complete') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [phase]);

  // Simple spinner entrance animation
  useEffect(() => {
    if (visible && (phase === 'importing' || phase === 'tagging')) {
      spinnerScale.setValue(0);
      spinnerOpacity.setValue(0);
      
      Animated.parallel([
        Animated.spring(spinnerScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(spinnerOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      spinnerScale.setValue(0);
      spinnerOpacity.setValue(0);
    }
  }, [visible, phase]);

  // Shimmer animation on progress bar
  useEffect(() => {
    if (!visible) {
      if (shimmerAnimationRef.current) {
        shimmerAnimationRef.current.stop();
        shimmerAnimationRef.current = null;
      }
      return;
    }

    if (phase === 'importing' || phase === 'tagging') {
      if (!shimmerAnimationRef.current) {
        shimmerAnimationRef.current = Animated.loop(
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
        shimmerAnimationRef.current.start();
      }
    } else {
      if (shimmerAnimationRef.current) {
        shimmerAnimationRef.current.stop();
        shimmerAnimationRef.current = null;
      }
    }

    return () => {
      if (shimmerAnimationRef.current && !visible) {
        shimmerAnimationRef.current.stop();
        shimmerAnimationRef.current = null;
      }
    };
  }, [visible, phase]);

  // Progress bar animation - smooth spring
  useEffect(() => {
    if (!visible || phase === 'complete') {
      return;
    }

    Animated.spring(progressAnim, {
      toValue: progress,
      tension: 65,
      friction: 10,
      useNativeDriver: true, // Uses scaleX transform
    }).start();
  }, [visible, phase, progress]);

  // Entrance animation - refined Apple-style
  useEffect(() => {
    if (visible && !shouldHide) {
      // Reset values
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.96);
      titleOpacity.setValue(0);
      subtitleOpacity.setValue(0);
      progressAnim.setValue(0);
      checkmarkScale.setValue(0);
      checkmarkOpacity.setValue(0);
      
      // Staggered entrance
      Animated.sequence([
        // Background fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Content scale in with spring
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 120,
            friction: 16,
            useNativeDriver: true,
          }),
          // Text fade in
          Animated.parallel([
            Animated.timing(titleOpacity, {
              toValue: 1,
              duration: 350,
              delay: 50,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(subtitleOpacity, {
              toValue: 1,
              duration: 350,
              delay: 100,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    } else if (shouldHide) {
      // Exit animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.96,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldHide(false);
      });
    }
  }, [visible, shouldHide]);

  // Store last known totalPhotos when complete
  useEffect(() => {
    if (totalPhotos > 0) {
      setLastTotalPhotos(totalPhotos);
    }
  }, [totalPhotos]);

  // Checkmark animation when complete
  useEffect(() => {
    if (phase === 'complete' && visible && !shouldHide) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      setTimeout(() => {
        setShowCheckmark(true);
        Animated.parallel([
          Animated.spring(checkmarkScale, {
            toValue: 1.1,
            tension: 100,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.timing(checkmarkOpacity, {
            toValue: 1,
            duration: 400,
            delay: 100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Settle to final size
          Animated.spring(checkmarkScale, {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }).start();
        });

        // After showing checkmark for 2 seconds, trigger hide
        hideTimeoutRef.current = setTimeout(() => {
          setShouldHide(true);
        }, 2000);
      }, 150);
    } else {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      if (!shouldHide) {
        checkmarkScale.setValue(0);
        checkmarkOpacity.setValue(0);
        setShowCheckmark(false);
      }
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [phase, visible, shouldHide]);

  // Interpolated values
  const progressScaleX = useMemo(
    () =>
      progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    [progressAnim]
  );

  const shimmerTranslate = useMemo(
    () =>
      shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 200],
      }),
    [shimmerAnim]
  );

  // Text content
  const displayTotalPhotos = shouldHide || phase === 'complete' ? lastTotalPhotos : totalPhotos;
  
  const titleText =
    shouldHide || phase === 'complete'
      ? 'Complete'
      : phase === 'tagging'
      ? 'Tagging Photos'
      : displayTotalPhotos > 0
      ? 'Importing Photos'
      : 'Preparing...';

  const subtitleText =
    shouldHide || phase === 'complete'
      ? displayTotalPhotos > 0
        ? `${displayTotalPhotos} photo${displayTotalPhotos !== 1 ? 's' : ''} imported and tagged`
        : ''
      : displayTotalPhotos > 0
      ? phase === 'tagging'
        ? `${autoTaggingCount} remaining`
        : `${importedCount} of ${displayTotalPhotos}`
      : '';

  if (!visible && !shouldHide) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Background with blur */}
      <View style={StyleSheet.absoluteFill}>
        {Platform.OS === 'ios' && BlurView ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background }]}>
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background }]} />
        )}
      </View>

      {/* Content */}
      <View style={[styles.contentContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Spinner/Checkmark Container */}
          <View style={styles.iconContainer}>
            {showCheckmark && phase === 'complete' ? (
              <Animated.View
                style={[
                  styles.checkmarkContainer,
                  {
                    transform: [{ scale: checkmarkScale }],
                    opacity: checkmarkOpacity,
                  },
                ]}
              >
                <View style={styles.checkmarkCircle}>
                  <MaterialCommunityIcons name="check" size={48} color="#FFFFFF" />
                </View>
              </Animated.View>
            ) : (
              <Animated.View
                style={[
                  styles.spinnerContainer,
                  {
                    transform: [{ scale: spinnerScale }],
                    opacity: spinnerOpacity,
                  },
                ]}
              >
                {/* Consumer-grade: Use native ActivityIndicator */}
                <ActivityIndicator 
                  size="large" 
                  color={spinnerColor}
                  style={styles.spinner}
                />
              </Animated.View>
            )}
          </View>

          {/* Title */}
          <Animated.View style={[styles.titleContainer, { opacity: titleOpacity }]}>
            <Text style={styles.title}>{titleText}</Text>
          </Animated.View>

          {/* Subtitle */}
          {displayTotalPhotos > 0 && (
            <Animated.View style={[styles.subtitleContainer, { opacity: subtitleOpacity }]}>
              <Text style={styles.subtitle}>{subtitleText}</Text>
            </Animated.View>
          )}

          {/* Progress Bar */}
          {(phase === 'importing' || phase === 'tagging') && (
            <Animated.View style={[styles.progressContainer, { opacity: subtitleOpacity }]}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      transform: [{ scaleX: progressScaleX }],
                    },
                  ]}
                >
                  {LinearGradient ? (
                    <LinearGradient
                      colors={COLORS.progressGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.progressFill }]} />
                  )}
                  <Animated.View
                    style={[
                      styles.progressShimmer,
                      {
                        transform: [{ translateX: shimmerTranslate }],
                      },
                    ]}
                  />
                </Animated.View>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 9999,
    elevation: 9999,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 48,
  },
  iconContainer: {
    width: 120,
    height: 120,
    marginBottom: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    // Native ActivityIndicator - simple and reliable
  },
  checkmarkContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  titleContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.9,
    textAlign: 'center',
    color: COLORS.textPrimary,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
    }),
  },
  subtitleContainer: {
    marginBottom: 40,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.4,
    textAlign: 'center',
    color: COLORS.textSecondary,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
    }),
  },
  progressContainer: {
    width: '100%',
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFillContainer: {
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  progressShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    transform: [{ skewX: '-20deg' }],
  },
});
