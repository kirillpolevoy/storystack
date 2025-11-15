import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type StoryActionBarProps = {
  photoCount: number;
  onClear: () => void;
  onExport: () => void;
  canExport: boolean;
  isExporting: boolean;
};

export function StoryActionBar({
  photoCount,
  onClear,
  onExport,
  canExport,
  isExporting,
}: StoryActionBarProps) {
  const insets = useSafeAreaInsets();

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
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-[15px] font-medium text-gray-600">
          {photoCount} {photoCount === 1 ? 'photo' : 'photos'} in this story
        </Text>
        <View className="flex-row gap-3">
          {/* Clear Button */}
          <TouchableOpacity
            onPress={onClear}
            disabled={photoCount === 0}
            activeOpacity={0.6}
            className="px-4 py-2"
          >
            <Text
              className="text-[15px] font-semibold"
              style={{
                color: photoCount === 0 ? '#d1d5db' : '#374151',
                letterSpacing: -0.2,
              }}
            >
              Clear
            </Text>
          </TouchableOpacity>

          {/* Export Button */}
          <TouchableOpacity
            onPress={onExport}
            disabled={!canExport || isExporting}
            activeOpacity={canExport && !isExporting ? 0.85 : 1}
            className="flex-1 rounded-2xl py-3"
            style={{
              backgroundColor: canExport && !isExporting ? '#b38f5b' : '#e5e7eb',
              shadowColor: canExport && !isExporting ? '#b38f5b' : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: canExport && !isExporting ? 0.2 : 0,
              shadowRadius: 8,
              elevation: canExport && !isExporting ? 3 : 0,
            }}
          >
            <Text
              className="text-center text-[16px] font-semibold"
              style={{
                color: canExport && !isExporting ? '#ffffff' : '#9ca3af',
                letterSpacing: -0.2,
              }}
            >
              {isExporting ? 'Exporting…' : 'Export Story'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}


