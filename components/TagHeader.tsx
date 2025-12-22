import { Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { WorkspaceAvatar } from './WorkspaceAvatar';

type TagHeaderProps = {
  onMenuPress?: () => void;
  onAddPress?: () => void;
  showAddButton?: boolean;
};

export function TagHeader({ onMenuPress, onAddPress, showAddButton = false }: TagHeaderProps) {
  const insets = useSafeAreaInsets();
  const { activeWorkspace } = useWorkspace();

  return (
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
          Tags
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {showAddButton && onAddPress && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onAddPress();
              }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#b38f5b',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 8,
              }}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: '#ffffff',
                  letterSpacing: -0.2,
                }}
              >
                Add Tag
              </Text>
            </TouchableOpacity>
          )}
          {/* Workspace + Menu Button - Shows context AND provides clear menu access */}
          {onMenuPress && activeWorkspace && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onMenuPress();
              }}
              activeOpacity={0.7}
              className="flex-row items-center"
              style={{
                paddingLeft: 8,
                paddingRight: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              }}
            >
              <WorkspaceAvatar workspace={activeWorkspace} size={24} showName={false} />
              <MaterialCommunityIcons
                name="menu"
                size={18}
                color="#6b7280"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}




