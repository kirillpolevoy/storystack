import { StatusBar, View, Text, Animated, Easing, InteractionManager, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Component, ReactNode, useState, useEffect, Suspense, useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DelightfulLoadingScreen } from '@/components/DelightfulLoadingScreen';
import { hasCompletedOnboarding } from '@/utils/onboarding';

// Keep splash screen visible while we load
SplashScreen.preventAutoHideAsync();

// Lazy load router and gesture handler to prevent crashes
let Slot: any;
let GestureHandlerRootView: any;

try {
  Slot = require('expo-router').Slot;
} catch (e) {
  console.error('[RootLayout] Failed to load Slot:', e);
  Slot = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
        Failed to load router
      </Text>
    </View>
  );
}

try {
  GestureHandlerRootView = require('react-native-gesture-handler').GestureHandlerRootView;
} catch (e) {
  console.warn('[RootLayout] GestureHandlerRootView not available:', e);
  GestureHandlerRootView = View;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fafafa' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#000' }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
            Please restart the app
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const loadingScreenMountedRef = useRef(false);
  const loadingScreenLaidOutRef = useRef(false);

  // Safety timeout: Force app to show after 5 seconds to prevent infinite loading
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (!hasNavigated) {
        console.warn('[RootLayout] Safety timeout: Forcing navigation');
        setHasNavigated(true);
      }
      if (!showContent) {
        console.warn('[RootLayout] Safety timeout: Forcing content display');
        setShowContent(true);
      }
    }, 5000);

    return () => clearTimeout(safetyTimer);
  }, [hasNavigated, showContent]);

  useEffect(() => {
    // Optimized: Hide splash as soon as loading screen is ready, proceed immediately after
    const prepare = async () => {
      try {
        // Step 1: Wait for loading screen to mount AND layout (reduced timeout)
        let attempts = 0;
        const maxAttempts = 50; // Reduced from 200 (800ms max instead of 3.2s)
        while ((!loadingScreenMountedRef.current || !loadingScreenLaidOutRef.current) && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 16));
          attempts++;
        }
        
        // Step 2: Minimal delay to ensure paint is complete
        await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 500ms
        
        // Step 3: Wait for InteractionManager (if available)
        if (InteractionManager && typeof InteractionManager.runAfterInteractions === 'function') {
          await new Promise(resolve => {
            InteractionManager.runAfterInteractions(() => {
              // Step 4: Reduced frame waits - 2 frames should be sufficient
              requestAnimationFrame(() => {
                requestAnimationFrame(async () => {
                  // Hide splash - React has painted
                  await SplashScreen.hideAsync();
                  setSplashHidden(true);
                  resolve(undefined);
                });
              });
            });
          });
        } else {
          // Fallback: Reduced frame waits
          await new Promise(resolve => {
            requestAnimationFrame(() => {
              requestAnimationFrame(async () => {
                await SplashScreen.hideAsync();
                setSplashHidden(true);
                resolve(undefined);
              });
            });
          });
        }
        
        // Step 5: Proceed immediately - no additional delays needed
        // Content will show when auth is ready and navigation completes
        setIsReady(true);
      } catch (error) {
        console.error('[RootLayout] Error during initialization:', error);
        SplashScreen.hideAsync().catch(() => {});
        setSplashHidden(true);
        setTimeout(() => setIsReady(true), 500); // Reduced fallback delay
      }
    };

    prepare();
  }, []);

  // Check onboarding status when user is authenticated - must happen before navigation
  useEffect(() => {
    if (!isReady || loading) {
      if (!loading && !session) {
        // No session and not loading - mark onboarding as checked (no need to check)
        setOnboardingChecked(true);
        setCheckingOnboarding(false);
        setShouldShowOnboarding(false);
      }
      return;
    }

    if (!session) {
      setOnboardingChecked(true);
      setCheckingOnboarding(false);
      setShouldShowOnboarding(false);
      return;
    }

    // Check onboarding immediately - this should happen before redirecting to /
    const checkOnboarding = async () => {
      try {
        setCheckingOnboarding(true);
        console.log('[RootLayout] Checking onboarding status for user:', session.user.id);
        const completed = await hasCompletedOnboarding(session.user.id);
        console.log('[RootLayout] Onboarding completed:', completed);
        
        // Set flag based on onboarding status
        setShouldShowOnboarding(!completed);
        setOnboardingChecked(true);
        setCheckingOnboarding(false);
        
        console.log('[RootLayout] shouldShowOnboarding:', !completed);
        
        // If user hasn't completed onboarding and is on a non-auth screen, redirect
        if (!completed) {
          const currentSegment = segments[0];
          console.log('[RootLayout] Current segment:', currentSegment);
          if (currentSegment !== 'onboarding' && currentSegment !== 'login' && currentSegment !== 'signup' && currentSegment !== 'auth') {
            console.log('[RootLayout] Redirecting to onboarding from segment:', currentSegment);
            router.replace('/onboarding');
          }
        }
      } catch (error) {
        console.error('[RootLayout] Error checking onboarding:', error);
        // On error, assume onboarding is completed to not block the app
        setOnboardingChecked(true);
        setCheckingOnboarding(false);
        setShouldShowOnboarding(false);
      }
    };

    // Check immediately - no delay
    checkOnboarding();
  }, [session, loading, isReady, router, segments]);

  useEffect(() => {
    // Don't proceed until ready and auth state is loaded
    if (!isReady || loading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';
    const isAuthCallback = segments[0] === 'auth' && segments[1] === 'callback';
    const isOnboardingScreen = segments[0] === 'onboarding';

    // Don't redirect if we're on the auth callback screen or onboarding screen
    if (isAuthCallback || isOnboardingScreen) {
      setHasNavigated(true);
      return;
    }

    // Wait for onboarding check to complete before navigating authenticated users
    if (session && !onboardingChecked) {
      return; // Wait for onboarding check to complete
    }

    // Check if we need to navigate
    if (!session && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
      // Wait a bit for navigation to complete
      setTimeout(() => setHasNavigated(true), 200);
    } else if (session && inAuthGroup && onboardingChecked && !checkingOnboarding) {
      // Redirect based on onboarding status
      console.log('[RootLayout] Navigating authenticated user from auth screen. shouldShowOnboarding:', shouldShowOnboarding);
      if (shouldShowOnboarding) {
        // User hasn't completed onboarding - redirect there
        console.log('[RootLayout] Redirecting to /onboarding');
        router.replace('/onboarding');
      } else {
        // User completed onboarding - go to main app
        console.log('[RootLayout] Redirecting to /');
        router.replace('/');
      }
      // Wait a bit for navigation to complete
      setTimeout(() => setHasNavigated(true), 200);
    } else if (onboardingChecked || !session) {
      // Already on the correct screen - mark as navigated
      setHasNavigated(true);
    }
  }, [session, loading, segments, isReady, router, onboardingChecked, shouldShowOnboarding, checkingOnboarding]);

  // Smooth transition: fade out loading screen before showing content
  useEffect(() => {
    if (isReady && !loading && hasNavigated) {
      // Start fade out of loading screen, then show content after fade completes
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 350); // Wait for fade out animation (300ms) + small buffer
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isReady, loading, hasNavigated]);

  // Content fade animation
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (showContent) {
      // Fade in content smoothly
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      contentFadeAnim.setValue(0);
    }
  }, [showContent]);

  const shouldShowLoading = !isReady || loading || !hasNavigated || !showContent;
  
  // CRITICAL: Render loading screen FIRST, unconditionally
  // This ensures it's in the DOM before we try to hide splash
  return (
    <>
      {/* IMMEDIATE background - prevents ANY black screen */}
      <View 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: '#fafafa',
          zIndex: 0,
        }} 
      />
      
      {/* Loading screen - ALWAYS rendered FIRST, no conditions */}
      <DelightfulLoadingScreen 
        splashHidden={splashHidden} 
        isExiting={isReady && !loading && hasNavigated && !showContent}
        onMount={() => {
          loadingScreenMountedRef.current = true;
        }}
        onLayout={() => {
          loadingScreenLaidOutRef.current = true;
        }}
      />
      
      {/* Content - rendered underneath, invisible until ready */}
      {!shouldShowLoading && (
        <ErrorBoundary>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
                <StatusBar barStyle="dark-content" />
                <Suspense fallback={<LoadingFallback />}>
                  <Animated.View style={{ flex: 1, opacity: showContent ? contentFadeAnim : 0 }}>
                    <Slot />
                  </Animated.View>
                </Suspense>
              </View>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </ErrorBoundary>
      )}
    </>
  );
}

function LoadingFallback() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateAnimation.start();

    return () => rotateAnimation.stop();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' }}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Animated.View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 2.5,
            borderColor: '#e5e7eb',
            borderTopColor: '#b38f5b',
            transform: [{ rotate }],
            marginBottom: 16,
          }}
        />
        <Text style={{ fontSize: 15, fontWeight: '500', color: '#6b7280', letterSpacing: 0.3 }}>
          Loading...
        </Text>
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

