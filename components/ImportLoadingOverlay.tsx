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
  processedCount?: number; // Number of images processed (before import)
  importedCount: number;
  autoTaggingCount: number;
  successfullyAutoTaggedCount?: number;
  currentPhoto?: number;
  onDismiss?: () => void; // Callback when overlay should dismiss (after import completes)
};

export function ImportLoadingOverlay({
  visible,
  totalPhotos,
  processedCount = 0,
  importedCount,
  autoTaggingCount,
  successfullyAutoTaggedCount = 0,
  onDismiss,
}: ImportLoadingOverlayProps) {
  const insets = useSafeAreaInsets();
  
  // Separate animation values for smoother, more controlled animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkOpacity = useRef(new Animated.Value(0)).current;
  const checkmarkIconScale = useRef(new Animated.Value(0)).current; // Subtle icon animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const spinnerScale = useRef(new Animated.Value(0)).current;
  const spinnerOpacity = useRef(new Animated.Value(0)).current;
  
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);
  const [lastTotalPhotos, setLastTotalPhotos] = useState(totalPhotos);
  
  // Animation refs - optimized timeout types for React Native
  const shimmerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const checkmarkTimeoutRef = useRef<number | null>(null);
  const spinnerFadeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const checkmarkAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Determine phase: processing -> importing -> complete
  const phase = useMemo(() => {
    const isImportComplete = importedCount === totalPhotos && totalPhotos > 0;
    const isProcessing = processedCount < totalPhotos && totalPhotos > 0;
    const isImporting = processedCount === totalPhotos && importedCount < totalPhotos && totalPhotos > 0;
    
    if (isImportComplete) {
      return 'complete';
    } else if (isProcessing) {
      return 'processing';
    } else if (isImporting) {
      return 'importing';
    } else {
      // Default to importing if we have photos but processing is complete
      return totalPhotos > 0 ? 'importing' : 'processing';
    }
  }, [importedCount, processedCount, totalPhotos]);

  // Calculate progress: 0 to 1
  const progress = useMemo(() => {
    if (totalPhotos === 0) return 0;
    
    if (phase === 'processing') {
      // Processing phase: 0 to 0.5 (first half of progress bar)
      return (processedCount / totalPhotos) * 0.5;
    } else if (phase === 'importing') {
      // Importing phase: 0.5 to 1 (second half of progress bar)
      return 0.5 + (importedCount / totalPhotos) * 0.5;
    } else {
      return 1; // Complete
    }
  }, [phase, processedCount, importedCount, totalPhotos]);

  // Spinner color - consistent across all phases (gold to match app)
  const spinnerColor = COLORS.accent;

  // Auto-dismiss when import completes - consumer-grade animation with proper cleanup
  useEffect(() => {
    // Cleanup any pending timeouts and animations
    if (checkmarkTimeoutRef.current) {
      clearTimeout(checkmarkTimeoutRef.current);
      checkmarkTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (spinnerFadeAnimationRef.current) {
      spinnerFadeAnimationRef.current.stop();
      spinnerFadeAnimationRef.current = null;
    }
    if (checkmarkAnimationRef.current) {
      checkmarkAnimationRef.current.stop();
      checkmarkAnimationRef.current = null;
    }

    // Reset checkmark state when not complete
    if (phase !== 'complete') {
      setShowCheckmark(false);
      checkmarkScale.setValue(0);
      checkmarkOpacity.setValue(0);
      checkmarkIconScale.setValue(0);
      return;
    }

    if (phase === 'complete' && visible && onDismiss) {
      // If there are photos queued for tagging, show longer to display the message
      const hasQueuedTagging = autoTaggingCount > 0;
      const displayDuration = hasQueuedTagging ? 2000 : 1500;
      
      // Consumer-grade smooth transition: fade out spinner, then show checkmark
      // Use a small delay to ensure state is ready, then start spinner fade
      checkmarkTimeoutRef.current = setTimeout(() => {
        // Stop any running spinner animations first
        if (spinnerFadeAnimationRef.current) {
          spinnerFadeAnimationRef.current.stop();
        }
        
        // Fade out spinner smoothly (250ms for polished feel)
        spinnerFadeAnimationRef.current = Animated.timing(spinnerOpacity, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic), // Smooth fade out
          useNativeDriver: true,
        });
        
        spinnerFadeAnimationRef.current.start((finished) => {
          // Always show checkmark, even if spinner animation was interrupted
          if (!finished) {
            spinnerOpacity.setValue(0); // Ensure spinner is hidden
          }
          
          // Set checkmark visible state FIRST (before animation)
          // This ensures React re-renders and the checkmark container exists
          setShowCheckmark(true);
          
          // Small delay to ensure DOM update, then start animation
          // Use requestAnimationFrame equivalent for React Native
          setTimeout(() => {
            // Reset checkmark animation values
            checkmarkScale.setValue(0);
            checkmarkOpacity.setValue(0);
            checkmarkIconScale.setValue(0);
            
            // Consumer-grade checkmark entrance: smooth scale + fade with delightful bounce
            checkmarkAnimationRef.current = Animated.sequence([
              // Phase 1: Scale up with spring bounce + fade in (parallel)
              Animated.parallel([
                Animated.spring(checkmarkScale, {
                  toValue: 1.12, // Subtle overshoot for premium feel
                  tension: 120,
                  friction: 8,
                  useNativeDriver: true,
                }),
                Animated.timing(checkmarkOpacity, {
                  toValue: 1,
                  duration: 350,
                  delay: 50, // Slight delay for smoother appearance
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                // Icon scales in slightly delayed for polished feel
                Animated.spring(checkmarkIconScale, {
                  toValue: 1,
                  tension: 150,
                  friction: 10,
                  delay: 100,
                  useNativeDriver: true,
                }),
              ]),
              // Phase 2: Settle to final size with smooth spring
              Animated.parallel([
                Animated.spring(checkmarkScale, {
                  toValue: 1,
                  tension: 100,
                  friction: 12,
                  useNativeDriver: true,
                }),
                Animated.spring(checkmarkIconScale, {
                  toValue: 1,
                  tension: 100,
                  friction: 12,
                  useNativeDriver: true,
                }),
              ]),
            ]);
            
            checkmarkAnimationRef.current.start((animFinished) => {
              if (animFinished) {
                // Haptic feedback when checkmark fully appears (premium feel)
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            });

            // Dismiss after showing checkmark
            hideTimeoutRef.current = setTimeout(() => {
              setShouldHide(true);
              // Call onDismiss after exit animation completes
              setTimeout(() => {
                onDismiss();
              }, 300);
            }, displayDuration);
          }, 16); // ~1 frame delay for smooth state update
        });
      }, 100); // Small delay to ensure phase transition is complete
    }

    return () => {
      // Cleanup all timeouts
      if (checkmarkTimeoutRef.current) {
        clearTimeout(checkmarkTimeoutRef.current);
        checkmarkTimeoutRef.current = null;
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      // Cleanup all animations
      if (spinnerFadeAnimationRef.current) {
        spinnerFadeAnimationRef.current.stop();
        spinnerFadeAnimationRef.current = null;
      }
      if (checkmarkAnimationRef.current) {
        checkmarkAnimationRef.current.stop();
        checkmarkAnimationRef.current = null;
      }
    };
  }, [phase, visible, onDismiss, checkmarkScale, checkmarkOpacity, checkmarkIconScale, spinnerOpacity, autoTaggingCount]);

  // Spinner entrance animation - separate for smoother control
  useEffect(() => {
    // Don't animate spinner if checkmark is showing or should be showing
    if (showCheckmark || phase === 'complete') {
      return;
    }
    
    if (visible && (phase === 'importing' || phase === 'processing')) {
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
    } else if (!visible) {
      // Reset when not visible
      spinnerScale.setValue(0);
      spinnerOpacity.setValue(0);
    }
  }, [visible, phase, spinnerScale, spinnerOpacity, showCheckmark]);

  // Shimmer animation on progress bar - only when processing or importing and visible
  useEffect(() => {
    if (!visible || (phase !== 'importing' && phase !== 'processing')) {
      if (shimmerAnimationRef.current) {
        shimmerAnimationRef.current.stop();
        shimmerAnimationRef.current = null;
      }
      return;
    }

    // Only start shimmer if not already running
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

    return () => {
      if (shimmerAnimationRef.current) {
        shimmerAnimationRef.current.stop();
        shimmerAnimationRef.current = null;
      }
    };
  }, [visible, phase, shimmerAnim]);

  // Progress bar animation - smooth timing (not spring) to prevent choppiness
  // Spring animations can be choppy when progress updates frequently
  useEffect(() => {
    if (!visible || phase === 'complete') {
      return;
    }

    // Use timing with easing for smooth, predictable updates
    // This prevents choppiness when progress changes rapidly
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 250, // Smooth transition duration
      easing: Easing.out(Easing.ease), // Smooth easing curve
      useNativeDriver: true, // Uses scaleX transform for performance
    }).start();
  }, [visible, phase, progress, progressAnim]);

  // Entrance animation - staggered for smoother appearance (production approach)
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
      checkmarkIconScale.setValue(0);
      spinnerScale.setValue(0);
      spinnerOpacity.setValue(0);
      
      // Staggered entrance - background first, then content (smoother than parallel)
      Animated.sequence([
        // Background fade in first
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Content scale in with spring, text fades in parallel
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 120,
            friction: 16,
            useNativeDriver: true,
          }),
          // Text fade in with staggered delays
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
      // Exit animation - parallel for faster dismissal
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
  }, [visible, shouldHide, fadeAnim, scaleAnim, titleOpacity, subtitleOpacity]);

  // Store last known totalPhotos when complete
  useEffect(() => {
    if (totalPhotos > 0) {
      setLastTotalPhotos(totalPhotos);
    }
  }, [totalPhotos]);

  // Checkmark is now handled in the auto-dismiss effect above

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

  // Memoized text content - prevents unnecessary string calculations
  const displayTotalPhotos = useMemo(() => {
    return shouldHide || phase === 'complete' ? lastTotalPhotos : totalPhotos;
  }, [shouldHide, phase, lastTotalPhotos, totalPhotos]);
  
  const titleText = useMemo(() => {
    if (shouldHide || phase === 'complete') {
      return 'Import Complete';
    }
    if (phase === 'processing') {
      return displayTotalPhotos > 0 ? 'Processing Photos' : 'Preparing...';
    }
    return displayTotalPhotos > 0 ? 'Importing Photos' : 'Preparing...';
  }, [shouldHide, phase, displayTotalPhotos]);

  const subtitleText = useMemo(() => {
    if (shouldHide || phase === 'complete') {
      if (displayTotalPhotos > 0) {
        const photoText = importedCount !== 1 ? 'photos' : 'photo';
        const taggingText = autoTaggingCount > 0 ? ' • Auto-tagging in background' : '';
        return `${importedCount} ${photoText} imported${taggingText}`;
      }
      return '';
    }
    if (phase === 'processing') {
      if (displayTotalPhotos > 0) {
        return `${processedCount} of ${displayTotalPhotos} processed`;
      }
      return '';
    }
    if (displayTotalPhotos > 0) {
      const taggingText = autoTaggingCount > 0 ? ` • ${autoTaggingCount} queued for tagging` : '';
      return `${importedCount} of ${displayTotalPhotos} imported${taggingText}`;
    }
    return '';
  }, [shouldHide, phase, displayTotalPhotos, processedCount, importedCount, autoTaggingCount]);

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
            {/* Spinner - fades out when complete */}
            {phase !== 'complete' && (
              <Animated.View
                style={[
                  styles.spinnerContainer,
                  {
                    transform: [{ scale: spinnerScale }],
                    opacity: spinnerOpacity,
                  },
                ]}
              >
                <ActivityIndicator 
                  size="large" 
                  color={spinnerColor}
                  style={styles.spinner}
                />
              </Animated.View>
            )}
            
            {/* Checkmark - appears smoothly after spinner fades */}
            {showCheckmark && phase === 'complete' && (
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
                  <Animated.View
                    style={{
                      transform: [{ scale: checkmarkIconScale }],
                    }}
                  >
                    <MaterialCommunityIcons name="check" size={48} color="#FFFFFF" />
                  </Animated.View>
                </View>
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
          {(phase === 'processing' || phase === 'importing') && (
            <Animated.View style={[styles.progressContainer, { opacity: titleOpacity }]}>
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
    position: 'absolute', // Allow checkmark to overlay smoothly
  },
  spinner: {
    // Native ActivityIndicator - simple and reliable
  },
  checkmarkContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute', // Overlay on spinner for smooth transition
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
