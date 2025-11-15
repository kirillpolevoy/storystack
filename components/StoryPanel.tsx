import { Asset } from '@/types';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type StoryPanelProps = {
  selectedAssets: Asset[];
  onMoveUp: (assetId: string) => void;
  onMoveDown: (assetId: string) => void;
  onClear: () => void;
  onExport: () => Promise<void>;
  isExporting?: boolean;
};

export function StoryPanel({
  selectedAssets,
  onMoveUp,
  onMoveDown,
  onClear,
  onExport,
  isExporting = false,
}: StoryPanelProps) {
  const hasAssets = selectedAssets.length > 0;

  return (
    <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white px-5 pb-8 pt-6 shadow-card">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-900">Story Sequence</Text>
        {hasAssets ? (
          <TouchableOpacity onPress={onClear}>
            <Text className="text-sm font-semibold text-gray-500">Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {hasAssets ? (
        <ScrollView className="max-h-60">
          {selectedAssets.map((asset, index) => (
            <View key={asset.id} className="mb-3 flex-row items-center rounded-2xl bg-gray-50 p-3">
              <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-accent">
                <Text className="text-base font-semibold text-white">{index + 1}</Text>
              </View>
              {asset.publicUrl ? (
                <Image source={{ uri: asset.publicUrl }} className="mr-3 h-12 w-12 rounded-xl" />
              ) : null}
              <Text className="flex-1 text-sm font-medium text-gray-800" numberOfLines={1}>
                {asset.tags[0] ?? 'Untitled'}
              </Text>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => onMoveUp(asset.id)}
                  className="mr-2 rounded-full border border-gray-300 px-3 py-1"
                  disabled={index === 0}
                >
                  <Text className={`text-xs font-semibold ${index === 0 ? 'text-gray-300' : 'text-gray-600'}`}>Up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onMoveDown(asset.id)}
                  className="rounded-full border border-gray-300 px-3 py-1"
                  disabled={index === selectedAssets.length - 1}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      index === selectedAssets.length - 1 ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    Down
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text className="text-sm text-gray-500">Select photos from the grid to build your story.</Text>
      )}

      <TouchableOpacity
        onPress={onExport}
        disabled={!hasAssets || isExporting}
        className={`mt-6 rounded-full py-4 shadow-card ${
          hasAssets && !isExporting ? 'bg-accent' : 'bg-gray-300'
        }`}
        activeOpacity={0.8}
      >
        <Text className="text-center text-base font-semibold text-white">
          {isExporting ? 'Exporting…' : `Export Story${hasAssets ? ` (${selectedAssets.length})` : ''}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

