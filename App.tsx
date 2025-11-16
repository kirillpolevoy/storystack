import { Component, ReactNode, useState, useEffect } from 'react';
import { View, Text, AppState, AppStateStatus } from 'react-native';

// Delay loading ExpoRoot until native modules are definitely ready
let ExpoRoot: any = null;
let isExpoRootLoaded = false;

function loadExpoRoot() {
  if (isExpoRootLoaded) return ExpoRoot;
  
  try {
    ExpoRoot = require('expo-router').ExpoRoot;
    isExpoRootLoaded = true;
    return ExpoRoot;
  } catch (e) {
    console.error('[App] Failed to load ExpoRoot:', e);
    return null;
  }
}

class AppErrorBoundary extends Component<
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
    console.error('[App] Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fafafa' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#000' }}>
            App failed to start
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>('active');

  useEffect(() => {
    // Wait for app to be in active state and native modules to be ready
    const prepare = async () => {
      try {
        // Wait for app state to be active (ensures native bridge is ready)
        if (appState !== 'active') {
          const subscription = AppState.addEventListener('change', (nextAppState) => {
            setAppState(nextAppState);
            if (nextAppState === 'active') {
              subscription.remove();
              // Longer delay on first launch
              setTimeout(() => setIsReady(true), 2000);
            }
          });
          return () => subscription.remove();
        }
        
        // Longer delay on first launch to ensure all native modules are initialized
        // This helps prevent ObjCTurboModule crashes on first app open
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Additional stabilization delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setIsReady(true);
      } catch (error) {
        console.error('[App] Error during preparation:', error);
        // Still try to load after longer delay
        setTimeout(() => setIsReady(true), 3000);
      }
    };

    prepare();
  }, [appState]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' }}>
        <Text style={{ fontSize: 16, color: '#666' }}>Initializing...</Text>
      </View>
    );
  }

  try {
    const RootComponent = loadExpoRoot();
    if (!RootComponent) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fafafa' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#000' }}>
            Failed to load router
          </Text>
        </View>
      );
    }

    const ctx = require.context('./app');
    return (
      <AppErrorBoundary>
        <RootComponent context={ctx} />
      </AppErrorBoundary>
    );
  } catch (error) {
    console.error('[App] Error initializing:', error);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fafafa' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#000' }}>
          Failed to initialize app
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
      </View>
    );
  }
}
