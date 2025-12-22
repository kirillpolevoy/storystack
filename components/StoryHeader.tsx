import { Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { WorkspaceAvatar } from './WorkspaceAvatar';

type StoryHeaderProps = {
  onMenuPress?: () => void;
  onAddMorePress?: () => void;
  onBackPress?: () => void;
  showAddMore?: boolean;
  showBack?: boolean;
};

export function StoryHeader({ onMenuPress, onAddMorePress, onBackPress, showAddMore = false, showBack = false }: StoryHeaderProps) {
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
        <View className="flex-row items-center gap-3">
          {showBack && onBackPress && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onBackPress();
              }}
              activeOpacity={0.6}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(179, 143, 91, 0.1)',
              }}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={20}
                color="#b38f5b"
              />
            </TouchableOpacity>
          )}
          <Text className="text-[20px] font-bold text-gray-900" style={{ letterSpacing: -0.5 }}>
            New Story
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {showAddMore && onAddMorePress && (
            <TouchableOpacity
              onPress={onAddMorePress}
              activeOpacity={0.6}
            >
              <Text className="text-[15px] font-semibold text-gray-600" style={{ letterSpacing: -0.2 }}>
                Add More
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


