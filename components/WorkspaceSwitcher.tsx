import { useState, useRef, useEffect } from 'react';
import { 
  Modal, 
  TouchableOpacity, 
  View, 
  Text, 
  ScrollView, 
  Alert,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Try to import BlurView, fallback to regular View if not available
let BlurView: any = null;
try {
  BlurView = require('expo-blur').BlurView;
} catch (e) {
  BlurView = View;
}
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { WorkspaceAvatar } from './WorkspaceAvatar';
import { Workspace } from '@/types';

type WorkspaceSwitcherProps = {
  position?: 'left' | 'center' | 'right';
  onMenuClose?: () => void; // Callback to close parent menu drawer before opening workspace sheet
  externalModalOpen?: boolean; // External control of modal state
  onExternalModalChange?: (open: boolean) => void; // Callback when modal state should change externally
  showButton?: boolean; // Whether to show the button (default: true, false when rendering modal-only)
};

export function WorkspaceSwitcher({ position = 'left', onMenuClose, externalModalOpen, onExternalModalChange, showButton = true }: WorkspaceSwitcherProps) {
  const {
    activeWorkspace,
    workspaces,
    switchWorkspace,
    loading,
  } = useWorkspace();
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Use external state if provided, otherwise use internal state
  const isModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
  const setIsModalOpen = (open: boolean) => {
    if (onExternalModalChange) {
      onExternalModalChange(open);
    } else {
      setInternalModalOpen(open);
    }
  };

  // Apple-grade animations - refined spring physics
  const modalTranslateY = useRef(new Animated.Value(1000)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isModalOpen) {
      // Smooth sheet animation
      Animated.parallel([
        Animated.spring(modalTranslateY, {
          toValue: 0,
          tension: 70,
          friction: 13,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset for next open
      modalTranslateY.setValue(1000);
      backdropOpacity.setValue(0);
    }
  }, [isModalOpen]);

  const handleWorkspacePress = async (workspace: Workspace) => {
    if (workspace.id === activeWorkspace?.id) {
      // Already active - just close
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      handleClose();
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await switchWorkspace(workspace.id);
      
      // Close with smooth animation
      handleClose();
    } catch (error) {
      console.error('[WorkspaceSwitcher] Error switching workspace:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Unable to Switch',
        error instanceof Error ? error.message : 'Please try again'
      );
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(modalTranslateY, {
        toValue: 1000,
        tension: 70,
        friction: 13,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsModalOpen(false);
    });
  };

  const handleButtonPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Subtle press animation
    Animated.parallel([
      Animated.spring(buttonScale, {
        toValue: 0.98,
        tension: 350,
        friction: 22,
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.spring(buttonScale, {
          toValue: 1,
          tension: 350,
          friction: 22,
          useNativeDriver: true,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    });
    
    // Sequential flow: Close menu drawer first, then open workspace sheet
    if (onMenuClose) {
      // Close the drawer first
      onMenuClose();
      // Wait for drawer close animation (250ms) before opening workspace sheet
      setTimeout(() => {
        setIsModalOpen(true);
      }, 280); // Slightly longer than drawer close animation for smooth transition
    } else {
      // Fallback: open immediately if no menu close callback
      setIsModalOpen(true);
    }
  };

  if (loading || !activeWorkspace) {
    return (
      <View
        style={{
          height: 50,
          borderRadius: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
        }}
      />
    );
  }

  return (
    <>
      {/* Menu-Integrated Button - Render if showButton is true */}
      {showButton && (
        <Animated.View
          style={{
            transform: [{ scale: buttonScale }],
            opacity: buttonOpacity,
          }}
        >
          <Pressable
            onPress={handleButtonPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderRadius: 10,
              backgroundColor: pressed ? 'rgba(0, 0, 0, 0.03)' : 'transparent',
            })}
          >
            {/* Avatar Container - Matches menu icon styling */}
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
                overflow: 'hidden',
              }}
            >
              <WorkspaceAvatar workspace={activeWorkspace} size={28} showName={false} />
            </View>
            
            {/* Workspace Info */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#111827',
                  letterSpacing: -0.2,
                }}
                numberOfLines={1}
              >
                {activeWorkspace.name}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '400',
                  color: '#6b7280',
                  letterSpacing: -0.1,
                  marginTop: 1,
                }}
              >
                {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
              </Text>
            </View>
            
            {/* Chevron - Subtle indicator */}
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color="#6b7280"
              style={{ marginLeft: 4 }}
            />
          </Pressable>
        </Animated.View>
      )}

      {/* Consumer-Grade Modal Sheet - Always render modal */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={{ flex: 1 }}>
          {/* Backdrop */}
          <Pressable
            onPress={handleClose}
            style={{ flex: 1 }}
          >
            <Animated.View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                opacity: backdropOpacity,
              }}
            />
          </Pressable>

          {/* Sheet Content */}
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transform: [{ translateY: modalTranslateY }],
            }}
          >
            <BlurView
              intensity={95}
              tint="light"
              style={{
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.99)',
                paddingBottom: Math.max(insets.bottom, 20),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 20,
              }}
            >
              {/* Handle Indicator */}
              <View
                style={{
                  alignItems: 'center',
                  paddingTop: 8,
                  paddingBottom: 4,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 3.5,
                    borderRadius: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  }}
                />
              </View>

              {/* Header */}
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 8,
                  paddingBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: '#000000',
                    letterSpacing: -0.5,
                  }}
                >
                  Workspaces
                </Text>
              </View>

              {/* Workspaces List */}
              <ScrollView
                style={{ maxHeight: 420 }}
                showsVerticalScrollIndicator={false}
                bounces={true}
                contentContainerStyle={{
                  paddingBottom: 8,
                }}
              >
                {workspaces.map((workspace) => {
                  const isActive = workspace.id === activeWorkspace?.id;
                  return (
                    <Pressable
                      key={workspace.id}
                      onPress={() => handleWorkspacePress(workspace)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 20,
                        marginHorizontal: 12,
                        marginVertical: 1,
                        borderRadius: 10,
                        backgroundColor: pressed
                          ? isActive 
                            ? 'rgba(179, 143, 91, 0.15)' 
                            : 'rgba(0, 0, 0, 0.03)'
                          : isActive 
                            ? 'rgba(179, 143, 91, 0.08)' 
                            : 'transparent',
                      })}
                    >
                      {/* Avatar */}
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          backgroundColor: isActive 
                            ? 'rgba(179, 143, 91, 0.12)' 
                            : 'rgba(0, 0, 0, 0.04)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                          overflow: 'hidden',
                        }}
                      >
                        <WorkspaceAvatar workspace={workspace} size={36} showName={false} />
                      </View>
                      
                      {/* Workspace Info */}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: isActive ? '600' : '500',
                            color: isActive ? '#111827' : '#374151',
                            letterSpacing: -0.2,
                          }}
                          numberOfLines={1}
                        >
                          {workspace.name}
                        </Text>
                        {isActive && (
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '400',
                              color: '#6b7280',
                              letterSpacing: -0.1,
                              marginTop: 1,
                            }}
                          >
                            Current workspace
                          </Text>
                        )}
                      </View>
                      
                      {/* Active Indicator */}
                      {isActive && (
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: '#b38f5b',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: 8,
                          }}
                        >
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color="#ffffff"
                          />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

            </BlurView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
