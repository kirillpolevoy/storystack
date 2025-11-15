import { StatusBar, View, Text } from 'react-native';
import { Component, ReactNode, useState, useEffect, Suspense } from 'react';
import * as SplashScreen from 'expo-splash-screen';

// Keep splash screen visible while we load
SplashScreen.preventAutoHideAsync();

// Lazy load ALL native modules to prevent crashes
let Slot: any;
let GestureHandlerRootView: any;
let SafeAreaProvider: any;

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

try {
  SafeAreaProvider = require('react-native-safe-area-context').SafeAreaProvider;
} catch (e) {
  console.warn('[RootLayout] SafeAreaProvider not available:', e);
  SafeAreaProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
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

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for native modules to be ready before rendering
    const prepare = async () => {
      try {
        // Give native modules time to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsReady(true);
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('[RootLayout] Error during initialization:', error);
        setIsReady(true); // Still try to render even if splash screen fails
      }
    };

    prepare();
  }, []);

  if (!isReady) {
    return null; // Splash screen will show
  }

  try {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
              <StatusBar barStyle="dark-content" />
              <Suspense
                fallback={
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, color: '#666' }}>Loading...</Text>
                  </View>
                }
              >
                <Slot />
              </Suspense>
            </View>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('[RootLayout] Error rendering:', error);
    SplashScreen.hideAsync().catch(() => {});
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fafafa' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#000' }}>
          Failed to load app
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
      </View>
    );
  }
}

