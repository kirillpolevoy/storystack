import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { TagRow } from './TagRow';

type TagConfig = {
  name: string;
  isAutoTag: boolean;
  usageCount?: number;
};

type TagListCardProps = {
  tags: TagConfig[];
  onToggleTag: (tagName: string) => void;
  onTagPress?: (tagName: string) => void;
  onTagDelete?: (tagName: string) => void;
  togglingTag?: string | null;
};

export function TagListCard({ tags, onToggleTag, onTagPress, onTagDelete, togglingTag }: TagListCardProps) {
  // Memoize callbacks to prevent TagRow re-renders
  const toggleCallbacks = useMemo(() => {
    const callbacks: Record<string, () => void> = {};
    tags.forEach((tag) => {
      callbacks[tag.name] = () => onToggleTag(tag.name);
    });
    return callbacks;
  }, [tags, onToggleTag]);

  const pressCallbacks = useMemo(() => {
    if (!onTagPress) return {};
    const callbacks: Record<string, () => void> = {};
    tags.forEach((tag) => {
      callbacks[tag.name] = () => onTagPress(tag.name);
    });
    return callbacks;
  }, [tags, onTagPress]);

  const deleteCallbacks = useMemo(() => {
    if (!onTagDelete) return {};
    const callbacks: Record<string, () => void> = {};
    tags.forEach((tag) => {
      callbacks[tag.name] = () => onTagDelete(tag.name);
    });
    return callbacks;
  }, [tags, onTagDelete]);

  if (tags.length === 0) {
    return (
      <View
        className="mx-5 rounded-2xl bg-white px-6 py-8"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <Text className="text-center text-[15px] text-gray-500">
          No tags yet. Create your first tag above.
        </Text>
      </View>
    );
  }

  return (
    <View
      className="mx-5 rounded-2xl bg-white overflow-hidden"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Header */}
      <View className="border-b border-gray-100 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Tag name
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              AI
            </Text>
          </View>
        </View>
      </View>

      {/* Tag List */}
      {tags.map((item, index) => (
        <View key={item.name}>
          <TagRow
            tagName={item.name}
            isAutoTag={item.isAutoTag}
            onToggle={toggleCallbacks[item.name]}
            onPress={pressCallbacks[item.name]}
            onDelete={deleteCallbacks[item.name]}
            isToggling={togglingTag === item.name}
            usageCount={item.usageCount}
          />
          {index < tags.length - 1 && (
            <View className="h-[0.5px] bg-gray-100" style={{ marginLeft: 16 }} />
          )}
        </View>
      ))}
    </View>
  );
}

