import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type StoryHeaderProps = {
  onBackPress: () => void;
  onAddMorePress?: () => void;
  showAddMore?: boolean;
};

export function StoryHeader({ onBackPress, onAddMorePress, showAddMore = false }: StoryHeaderProps) {
  const insets = useSafeAreaInsets();

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
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={onBackPress}
            activeOpacity={0.6}
            className="mr-4"
          >
            <Text className="text-[17px] font-semibold text-gray-900" style={{ letterSpacing: -0.3 }}>
              ← Back
            </Text>
          </TouchableOpacity>
          <Text className="text-[20px] font-bold text-gray-900" style={{ letterSpacing: -0.5 }}>
            New Story
          </Text>
        </View>
        {showAddMore && onAddMorePress && (
          <TouchableOpacity
            onPress={onAddMorePress}
            activeOpacity={0.6}
            className="ml-4"
          >
            <Text className="text-[15px] font-semibold text-gray-600" style={{ letterSpacing: -0.2 }}>
              Add More
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}


