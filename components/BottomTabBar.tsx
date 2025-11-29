import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform, Easing } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

const TAB_CONFIG = [
  {
    id: 'library',
    route: '/',
    icon: 'view-grid-outline',
    iconActive: 'view-grid',
    label: 'Library',
  },
  {
    id: 'stories',
    route: '/stories',
    icon: 'book-outline',
    iconActive: 'book',
    label: 'Stories',
  },
  {
    id: 'add',
    route: null, // Special button - no route
    icon: 'plus-circle-outline',
    iconActive: 'plus-circle',
    label: 'Add',
    isSpecial: true, // Middle button
  },
  {
    id: 'tags',
    route: '/tag-management',
    icon: 'tag-outline',
    iconActive: 'tag',
    label: 'Tags',
  },
  {
    id: 'profile',
    route: '/profile',
    icon: 'account-outline',
    iconActive: 'account',
    label: 'Profile',
  },
] as const;

type BottomTabBarProps = {
  onAddPress?: () => void;
};

export function BottomTabBar({ onAddPress }: BottomTabBarProps) {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  
  // Determine current route
  const currentRoute = segments.length > 0 ? `/${segments[0]}` : '/';
  
  // Animation refs for each tab - refined Apple spring physics
  const tabAnimations = useRef(
    TAB_CONFIG.map(() => new Animated.Value(0))
  ).current;
  const tabOpacityAnimations = useRef(
    TAB_CONFIG.map((_, index) => {
      // Initialize based on current route
      const tab = TAB_CONFIG[index];
      const isActive = tab.route && currentRoute === tab.route;
      return new Animated.Value(isActive ? 1 : 0.6);
    })
  ).current;
  const indicatorAnimations = useRef(
    TAB_CONFIG.map(() => new Animated.Value(0))
  ).current;
  const middleButtonScale = useRef(new Animated.Value(1)).current;

  // Update animations based on active tab - Apple's refined spring physics
  useEffect(() => {
    TAB_CONFIG.forEach((tab, index) => {
      if (tab.route && currentRoute === tab.route) {
        // Active tab - refined spring animation with perfect timing
        Animated.parallel([
          Animated.spring(tabAnimations[index], {
            toValue: 1,
            tension: 110,
            friction: 28,
            useNativeDriver: true,
          }),
          Animated.timing(tabOpacityAnimations[index], {
            toValue: 1,
            duration: 180,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.spring(indicatorAnimations[index], {
            toValue: 1,
            tension: 180,
            friction: 18,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Inactive tab - smooth fade out with refined timing
        Animated.parallel([
          Animated.spring(tabAnimations[index], {
            toValue: 0,
            tension: 110,
            friction: 28,
            useNativeDriver: true,
          }),
          Animated.timing(tabOpacityAnimations[index], {
            toValue: 0.65,
            duration: 180,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.spring(indicatorAnimations[index], {
            toValue: 0,
            tension: 180,
            friction: 18,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });
  }, [currentRoute]);

  const handleTabPress = (tab: typeof TAB_CONFIG[number]) => {
    if (tab.isSpecial) {
      // Middle button - refined press animation
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Press animation - refined Apple-style bounce
      Animated.sequence([
        Animated.spring(middleButtonScale, {
          toValue: 0.88,
          tension: 400,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(middleButtonScale, {
          toValue: 1,
          tension: 350,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
      
      if (onAddPress && currentRoute === '/') {
        // On Library screen - trigger import directly
        onAddPress();
      } else {
        // On other screens - navigate to Library
        if (currentRoute !== '/') {
          router.push('/' as any);
        }
      }
    } else if (tab.route) {
      // Regular tab - refined haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (currentRoute !== tab.route) {
        router.push(tab.route as any);
      }
    }
  };

  const isActive = (tab: typeof TAB_CONFIG[number]) => {
    if (tab.isSpecial) return false;
    return tab.route === currentRoute;
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
      ]}
    >
      {TAB_CONFIG.map((tab, index) => {
        const active = isActive(tab);
        const scale = tabAnimations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.08],
        });
        
        // Icon scale for more refined active state
        const iconScale = tabAnimations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.05],
        });

        if (tab.isSpecial) {
          // Middle button - refined Apple-style prominence
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.specialButton}
              onPress={() => handleTabPress(tab)}
              activeOpacity={1}
            >
              <Animated.View
                style={[
                  styles.specialButtonInner,
                  {
                    transform: [{ scale: middleButtonScale }],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={tab.iconActive}
                  size={28}
                  color="#FFFFFF"
                />
              </Animated.View>
            </TouchableOpacity>
          );
        }

        // Active indicator dot - refined spring animation
        const indicatorScale = indicatorAnimations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        });
        
        const indicatorOpacity = indicatorAnimations[index].interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 0, 1],
        });

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => handleTabPress(tab)}
            activeOpacity={0.6}
          >
            <Animated.View
              style={[
                styles.tabContent,
                {
                  transform: [{ scale }],
                },
              ]}
            >
              <Animated.View 
                style={[
                  styles.iconContainer,
                  {
                    transform: [{ scale: iconScale }],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={active ? tab.iconActive : tab.icon}
                  size={22}
                  color={active ? '#b38f5b' : '#8E8E93'}
                />
              </Animated.View>
              
              <Animated.Text
                style={[
                  styles.tabLabel,
                  {
                    color: active ? '#b38f5b' : '#8E8E93',
                    fontWeight: active ? '600' : '500',
                    opacity: tabOpacityAnimations[index],
                  },
                ]}
              >
                {tab.label}
              </Animated.Text>
              
              {/* Active indicator dot - positioned below label text */}
              <Animated.View
                style={[
                  styles.activeIndicator,
                  {
                    opacity: indicatorOpacity,
                    transform: [{ scale: indicatorScale }],
                  },
                ]}
              />
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 1000,
    elevation: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: {
        elevation: 1000,
      },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 66,
    position: 'relative',
    overflow: 'visible',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  iconContainer: {
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.12,
    marginTop: 2,
    marginBottom: 4,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  activeIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#b38f5b',
    alignSelf: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#b38f5b',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.9,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  specialButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 64,
    paddingHorizontal: 12,
  },
  specialButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#b38f5b',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#b38f5b',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
});

