import { Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type TagHeaderProps = {
  onMenuPress?: () => void;
};

export function TagHeader({ onMenuPress }: TagHeaderProps) {
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
        <Text className="text-[20px] font-bold text-gray-900" style={{ letterSpacing: -0.5 }}>
          Tags
        </Text>
        {onMenuPress && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onMenuPress();
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
        )}
      </View>
    </View>
  );
}




