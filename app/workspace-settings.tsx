import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  updateWorkspaceName,
  createWorkspace,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  deleteWorkspace,
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
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [showDeleteWorkspaceModal, setShowDeleteWorkspaceModal] = useState(false);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);

  useEffect(() => {
    if (activeWorkspace?.name) {
      setWorkspaceName(activeWorkspace.name);
    }
  }, [activeWorkspace?.id, activeWorkspace?.name]);

  // Load workspace members
  const loadMembers = useCallback(async () => {
    if (!activeWorkspace?.id || !hasPermission('admin')) {
      return;
    }

    setIsLoadingMembers(true);
    try {
      // Use the RPC function to get members with emails
      const { data, error } = await supabase.rpc('get_workspace_members_with_emails', {
        workspace_id_param: activeWorkspace.id,
      });

      if (error) {
        console.error('[WorkspaceSettings] Error loading members:', error);
        // Fallback: try direct query without emails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('workspace_members')
          .select('user_id, role, created_at, created_by')
          .eq('workspace_id', activeWorkspace.id)
          .order('created_at', { ascending: true });
        
        if (fallbackError) {
          console.error('[WorkspaceSettings] Fallback query also failed:', fallbackError);
          setMembers([]);
        } else {
          // Map fallback data to include email placeholder
          setMembers((fallbackData || []).map((m: any) => ({
            ...m,
            email: `User ${m.user_id.substring(0, 8)}...`,
          })));
        }
      } else {
        setMembers(data || []);
      }
    } catch (error) {
      console.error('[WorkspaceSettings] Error loading members:', error);
      setMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [activeWorkspace?.id, hasPermission]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleCreateWorkspace = async () => {
    if (!session?.user?.id || !newWorkspaceName.trim()) {
      Alert.alert('Error', 'Please enter a workspace name');
      return;
    }

    setIsCreatingWorkspace(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const workspace = await createWorkspace(newWorkspaceName.trim(), session.user.id);
      
      // Refresh workspaces and switch to the new one
      await refreshWorkspaces();
      
      // Set the new workspace as active
      const { error: prefError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: session.user.id,
          active_workspace_id: workspace.id,
          updated_at: new Date().toISOString(),
        });

      if (prefError) {
        console.warn('[WorkspaceSettings] Error updating user preferences:', prefError);
      }

      setShowCreateWorkspaceModal(false);
      setNewWorkspaceName('');
      Alert.alert('Success', 'Workspace created! Switching to new workspace...', [
        {
          text: 'OK',
          onPress: () => {
            // Reload to switch workspace
            router.replace('/');
          },
        },
      ]);
    } catch (error) {
      console.error('[WorkspaceSettings] Error creating workspace:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create workspace');
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

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

        {/* Create New Workspace */}
        <View className="px-5 py-6 border-b border-gray-200">
          <Text className="text-[18px] font-semibold text-gray-900 mb-4">Create New Workspace</Text>
          <Text className="text-[14px] text-gray-500 mb-4">
            Create a new workspace to organize your content separately
          </Text>
          <TouchableOpacity
            onPress={() => setShowCreateWorkspaceModal(true)}
            activeOpacity={0.7}
            className="px-4 py-3 rounded-xl"
            style={{ backgroundColor: '#b38f5b' }}
          >
            <View className="flex-row items-center justify-center gap-2">
              <MaterialCommunityIcons name="plus" size={20} color="#ffffff" />
              <Text className="text-[16px] font-semibold text-white">Create New Workspace</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Workspace Name (Owner only) */}
        {isOwner && (
          <View className="px-5 py-6 border-b border-gray-200">
            <Text className="text-[18px] font-semibold text-gray-900 mb-4">Workspace Name</Text>
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
                  // The RPC function returns email directly, or fallback to user ID
                  const userEmail = member.email || `User ${member.user_id.substring(0, 8)}...`;
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

        {/* Delete Workspace Section */}
        {isOwner && (
          <View className="px-5 py-6 border-t border-red-200">
            <Text className="text-[18px] font-semibold text-red-600 mb-2">Danger Zone</Text>
            <Text className="text-[14px] text-gray-600 mb-4">
              Permanently delete this workspace and all its data. This action cannot be undone.
            </Text>
            <TouchableOpacity
              onPress={() => setShowDeleteWorkspaceModal(true)}
              activeOpacity={0.7}
              className="px-5 py-3 rounded-xl border border-red-300"
            >
              <Text className="text-[16px] font-semibold text-red-600 text-center">Delete Workspace</Text>
            </TouchableOpacity>
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

      {/* Delete Workspace Modal */}
      <Modal
        visible={showDeleteWorkspaceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteWorkspaceModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 mx-5 w-full max-w-sm">
            <Text className="text-[20px] font-bold text-red-600 mb-2">Delete Workspace</Text>
            <Text className="text-[14px] text-gray-600 mb-4">
              Are you sure you want to delete &quot;{activeWorkspace?.name}&quot;? This action cannot be undone.
              All workspace data will be permanently deleted.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowDeleteWorkspaceModal(false)}
                activeOpacity={0.7}
                disabled={isDeletingWorkspace}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300"
              >
                <Text className="text-center text-[16px] font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!activeWorkspace?.id || !session?.user?.id) return
                  setIsDeletingWorkspace(true)
                  try {
                    await deleteWorkspace(activeWorkspace.id, session.user.id)
                    await refreshWorkspaces()
                    router.back()
                  } catch (error: any) {
                    console.error('[WorkspaceSettings] Error deleting workspace:', error)
                    Alert.alert('Error', error.message || 'Failed to delete workspace')
                  } finally {
                    setIsDeletingWorkspace(false)
                    setShowDeleteWorkspaceModal(false)
                  }
                }}
                activeOpacity={0.7}
                disabled={isDeletingWorkspace}
                className="flex-1 px-4 py-3 rounded-xl"
                style={{ backgroundColor: isDeletingWorkspace ? '#e5e7eb' : '#dc2626' }}
              >
                {isDeletingWorkspace ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-center text-[16px] font-semibold text-white">Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Workspace Modal */}
      <Modal
        visible={showCreateWorkspaceModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCreateWorkspaceModal(false);
          setNewWorkspaceName('');
        }}
      >
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 mx-5 w-full max-w-sm">
            <Text className="text-[20px] font-bold text-gray-900 mb-2">Create New Workspace</Text>
            <Text className="text-[14px] text-gray-600 mb-4">
              Enter a name for your new workspace:
            </Text>
            <TextInput
              value={newWorkspaceName}
              onChangeText={setNewWorkspaceName}
              placeholder="My Workspace"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              autoCorrect={false}
              className="px-4 py-3 rounded-xl border border-gray-300 text-[16px] text-gray-900 mb-4"
              style={{ backgroundColor: '#f9fafb' }}
              maxLength={100}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowCreateWorkspaceModal(false);
                  setNewWorkspaceName('');
                }}
                activeOpacity={0.7}
                disabled={isCreatingWorkspace}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300"
              >
                <Text className="text-center text-[16px] font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateWorkspace}
                activeOpacity={0.7}
                disabled={isCreatingWorkspace || !newWorkspaceName.trim()}
                className="flex-1 px-4 py-3 rounded-xl"
                style={{
                  backgroundColor: isCreatingWorkspace || !newWorkspaceName.trim() ? '#e5e7eb' : '#b38f5b',
                }}
              >
                {isCreatingWorkspace ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-center text-[16px] font-semibold text-white">Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

