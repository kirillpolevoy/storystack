import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { TagVocabulary } from '@/types';

type TagFilterBarProps = {
  selectedTags: TagVocabulary[];
  onToggleTag: (tag: TagVocabulary) => void;
  availableTags: TagVocabulary[]; // Only tags that are actually used in the library
};

const renderTag = (
  tag: TagVocabulary,
  selectedTags: TagVocabulary[],
  onToggleTag: (tag: TagVocabulary) => void,
) => {
  const isActive = selectedTags.includes(tag);
  return (
    <TouchableOpacity
      key={tag}
      onPress={() => onToggleTag(tag)}
      activeOpacity={0.7}
      className="mr-2 rounded-full px-3.5 py-2"
      style={{
        backgroundColor: isActive ? '#b38f5b' : '#ffffff',
        borderWidth: isActive ? 0 : 1,
        borderColor: isActive ? 'transparent' : '#e5e7eb',
        shadowColor: isActive ? '#b38f5b' : 'transparent',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isActive ? 0.15 : 0,
        shadowRadius: 3,
        elevation: isActive ? 2 : 0,
      }}
    >
      <Text
        className="text-[13px] font-medium"
        style={{
          color: isActive ? '#ffffff' : '#374151',
          letterSpacing: -0.1,
        }}
      >
        {tag}
      </Text>
    </TouchableOpacity>
  );
};

export function TagFilterBar({ selectedTags, onToggleTag, availableTags }: TagFilterBarProps) {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      contentContainerStyle={{ paddingVertical: 6, paddingRight: 20 }}
      bounces={false}
    >
      <View className="flex-row items-center">
        {availableTags.map((tag) => renderTag(tag, selectedTags, onToggleTag))}
      </View>
    </ScrollView>
  );
}
