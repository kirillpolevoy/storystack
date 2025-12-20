import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing, Dimensions, Alert } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.85);

type MenuItem = {
  id: string;
  label: string;
  icon: string;
  route: string;
  onPress?: () => void;
};

type MenuDrawerProps = {
  visible: boolean;
  onClose: () => void;
};

export function MenuDrawer({ visible, onClose }: MenuDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (visible && !isAnimatingOut) {
      // Reset animating out state
      setIsAnimatingOut(false);
      
      // Open animation - Apple's refined spring physics
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.bezier(0.2, 0, 0, 1),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 26,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Handle close with animation
  const handleClose = () => {
    if (!visible || isAnimatingOut) return;
    
    setIsAnimatingOut(true);
    
    // Start close animation
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: DRAWER_WIDTH,
        duration: 250,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Animation complete, call onClose and reset state
      setIsAnimatingOut(false);
      onClose();
    });
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/login');
            } catch (error) {
              console.error('[MenuDrawer] Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Main navigation items - primary app sections
  const mainMenuItems: MenuItem[] = [
    {
      id: 'library',
      label: 'Your Photos',
      icon: 'image-multiple',
      route: '/',
    },
    {
      id: 'stories',
      label: 'Your Stories',
      icon: 'book-multiple',
      route: '/stories',
    },
    {
      id: 'tags',
      label: 'Tag Management',
      icon: 'tag-multiple',
      route: '/tag-management',
    },
  ];

  // Secondary items - help and profile
  const secondaryMenuItems: MenuItem[] = [
    {
      id: 'onboarding',
      label: 'How to',
      icon: 'help-circle-outline',
      route: '/onboarding',
    },
    {
      id: 'profile',
      label: 'Your Profile',
      icon: 'account-circle-outline',
      route: '/profile',
    },
  ];

  const handleMenuItemPress = (item: MenuItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Start close animation
    handleClose();
    
    // Navigate after animation starts
    setTimeout(() => {
      if (item.onPress) {
        item.onPress();
      } else {
        // For onboarding, add skipCompletion param so it doesn't mark as completed
        if (item.id === 'onboarding') {
          router.push(`${item.route}?skipCompletion=true` as any);
        } else {
          router.push(item.route as any);
        }
      }
    }, 100);
  };

  // Determine if a menu item is active
  const isActiveRoute = (route: string) => {
    if (route === '/' && pathname === '/') return true;
    if (route !== '/' && pathname.startsWith(route)) return true;
    return false;
  };

  return (
    <Modal
      visible={visible || isAnimatingOut}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Backdrop - Refined opacity */}
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={handleClose}
        >
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              opacity: backdropOpacity,
            }}
          />
        </TouchableOpacity>

        {/* Drawer */}
        <Animated.View
          style={{
            width: DRAWER_WIDTH,
            height: '100%',
            backgroundColor: '#ffffff',
            transform: [{ translateX: slideAnim }],
            shadowColor: '#000000',
            shadowOffset: { width: -2, height: 0 },
            shadowOpacity: 0.1,
            shadowRadius: 16,
            elevation: 16,
          }}
        >
          {/* Header - Minimal, Apple-style */}
          <View
            style={{
              paddingTop: Math.max(insets.top + 16, 44),
              paddingBottom: 24,
              paddingHorizontal: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={handleClose}
                activeOpacity={0.6}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#f5f5f7',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name="close" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Menu Content */}
          <View style={{ flex: 1, paddingTop: 8 }}>
            {/* Workspace Switcher Section - Premium placement */}
            <View
              style={{
                paddingHorizontal: 20,
                paddingBottom: 20,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(0, 0, 0, 0.08)',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#8e8e93',
                  letterSpacing: -0.1,
                  marginBottom: 12,
                  textTransform: 'uppercase',
                }}
              >
                Workspace
              </Text>
              <WorkspaceSwitcher />
            </View>

            {/* Main Navigation Section */}
            <View style={{ paddingBottom: 8 }}>
              {mainMenuItems.map((item) => {
                const isActive = isActiveRoute(item.route);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleMenuItemPress(item)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      marginHorizontal: 12,
                      marginVertical: 1,
                      borderRadius: 10,
                      backgroundColor: isActive ? 'rgba(212, 165, 116, 0.1)' : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: isActive 
                          ? 'rgba(212, 165, 116, 0.15)' 
                          : 'rgba(0, 0, 0, 0.04)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={18}
                        color={isActive ? '#D4A574' : '#6b7280'}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: isActive ? '600' : '500',
                        color: isActive ? '#111827' : '#374151',
                        letterSpacing: -0.2,
                        flex: 1,
                      }}
                    >
                      {item.label}
                    </Text>
                    {isActive && (
                      <View
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: 1.5,
                          backgroundColor: '#D4A574',
                        }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: '#f3f4f6',
                marginHorizontal: 20,
                marginVertical: 8,
              }}
            />

            {/* Secondary Navigation Section */}
            <View style={{ paddingBottom: 8 }}>
              {secondaryMenuItems.map((item) => {
                const isActive = isActiveRoute(item.route);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleMenuItemPress(item)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      marginHorizontal: 12,
                      marginVertical: 1,
                      borderRadius: 10,
                      backgroundColor: isActive ? 'rgba(212, 165, 116, 0.1)' : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: isActive 
                          ? 'rgba(212, 165, 116, 0.15)' 
                          : 'rgba(0, 0, 0, 0.04)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={18}
                        color={isActive ? '#D4A574' : '#6b7280'}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: isActive ? '600' : '500',
                        color: isActive ? '#111827' : '#374151',
                        letterSpacing: -0.2,
                        flex: 1,
                      }}
                    >
                      {item.label}
                    </Text>
                    {isActive && (
                      <View
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: 1.5,
                          backgroundColor: '#D4A574',
                        }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sign Out Section - Separated at bottom */}
            <View style={{ marginTop: 'auto', paddingTop: 16, paddingBottom: Math.max(insets.bottom + 20, 40) }}>
              <View
                style={{
                  height: 1,
                  backgroundColor: '#e5e7eb',
                  marginHorizontal: 20,
                  marginBottom: 12,
                }}
              />
              <TouchableOpacity
                onPress={handleSignOut}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  marginHorizontal: 12,
                  borderRadius: 10,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <MaterialCommunityIcons
                    name="logout"
                    size={18}
                    color="#ef4444"
                  />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#ef4444',
                    letterSpacing: -0.2,
                  }}
                >
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

