import { useState } from 'react';
import { Modal, TouchableOpacity, View, Text, ScrollView, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

  const handleWorkspacePress = async (workspace: Workspace) => {
    if (workspace.id === activeWorkspace?.id) {
      setIsModalOpen(false);
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await switchWorkspace(workspace.id);
      setIsModalOpen(false);
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
      Alert.alert('Error', 'Please enter a workspace name');
      return;
    }

    try {
      setIsCreatingWorkspace(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createNewWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setIsModalOpen(false);
    } catch (error) {
      console.error('[WorkspaceSwitcher] Error creating workspace:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create workspace'
      );
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  if (loading || !activeWorkspace) {
    return (
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: '#e5e7eb',
        }}
      />
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setIsModalOpen(true);
        }}
        activeOpacity={0.7}
        className="flex-row items-center gap-2"
      >
        <WorkspaceAvatar workspace={activeWorkspace} size={32} showName={true} />
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color="#6b7280"
        />
      </TouchableOpacity>

      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsModalOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-start',
            paddingTop: insets.top + 60,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              marginHorizontal: 20,
              maxHeight: '80%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            {/* Header */}
            <View
              className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200"
            >
              <Text
                className="text-[20px] font-bold text-gray-900"
                style={{ letterSpacing: -0.3 }}
              >
                Workspaces
              </Text>
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                activeOpacity={0.6}
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{
                  backgroundColor: '#f3f4f6',
                }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#374151"
                />
              </TouchableOpacity>
            </View>

            {/* Workspaces List */}
            <ScrollView
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
            >
              {workspaces.map((workspace) => (
                <TouchableOpacity
                  key={workspace.id}
                  onPress={() => handleWorkspacePress(workspace)}
                  activeOpacity={0.7}
                  className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100"
                  style={{
                    backgroundColor:
                      workspace.id === activeWorkspace?.id
                        ? '#f9fafb'
                        : 'transparent',
                  }}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <WorkspaceAvatar workspace={workspace} size={40} />
                    <View className="flex-1">
                      <Text
                        className="text-[16px] font-semibold text-gray-900"
                        style={{ letterSpacing: -0.2 }}
                        numberOfLines={1}
                      >
                        {workspace.name}
                      </Text>
                      {workspace.id === activeWorkspace?.id && (
                        <Text
                          className="text-[13px] text-gray-500 mt-0.5"
                          style={{ letterSpacing: -0.1 }}
                        >
                          Current workspace
                        </Text>
                      )}
                    </View>
                  </View>
                  {workspace.id === activeWorkspace?.id && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color="#b38f5b"
                    />
                  )}
                </TouchableOpacity>
              ))}

              {/* Create New Workspace Section */}
              <View className="px-5 py-4 border-t border-gray-200">
                <Text
                  className="text-[14px] font-semibold text-gray-700 mb-3"
                  style={{ letterSpacing: -0.1 }}
                >
                  Create New Workspace
                </Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={newWorkspaceName}
                    onChangeText={setNewWorkspaceName}
                    placeholder="Workspace name"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-[16px] text-gray-900"
                    style={{
                      backgroundColor: '#f9fafb',
                    }}
                    onSubmitEditing={handleCreateWorkspace}
                    editable={!isCreatingWorkspace}
                  />
                  <TouchableOpacity
                    onPress={handleCreateWorkspace}
                    disabled={isCreatingWorkspace || !newWorkspaceName.trim()}
                    activeOpacity={0.7}
                    className="px-5 py-3 rounded-xl"
                    style={{
                      backgroundColor:
                        isCreatingWorkspace || !newWorkspaceName.trim()
                          ? '#e5e7eb'
                          : '#b38f5b',
                    }}
                  >
                    {isCreatingWorkspace ? (
                      <MaterialCommunityIcons
                        name="loading"
                        size={20}
                        color="#9ca3af"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="plus"
                        size={20}
                        color="#ffffff"
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}



