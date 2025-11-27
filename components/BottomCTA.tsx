import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomCTAProps = {
  selectedCount: number;
  onPress: () => void;
};

export function BottomCTA({ selectedCount, onPress }: BottomCTAProps) {
  const insets = useSafeAreaInsets();
  const isEnabled = selectedCount > 0;

  // Apple-style: Only show when actionable
  if (!isEnabled) {
    return null;
  }

  return (
    <View
      className="border-t border-gray-100 bg-white px-5 pt-3"
      style={{
        paddingBottom: Math.max(insets.bottom, 16),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        className="w-full rounded-xl py-3.5"
        style={{
          backgroundColor: '#b38f5b',
          shadowColor: '#b38f5b',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Text
          className="text-center text-[16px] font-semibold text-white"
          style={{
            letterSpacing: -0.2,
          }}
        >
          Build Story
        </Text>
      </TouchableOpacity>
    </View>
  );
}




