import { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, Easing, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DELIGHTFUL_MESSAGES = [
  'Curating your stories...',
  'Preparing something beautiful...',
  'Almost there...',
  'Just a moment...',
  'Making it perfect...',
];

// Apple-style color palette - warm and inviting
const COLORS = {
  background: '#fafafa',
  accent: '#b38f5b',
  accentLight: '#d4a574',
  accentLighter: '#f5e6d3',
  text: '#1a1a1a',
  textSecondary: '#6b7280',
};

type DelightfulLoadingScreenProps = {
  splashHidden?: boolean;
  isExiting?: boolean;
  onMount?: () => void;
  onLayout?: () => void;
};

export function DelightfulLoadingScreen({ splashHidden = false, isExiting = false, onMount, onLayout }: DelightfulLoadingScreenProps) {
  // Core animations - Apple-style smooth and delightful
  // CRITICAL FIX: Start at opacity 1 immediately - no black screen
  // Loading screen renders behind splash, becomes visible when splash hides
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const messageOpacity = useRef(new Animated.Value(1)).current;
  // Glow overlay opacity (can use native driver)
  const glowOverlayOpacity = useRef(new Animated.Value(0.3)).current;
  
  const [messageIndex, setMessageIndex] = useState(0);

  // Notify parent immediately on mount - critical for timing
  useEffect(() => {
    if (onMount) {
      // Call immediately - component is mounted
      onMount();
    }
  }, [onMount]);

  useEffect(() => {
    if (isExiting) {
      // Smooth fade out when transitioning to content
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
      return;
    }

    // No fade-in needed - already visible at opacity 1
    // Loading screen is always visible, splash covers it initially
    // When splash hides, loading screen is already there - no black screen!

    // Continuous rotation - perfectly smooth
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateAnimation.start();

    // Breathing pulse - organic and alive
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Gentle floating - like a feather
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    floatAnimation.start();

    // Subtle glow effect - using opacity overlay (native driver compatible)
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOverlayOpacity, {
          toValue: 0.5,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOverlayOpacity, {
          toValue: 0.3,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    glowAnimation.start();

    // Smooth message transitions with delightful timing
    const messageInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(messageOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
      setMessageIndex((prev) => (prev + 1) % DELIGHTFUL_MESSAGES.length);
    }, 2800);

    return () => {
      rotateAnimation.stop();
      pulseAnimation.stop();
      floatAnimation.stop();
      glowAnimation.stop();
      clearInterval(messageInterval);
    };
  }, [splashHidden, isExiting, fadeAnim, scaleAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <Animated.View
      onLayout={() => {
        // CRITICAL: Notify parent that layout is complete
        // This ensures the component is fully laid out and painted
        if (onLayout) {
          // Use requestAnimationFrame to ensure paint is complete
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              onLayout();
            });
          });
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        opacity: fadeAnim, // Starts at 1, always visible
        zIndex: 9999, // On top of content
      }}
    >
      {/* Warm, inviting background - Apple's delightful approach */}
      <Animated.View
        style={{
          position: 'absolute',
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          backgroundColor: COLORS.background,
          opacity: fadeAnim,
        }}
      />
      {/* Soft radial gradient effect */}
      <Animated.View
        style={{
          position: 'absolute',
          width: SCREEN_WIDTH * 0.85,
          height: SCREEN_HEIGHT * 0.85,
          backgroundColor: COLORS.accentLighter,
          opacity: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.12],
          }),
          borderRadius: SCREEN_WIDTH * 0.425,
          transform: [{ translateX: SCREEN_WIDTH * 0.075 }, { translateY: SCREEN_HEIGHT * 0.075 }],
        }}
      />
      {/* Subtle accent glow */}
      <Animated.View
        style={{
          position: 'absolute',
          width: SCREEN_WIDTH * 0.6,
          height: SCREEN_WIDTH * 0.6,
          backgroundColor: COLORS.accentLight,
          opacity: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.08],
          }),
          borderRadius: SCREEN_WIDTH * 0.3,
          transform: [
            { translateX: SCREEN_WIDTH * 0.2 },
            { translateY: SCREEN_HEIGHT * 0.5 - SCREEN_WIDTH * 0.3 },
          ],
        }}
      />

      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }, { translateY: floatY }],
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        {/* Logo/Icon Container - Matching login screen exactly */}
        <Animated.View
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 30,
            backgroundColor: COLORS.accent,
            shadowColor: COLORS.accent,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 12,
            transform: [{ scale: pulseAnim }, { translateY: floatY }],
          }}
        >
          {/* Inner glow effect - matching login screen exactly */}
          <View
            style={{
              position: 'absolute',
              width: 96,
              height: 96,
              borderRadius: 24,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          />
          <Text
            style={{
              fontSize: 48,
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: -1.5,
              zIndex: 1,
            }}
          >
            S
          </Text>
        </Animated.View>

        {/* App Name - Warm and inviting typography */}
        <Animated.Text
          style={{
            fontSize: 31,
            fontWeight: '700',
            color: COLORS.text,
            letterSpacing: -0.7,
            marginBottom: 8,
            opacity: fadeAnim,
          }}
        >
          StoryStack
        </Animated.Text>

        {/* Rotating Subtitle Messages - delightful transitions */}
        <Animated.View
          style={{
            height: 24,
            marginBottom: 56,
            opacity: messageOpacity,
            justifyContent: 'center',
            minWidth: 200,
          }}
        >
          <Text
            style={{
              fontSize: 15.5,
              fontWeight: '400',
              color: COLORS.textSecondary,
              letterSpacing: -0.25,
              textAlign: 'center',
            }}
          >
            {DELIGHTFUL_MESSAGES[messageIndex]}
          </Text>
        </Animated.View>

        {/* Loading Indicator - Delightful spinner with personality */}
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <Animated.View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 2.5,
              borderColor: 'rgba(179, 143, 91, 0.18)',
              borderTopColor: COLORS.accent,
              borderRightColor: COLORS.accentLight,
              transform: [{ rotate }],
            }}
          />
          {/* Subtle inner glow dot */}
          <View
            style={{
              position: 'absolute',
              top: 15,
              left: 15,
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: COLORS.accent,
              opacity: 0.6,
            }}
          />
        </View>
      </Animated.View>

    </Animated.View>
  );
}

