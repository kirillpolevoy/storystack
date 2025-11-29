import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { MenuDrawer } from '@/components/MenuDrawer';
import { BottomTabBar } from '@/components/BottomTabBar';
import * as Haptics from 'expo-haptics';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, session, deleteAccount } = useAuth();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const passwordModalScale = useRef(new Animated.Value(0.9)).current;
  const passwordModalOpacity = useRef(new Animated.Value(0)).current;
  const passwordBackdropOpacity = useRef(new Animated.Value(0)).current;

  // Animate password modal
  useEffect(() => {
    if (showPasswordModal) {
      Animated.parallel([
        Animated.timing(passwordBackdropOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(passwordModalScale, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(passwordModalOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(passwordBackdropOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(passwordModalScale, {
          toValue: 0.9,
          duration: 200,
          easing: Easing.in(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(passwordModalOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showPasswordModal]);

  // Load profile photo on mount
  useEffect(() => {
    loadProfilePhoto();
  }, [user?.id]);

  const loadProfilePhoto = async () => {
    if (!user?.id || !supabase) return;
    
    try {
      const { data } = await supabase
        .storage
        .from('avatars')
        .getPublicUrl(`${user.id}/profile.jpg`);
      
      // Check if image exists by trying to fetch it
      const response = await fetch(data.publicUrl, { method: 'HEAD' });
      if (response.ok) {
        // Add cache busting to ensure fresh image
        setProfilePhoto(`${data.publicUrl}?t=${Date.now()}`);
      }
    } catch (error) {
      // Photo doesn't exist yet, that's fine
      console.log('[Profile] No profile photo found');
    }
  };

  const handlePickPhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to set a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      await uploadProfilePhoto(result.assets[0].uri);
    } catch (error) {
      console.error('[Profile] Error picking photo:', error);
      Alert.alert('Error', 'Failed to pick photo. Please try again.');
    }
  };

  const uploadProfilePhoto = async (uri: string) => {
    if (!user?.id || !supabase) {
      Alert.alert('Error', 'Unable to upload photo. Please try again.');
      return;
    }

    try {
      setIsUploadingPhoto(true);

      // Convert image to arrayBuffer (React Native compatible)
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error('Failed to read image file');
      }
      
      const arrayBuffer = await response.arrayBuffer();

      // Upload to Supabase storage
      const filePath = `${user.id}/profile.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('[Profile] Upload error details:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError.error,
        });
        
        // Provide specific error messages
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          Alert.alert(
            'Storage Bucket Missing',
            'The avatars storage bucket does not exist. Please create it in Supabase Dashboard → Storage.',
            [{ text: 'OK' }]
          );
        } else if (uploadError.message?.includes('new row violates row-level security')) {
          Alert.alert(
            'Permission Denied',
            'You don\'t have permission to upload to this bucket. Please check your storage policies.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Upload Failed',
            uploadError.message || 'Failed to upload photo. Please try again.',
            [{ text: 'OK' }]
          );
        }
        return;
      }

      // Get public URL and update state
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      // Add cache busting to ensure fresh image
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setProfilePhoto(publicUrl);
      
      Alert.alert('Success', 'Profile photo updated successfully.');
    } catch (error: any) {
      console.error('[Profile] Error uploading photo:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to upload photo. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      // Update password using Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      Alert.alert('Success', 'Password updated successfully.', [
        { text: 'OK', onPress: () => setShowPasswordModal(false) },
      ]);

      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };


  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. All your photos, stories, and data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'This will permanently delete your account and all data. This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeletingAccount(true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    try {
                      const { error } = await deleteAccount();
                      if (error) {
                        throw error;
                      }
                      // Navigate to login after successful deletion
                      router.replace('/login');
                    } catch (error: any) {
                      Alert.alert(
                        'Error',
                        error.message || 'Failed to delete account. Please try again or contact support.'
                      );
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const accountCreatedDate = user?.created_at 
    ? dayjs(user.created_at).format('MMMM D, YYYY')
    : 'Unknown';

  const SettingsRow = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    showChevron = true,
    destructive = false 
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    showChevron?: boolean;
    destructive?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      className="flex-row items-center py-4 px-5 bg-white"
      style={{
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
      }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-3"
        style={{
          backgroundColor: destructive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(179, 143, 91, 0.1)',
        }}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={destructive ? '#ef4444' : '#b38f5b'}
        />
      </View>
      <View className="flex-1">
        <Text
          className="text-[17px] font-medium"
          style={{
            color: destructive ? '#ef4444' : '#111827',
            letterSpacing: -0.2,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            className="text-[13px] mt-0.5"
            style={{
              color: '#6b7280',
              letterSpacing: -0.1,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {showChevron && (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color="#c4c4c4"
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="bg-white px-5"
        style={{
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-[20px] font-bold text-gray-900" style={{ letterSpacing: -0.5 }}>
            Profile
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsMenuOpen(true);
            }}
            activeOpacity={0.6}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{
              backgroundColor: 'rgba(179, 143, 91, 0.1)',
            }}
          >
            <MaterialCommunityIcons
              name="menu"
              size={20}
              color="#b38f5b"
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Menu Drawer */}
      <MenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 40) + 80, // Extra padding for tab bar
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Photo Section */}
        <View className="bg-white mb-6 pt-8 pb-6 items-center">
          <TouchableOpacity
            onPress={handlePickPhoto}
            disabled={isUploadingPhoto}
            activeOpacity={0.8}
            style={{ position: 'relative' }}
          >
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                className="w-24 h-24 rounded-full"
                style={{
                  borderWidth: 3,
                  borderColor: '#b38f5b',
                }}
              />
            ) : (
              <View
                className="w-24 h-24 rounded-full items-center justify-center"
                style={{
                  backgroundColor: 'rgba(179, 143, 91, 0.1)',
                  borderWidth: 3,
                  borderColor: '#b38f5b',
                }}
              >
                {isUploadingPhoto ? (
                  <ActivityIndicator size="small" color="#b38f5b" />
                ) : (
                  <Text
                    className="text-[40px] font-bold"
                    style={{
                      color: '#b38f5b',
                    }}
                  >
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                )}
              </View>
            )}
            
            {/* Edit Badge */}
            {!isUploadingPhoto && (
              <View
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full items-center justify-center"
                style={{
                  backgroundColor: '#b38f5b',
                  borderWidth: 3,
                  borderColor: '#ffffff',
                }}
              >
                <MaterialCommunityIcons
                  name="camera"
                  size={14}
                  color="#ffffff"
                />
              </View>
            )}
          </TouchableOpacity>
          
          <Text
            className="mt-4 text-[17px] font-semibold text-gray-900"
            style={{ letterSpacing: -0.2 }}
          >
            {user?.email || 'Not available'}
          </Text>
          <Text
            className="mt-1 text-[13px] text-gray-500"
            style={{ letterSpacing: -0.1 }}
          >
            Member since {accountCreatedDate}
          </Text>
        </View>

        {/* Settings Section */}
        <View className="bg-white rounded-2xl overflow-hidden mb-6 mx-5" style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}>
          <SettingsRow
            icon="lock-reset"
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPasswordModal(true);
            }}
          />
          <SettingsRow
            icon="delete-forever"
            title="Delete Account"
            subtitle="Permanently delete your account and all data"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleDeleteAccount();
            }}
            destructive={true}
          />
        </View>

        {/* Account Info Section */}
        <View className="bg-white rounded-2xl overflow-hidden mb-6 mx-5" style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}>
          <View className="px-5 py-3 border-b border-gray-100">
            <Text className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">
              Account
            </Text>
          </View>
          <View className="px-5 py-4">
            <View className="mb-3">
              <Text className="mb-1 text-[13px] font-semibold text-gray-500" style={{ letterSpacing: -0.1 }}>
                Email Address
              </Text>
              <Text className="text-[17px] font-medium text-gray-900" style={{ letterSpacing: -0.2 }}>
                {user?.email || 'Not available'}
              </Text>
            </View>
            <View>
              <Text className="mb-1 text-[13px] font-semibold text-gray-500" style={{ letterSpacing: -0.1 }}>
                Member Since
              </Text>
              <Text className="text-[17px] font-medium text-gray-900" style={{ letterSpacing: -0.2 }}>
                {accountCreatedDate}
              </Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View className="items-center mb-8">
          <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            StoryStack
          </Text>
          <Text className="text-[12px] text-gray-400">
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <Animated.View
          style={{
            flex: 1,
            opacity: passwordBackdropOpacity,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: 20 }}
          >
            <Animated.View
              style={{
                opacity: passwordModalOpacity,
                transform: [{ scale: passwordModalScale }],
              }}
            >
              <View
                className="bg-white rounded-3xl p-6"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.25,
                  shadowRadius: 20,
                  elevation: 10,
                }}
              >
            <Text className="text-[22px] font-bold text-gray-900 mb-2" style={{ letterSpacing: -0.5 }}>
              Change Password
            </Text>
            <Text className="text-[15px] text-gray-500 mb-6" style={{ letterSpacing: -0.1 }}>
              Enter your current password and choose a new one.
            </Text>

            {/* Current Password */}
            <View className="mb-4">
              <Text className="mb-2 text-[13px] font-semibold text-gray-700" style={{ letterSpacing: -0.1 }}>
                Current Password
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  placeholder="Enter current password"
                  placeholderTextColor="#9ca3af"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showPasswordFields.current}
                  className="rounded-2xl border bg-gray-50 px-4 py-3.5 text-[16px] text-gray-900"
                  style={{
                    borderColor: '#e5e7eb',
                    letterSpacing: -0.2,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPasswordFields({ ...showPasswordFields, current: !showPasswordFields.current })}
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: 0,
                    bottom: 0,
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.6}
                >
                  <Text className="text-[13px] font-medium text-gray-500">
                    {showPasswordFields.current ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View className="mb-4">
              <Text className="mb-2 text-[13px] font-semibold text-gray-700" style={{ letterSpacing: -0.1 }}>
                New Password
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  placeholder="At least 6 characters"
                  placeholderTextColor="#9ca3af"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPasswordFields.new}
                  className="rounded-2xl border bg-gray-50 px-4 py-3.5 text-[16px] text-gray-900"
                  style={{
                    borderColor: '#e5e7eb',
                    letterSpacing: -0.2,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPasswordFields({ ...showPasswordFields, new: !showPasswordFields.new })}
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: 0,
                    bottom: 0,
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.6}
                >
                  <Text className="text-[13px] font-medium text-gray-500">
                    {showPasswordFields.new ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View className="mb-6">
              <Text className="mb-2 text-[13px] font-semibold text-gray-700" style={{ letterSpacing: -0.1 }}>
                Confirm New Password
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  placeholder="Re-enter new password"
                  placeholderTextColor="#9ca3af"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPasswordFields.confirm}
                  className="rounded-2xl border bg-gray-50 px-4 py-3.5 text-[16px] text-gray-900"
                  style={{
                    borderColor: newPassword && confirmPassword && newPassword !== confirmPassword ? '#ef4444' : '#e5e7eb',
                    letterSpacing: -0.2,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPasswordFields({ ...showPasswordFields, confirm: !showPasswordFields.confirm })}
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: 0,
                    bottom: 0,
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.6}
                >
                  <Text className="text-[13px] font-medium text-gray-500">
                    {showPasswordFields.confirm ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              {confirmPassword && newPassword !== confirmPassword && (
                <Text className="mt-1.5 text-[12px] text-red-600">
                  Passwords do not match
                </Text>
              )}
            </View>

            {/* Actions */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="flex-1 rounded-2xl border border-gray-200 py-3.5"
                activeOpacity={0.7}
              >
                <Text className="text-center text-[17px] font-semibold text-gray-700" style={{ letterSpacing: -0.2 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
                className="flex-1 rounded-2xl py-3.5"
                style={{
                  backgroundColor: (isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6) ? '#e5e7eb' : '#b38f5b',
                  shadowColor: (isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6) ? 'transparent' : '#b38f5b',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: (isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6) ? 0 : 0.2,
                  shadowRadius: 8,
                  elevation: (isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6) ? 0 : 3,
                }}
                activeOpacity={0.85}
              >
                {isChangingPassword ? (
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                    <Text className="text-[17px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
                      Updating...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-center text-[17px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
                    Update
                  </Text>
                )}
              </TouchableOpacity>
            </View>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>

      {/* Bottom Tab Bar - Outside ScrollView to prevent glitching */}
      <BottomTabBar onAddPress={() => router.push('/')} />
    </View>
  );
}
