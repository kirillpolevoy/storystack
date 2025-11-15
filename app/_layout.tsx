import { Slot } from 'expo-router';
import { StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
          <StatusBar barStyle="dark-content" />
          <Slot />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

