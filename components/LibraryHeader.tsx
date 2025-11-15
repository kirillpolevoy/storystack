import { Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type LibraryHeaderProps = {
  onTagManagementPress?: () => void;
};

export function LibraryHeader({ onTagManagementPress }: LibraryHeaderProps) {
  return (
    <View className="px-5 pt-16 pb-4">
      {/* App name label */}
      <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        StoryStack
      </Text>
      
      {/* Main title and subtitle */}
      <View className="mb-6 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="mb-1 text-[32px] font-bold leading-[38px] tracking-[-0.5px] text-gray-900">
            Your Photos
          </Text>
          <Text className="text-[15px] leading-[20px] text-gray-500">
            Import, filter, and build stories.
          </Text>
        </View>
        
        {/* Tag Management button */}
        {onTagManagementPress && (
          <TouchableOpacity
            onPress={onTagManagementPress}
            activeOpacity={0.6}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: 'rgba(179, 143, 91, 0.1)',
            }}
          >
            <MaterialCommunityIcons
              name="tag-multiple"
              size={20}
              color="#b38f5b"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

