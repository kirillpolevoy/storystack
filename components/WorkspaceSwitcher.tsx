import { useState, useRef, useEffect } from 'react';
import { 
  Modal, 
  TouchableOpacity, 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
};

export function WorkspaceSwitcher({ position = 'left' }: WorkspaceSwitcherProps) {
  const {
    activeWorkspace,
    workspaces,
    switchWorkspace,
    createNewWorkspace,
    loading,
  } = useWorkspace();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const insets = useSafeAreaInsets();

  // Consumer-grade animations - smooth and delightful
  const modalTranslateY = useRef(new Animated.Value(1000)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isModalOpen) {
      Animated.parallel([
        Animated.spring(modalTranslateY, {
          toValue: 0,
          tension: 68,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      modalTranslateY.setValue(1000);
      backdropOpacity.setValue(0);
    }
  }, [isModalOpen]);

  const handleWorkspacePress = async (workspace: Workspace) => {
    if (workspace.id === activeWorkspace?.id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      handleClose();
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await switchWorkspace(workspace.id);
      handleClose();
    } catch (error) {
      console.error('[WorkspaceSwitcher] Error switching workspace:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to switch workspace'
      );
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setIsCreatingWorkspace(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createNewWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setIsInputFocused(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
    } catch (error) {
      console.error('[WorkspaceSwitcher] Error creating workspace:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create workspace'
      );
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(modalTranslateY, {
        toValue: 1000,
        tension: 68,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsModalOpen(false);
      setIsInputFocused(false);
      setNewWorkspaceName('');
    });
  };

  const handleButtonPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Subtle press feedback
    Animated.sequence([
      Animated.spring(buttonScale, {
        toValue: 0.97,
        tension: 400,
        friction: 25,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 400,
        friction: 25,
        useNativeDriver: true,
      }),
    ]).start();
    
    setIsModalOpen(true);
  };

  if (loading || !activeWorkspace) {
    return (
      <View
        style={{
          height: 50,
          borderRadius: 12,
          backgroundColor: 'rgba(0, 0, 0, 0.03)',
        }}
      />
    );
  }

  return (
    <>
      {/* Consumer-Grade Button - Clean & Simple */}
      <Animated.View
        style={{
          transform: [{ scale: buttonScale }],
        }}
      >
        <TouchableOpacity
          onPress={handleButtonPress}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.06)',
          }}
        >
          <WorkspaceAvatar workspace={activeWorkspace} size={36} showName={false} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#000000',
                letterSpacing: -0.3,
              }}
              numberOfLines={1}
            >
              {activeWorkspace.name}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '400',
                color: '#8e8e93',
                letterSpacing: -0.1,
                marginTop: 2,
              }}
            >
              {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#8e8e93"
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Consumer-Grade Modal Sheet */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Backdrop */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleClose}
            style={{ flex: 1 }}
          >
            <Animated.View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                opacity: backdropOpacity,
              }}
            />
          </TouchableOpacity>

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
              intensity={90}
              tint="light"
              style={{
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                paddingBottom: Math.max(insets.bottom, 20),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 16,
                elevation: 16,
              }}
            >
              {/* Handle Indicator */}
              <View
                style={{
                  alignItems: 'center',
                  paddingTop: 10,
                  paddingBottom: 6,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.15)',
                  }}
                />
              </View>

              {/* Header */}
              <View
                style={{
                  paddingHorizontal: 24,
                  paddingTop: 4,
                  paddingBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: '700',
                    color: '#000000',
                    letterSpacing: -0.6,
                  }}
                >
                  Workspaces
                </Text>
              </View>

              {/* Workspaces List */}
              <ScrollView
                style={{ maxHeight: 400 }}
                showsVerticalScrollIndicator={false}
                bounces={true}
                contentContainerStyle={{
                  paddingBottom: 12,
                }}
              >
                {workspaces.map((workspace) => {
                  const isActive = workspace.id === activeWorkspace?.id;
                  return (
                    <TouchableOpacity
                      key={workspace.id}
                      onPress={() => handleWorkspacePress(workspace)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 24,
                        paddingVertical: 14,
                        marginHorizontal: 12,
                        marginVertical: 2,
                        borderRadius: 12,
                        backgroundColor: isActive 
                          ? 'rgba(179, 143, 91, 0.1)' 
                          : 'transparent',
                      }}
                    >
                      <WorkspaceAvatar workspace={workspace} size={40} showName={false} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: isActive ? '600' : '500',
                            color: '#000000',
                            letterSpacing: -0.3,
                          }}
                          numberOfLines={1}
                        >
                          {workspace.name}
                        </Text>
                        {isActive && (
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: '400',
                              color: '#8e8e93',
                              letterSpacing: -0.2,
                              marginTop: 2,
                            }}
                          >
                            Current
                          </Text>
                        )}
                      </View>
                      {isActive && (
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: '#b38f5b',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name="check"
                            size={14}
                            color="#ffffff"
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Divider */}
              <View
                style={{
                  height: 0.5,
                  backgroundColor: 'rgba(0, 0, 0, 0.12)',
                  marginHorizontal: 24,
                  marginVertical: 12,
                }}
              />

              {/* Create New Workspace Section */}
              <View
                style={{
                  paddingHorizontal: 24,
                  paddingBottom: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <TextInput
                    value={newWorkspaceName}
                    onChangeText={setNewWorkspaceName}
                    placeholder="New workspace name"
                    placeholderTextColor="#8e8e93"
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onSubmitEditing={handleCreateWorkspace}
                    editable={!isCreatingWorkspace}
                    returnKeyType="done"
                    style={{
                      flex: 1,
                      height: 48,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      backgroundColor: isInputFocused 
                        ? '#ffffff' 
                        : 'rgba(0, 0, 0, 0.04)',
                      borderWidth: isInputFocused ? 1.5 : 0,
                      borderColor: '#b38f5b',
                      fontSize: 16,
                      fontWeight: '400',
                      color: '#000000',
                      letterSpacing: -0.2,
                    }}
                  />
                  <TouchableOpacity
                    onPress={handleCreateWorkspace}
                    disabled={isCreatingWorkspace || !newWorkspaceName.trim()}
                    activeOpacity={0.7}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor:
                        isCreatingWorkspace || !newWorkspaceName.trim()
                          ? 'rgba(0, 0, 0, 0.05)'
                          : '#b38f5b',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#b38f5b',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: !newWorkspaceName.trim() ? 0 : 0.25,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    {isCreatingWorkspace ? (
                      <ActivityIndicator size="small" color="#8e8e93" />
                    ) : (
                      <MaterialCommunityIcons
                        name="plus"
                        size={20}
                        color={
                          isCreatingWorkspace || !newWorkspaceName.trim()
                            ? '#8e8e93'
                            : '#ffffff'
                        }
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </BlurView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
