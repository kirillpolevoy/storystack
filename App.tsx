import { Component, ReactNode } from 'react';
import { View, Text } from 'react-native';

// Lazy load ExpoRoot to prevent early native module initialization
let ExpoRoot: any;
try {
  ExpoRoot = require('expo-router').ExpoRoot;
} catch (e) {
  console.error('[App] Failed to load ExpoRoot:', e);
  ExpoRoot = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
        Failed to load app router
      </Text>
    </View>
  );
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
  try {
    const ctx = require.context('./app');
    return (
      <AppErrorBoundary>
        <ExpoRoot context={ctx} />
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
