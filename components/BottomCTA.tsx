import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomCTAProps = {
  selectedCount: number;
  onPress: () => void;
};

export function BottomCTA({ selectedCount, onPress }: BottomCTAProps) {
  const insets = useSafeAreaInsets();
  const isEnabled = selectedCount > 0;

  return (
    <View
      className="border-t border-gray-200 bg-white px-5 pt-4"
      style={{
        paddingBottom: Math.max(insets.bottom, 20),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={!isEnabled}
        activeOpacity={isEnabled ? 0.85 : 1}
        className="w-full rounded-2xl py-4"
        style={{
          backgroundColor: isEnabled ? '#b38f5b' : '#e5e7eb',
          shadowColor: isEnabled ? '#b38f5b' : 'transparent',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isEnabled ? 0.2 : 0,
          shadowRadius: 8,
          elevation: isEnabled ? 3 : 0,
        }}
      >
        <Text
          className="text-center text-[17px] font-semibold"
          style={{
            color: isEnabled ? '#ffffff' : '#9ca3af',
            letterSpacing: -0.2,
          }}
        >
          {isEnabled
            ? `Build Story (${selectedCount} selected)`
            : 'Select photos to build a story'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}


