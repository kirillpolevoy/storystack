import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  updateWorkspaceName,
  uploadWorkspaceLogo,
  removeWorkspaceLogo,
  getWorkspaceLogoUrl,
  getWorkspaceInitials,
} from '@/utils/workspaceHelpers';
import {
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '@/utils/workspaceHelpers';
import { WorkspaceRole } from '@/types';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';

export default function WorkspaceSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { activeWorkspace, userRole, hasPermission, refreshWorkspaces, refreshUserRole } = useWorkspace();
  const [workspaceName, setWorkspaceName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      setWorkspaceName(activeWorkspace.name);
    }
  }, [activeWorkspace]);

  // Load workspace members
  const loadMembers = useCallback(async () => {
    if (!activeWorkspace?.id || !hasPermission('admin')) {
      return;
    }

    setIsLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          role,
          created_at,
          created_by,
          profiles:user_id (
            id,
            email
          )
        `)
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[WorkspaceSettings] Error loading members:', error);
      } else {
        setMembers(data || []);
      }
    } catch (error) {
      console.error('[WorkspaceSettings] Error loading members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [activeWorkspace?.id, hasPermission]);

  useEffect(() => {
    if (hasPermission('admin')) {
      loadMembers();
    }
  }, [loadMembers, hasPermission]);

  const handleSaveName = async () => {
    if (!activeWorkspace || !hasPermission('owner')) {
      return;
    }

    if (!workspaceName.trim()) {
      Alert.alert('Error', 'Workspace name cannot be empty');
      return;
    }

    if (workspaceName.trim() === activeWorkspace.name) {
      return; // No change
    }

    setIsSavingName(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await updateWorkspaceName(activeWorkspace.id, workspaceName.trim());
      await refreshWorkspaces();
      Alert.alert('Success', 'Workspace name updated');
    } catch (error) {
      console.error('[WorkspaceSettings] Error updating name:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update workspace name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleUploadLogo = async () => {
    if (!activeWorkspace || !hasPermission('owner') || !session?.user?.id) {
      return;
    }

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant access to your photo library');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setIsUploadingLogo(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Convert to File object for upload
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' });

      await uploadWorkspaceLogo(activeWorkspace.id, file, session.user.id);
      await refreshWorkspaces();
      Alert.alert('Success', 'Workspace logo updated');
    } catch (error) {
      console.error('[WorkspaceSettings] Error uploading logo:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!activeWorkspace || !hasPermission('owner')) {
      return;
    }

    Alert.alert(
      'Remove Logo',
      'Are you sure you want to remove the workspace logo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsRemovingLogo(true);
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await removeWorkspaceLogo(activeWorkspace.id);
              await refreshWorkspaces();
              Alert.alert('Success', 'Logo removed');
            } catch (error) {
              console.error('[WorkspaceSettings] Error removing logo:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to remove logo');
            } finally {
              setIsRemovingLogo(false);
            }
          },
        },
      ]
    );
  };

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');

  const handleAddMember = () => {
    if (!hasPermission('admin')) {
      return;
    }
    setShowAddMemberModal(true);
  };

  const confirmAddMember = async () => {
    if (!newMemberEmail || !newMemberEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      // For now, we'll need to use an invite system
      // This is a placeholder - in production, use proper invite flow
      Alert.alert('Info', 'Member invitation feature coming soon. For now, users can be added via the database.');
      setShowAddMemberModal(false);
      setNewMemberEmail('');
    } catch (error) {
      console.error('[WorkspaceSettings] Error adding member:', error);
      Alert.alert('Error', 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string, userEmail: string) => {
    if (!hasPermission('admin') || !activeWorkspace) {
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${userEmail} from this workspace?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeWorkspaceMember(activeWorkspace.id, userId);
              await loadMembers();
              Alert.alert('Success', 'Member removed');
            } catch (error) {
              console.error('[WorkspaceSettings] Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = async (userId: string, currentRole: WorkspaceRole, newRole: WorkspaceRole) => {
    if (!hasPermission('admin') || !activeWorkspace) {
      return;
    }

    try {
      await updateWorkspaceMemberRole(activeWorkspace.id, userId, newRole);
      await loadMembers();
      Alert.alert('Success', 'Member role updated');
    } catch (error) {
      console.error('[WorkspaceSettings] Error updating role:', error);
      Alert.alert('Error', 'Failed to update member role');
    }
  };

  if (!activeWorkspace) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#b38f5b" />
        <Text className="mt-4 text-gray-500">Loading workspace...</Text>
      </View>
    );
  }

  const logoUrl = activeWorkspace.logo_path ? getWorkspaceLogoUrl(activeWorkspace.logo_path) : null;
  const initials = getWorkspaceInitials(activeWorkspace.name);
  const isOwner = userRole === 'owner';
  const isAdmin = hasPermission('admin');

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Header */}
        <View
          className="px-5 pt-4 pb-6 border-b border-gray-200"
          style={{ paddingTop: insets.top + 16 }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.6}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: '#f3f4f6' }}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
            </TouchableOpacity>
            <Text className="text-[20px] font-bold text-gray-900">Workspace Settings</Text>
            <View className="w-10" />
          </View>
        </View>

        {/* Workspace Branding (Owner only) */}
        {isOwner && (
          <View className="px-5 py-6 border-b border-gray-200">
            <Text className="text-[18px] font-semibold text-gray-900 mb-4">Branding</Text>

            {/* Logo Section */}
            <View className="items-center mb-6">
              <View
                className="h-24 w-24 rounded-full items-center justify-center mb-4"
                style={{
                  backgroundColor: logoUrl ? 'transparent' : '#b38f5b',
                  overflow: 'hidden',
                }}
              >
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} className="h-24 w-24 rounded-full" />
                ) : (
                  <Text className="text-3xl font-bold text-white">{initials}</Text>
                )}
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleUploadLogo}
                  disabled={isUploadingLogo}
                  activeOpacity={0.7}
                  className="px-5 py-3 rounded-xl"
                  style={{
                    backgroundColor: isUploadingLogo ? '#e5e7eb' : '#b38f5b',
                  }}
                >
                  {isUploadingLogo ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-[16px] font-semibold text-white">Upload Logo</Text>
                  )}
                </TouchableOpacity>

                {logoUrl && (
                  <TouchableOpacity
                    onPress={handleRemoveLogo}
                    disabled={isRemovingLogo}
                    activeOpacity={0.7}
                    className="px-5 py-3 rounded-xl border border-gray-300"
                  >
                    {isRemovingLogo ? (
                      <ActivityIndicator size="small" color="#6b7280" />
                    ) : (
                      <Text className="text-[16px] font-semibold text-gray-700">Remove</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Name Section */}
            <View>
              <Text className="text-[14px] font-medium text-gray-700 mb-2">Workspace Name</Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={workspaceName}
                  onChangeText={setWorkspaceName}
                  placeholder="Workspace name"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-[16px] text-gray-900"
                  style={{ backgroundColor: '#f9fafb' }}
                  editable={!isSavingName}
                />
                <TouchableOpacity
                  onPress={handleSaveName}
                  disabled={isSavingName || workspaceName.trim() === activeWorkspace.name}
                  activeOpacity={0.7}
                  className="px-5 py-3 rounded-xl"
                  style={{
                    backgroundColor:
                      isSavingName || workspaceName.trim() === activeWorkspace.name
                        ? '#e5e7eb'
                        : '#b38f5b',
                  }}
                >
                  {isSavingName ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-[16px] font-semibold text-white">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Members Section (Admin+) */}
        {isAdmin && (
          <View className="px-5 py-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[18px] font-semibold text-gray-900">Members</Text>
              {isAdmin && (
                <TouchableOpacity
                  onPress={handleAddMember}
                  activeOpacity={0.7}
                  className="px-4 py-2 rounded-xl"
                  style={{ backgroundColor: '#b38f5b' }}
                >
                  <Text className="text-[14px] font-semibold text-white">Add Member</Text>
                </TouchableOpacity>
              )}
            </View>

            {isLoadingMembers ? (
              <ActivityIndicator size="small" color="#b38f5b" />
            ) : (
              <View>
                {members.map((member) => {
                  const userEmail = member.profiles?.email || 'Unknown';
                  const memberRole = member.role as WorkspaceRole;
                  const isCurrentUser = member.user_id === session?.user?.id;
                  const canChangeRole = isAdmin && (!isCurrentUser || isOwner);

                  return (
                    <View
                      key={member.user_id}
                      className="flex-row items-center justify-between py-4 border-b border-gray-100"
                    >
                      <View className="flex-1">
                        <Text className="text-[16px] font-semibold text-gray-900">
                          {userEmail}
                          {isCurrentUser && ' (You)'}
                        </Text>
                        <Text className="text-[14px] text-gray-500 capitalize">{memberRole}</Text>
                      </View>

                      {canChangeRole && (
                        <View className="flex-row gap-2">
                          {memberRole !== 'owner' && (
                            <TouchableOpacity
                              onPress={() => {
                                const roleOptions: WorkspaceRole[] = ['viewer', 'editor', 'admin'];
                                const currentIndex = roleOptions.indexOf(memberRole);
                                const nextRole = roleOptions[currentIndex + 1] || roleOptions[0];
                                handleChangeRole(member.user_id, memberRole, nextRole);
                              }}
                              activeOpacity={0.7}
                              className="px-3 py-2 rounded-lg border border-gray-300"
                            >
                              <Text className="text-[12px] font-medium text-gray-700">Change Role</Text>
                            </TouchableOpacity>
                          )}
                          {!isCurrentUser && memberRole !== 'owner' && (
                            <TouchableOpacity
                              onPress={() => handleRemoveMember(member.user_id, userEmail)}
                              activeOpacity={0.7}
                              className="px-3 py-2 rounded-lg"
                              style={{ backgroundColor: '#fee2e2' }}
                            >
                              <Text className="text-[12px] font-medium text-red-600">Remove</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Info Section */}
        <View className="px-5 py-6 border-t border-gray-200">
          <Text className="text-[14px] text-gray-500">
            Your role: <Text className="font-semibold capitalize">{userRole}</Text>
          </Text>
          {!isOwner && (
            <Text className="text-[12px] text-gray-400 mt-2">
              Only workspace owners can manage branding and settings.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 mx-5 w-full max-w-sm">
            <Text className="text-[20px] font-bold text-gray-900 mb-2">Add Member</Text>
            <Text className="text-[14px] text-gray-600 mb-4">
              Enter the email address of the user to add:
            </Text>
            <TextInput
              value={newMemberEmail}
              onChangeText={setNewMemberEmail}
              placeholder="user@example.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="px-4 py-3 rounded-xl border border-gray-300 text-[16px] text-gray-900 mb-4"
              style={{ backgroundColor: '#f9fafb' }}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowAddMemberModal(false);
                  setNewMemberEmail('');
                }}
                activeOpacity={0.7}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300"
              >
                <Text className="text-center text-[16px] font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmAddMember}
                activeOpacity={0.7}
                className="flex-1 px-4 py-3 rounded-xl"
                style={{ backgroundColor: '#b38f5b' }}
              >
                <Text className="text-center text-[16px] font-semibold text-white">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

