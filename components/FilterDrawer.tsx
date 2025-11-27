import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TagVocabulary } from '@/types';

type FilterDrawerProps = {
  visible: boolean;
  allTags: TagVocabulary[];
  selectedTags: TagVocabulary[];
  onChangeSelected: (tags: TagVocabulary[]) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
};

export function FilterDrawer({
  visible,
  allTags,
  selectedTags,
  onChangeSelected,
  onApply,
  onClear,
  onClose,
}: FilterDrawerProps) {
  const insets = useSafeAreaInsets();
  const [tempSelectedTags, setTempSelectedTags] = useState<TagVocabulary[]>(selectedTags);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Smooth drawer animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 1,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Update temp selection when drawer opens or selectedTags prop changes
  useEffect(() => {
    if (visible) {
      setTempSelectedTags(selectedTags);
    }
  }, [visible, selectedTags]);

  const toggleTag = (tag: TagVocabulary) => {
    setTempSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
  };

  const handleApply = () => {
    onChangeSelected(tempSelectedTags);
    onApply();
  };

  const handleClear = () => {
    setTempSelectedTags([]);
    onChangeSelected([]);
    onClear();
  };

  // Process allTags - handle both string arrays and object arrays
  const sortedTags = useMemo(() => {
    if (!allTags || !Array.isArray(allTags)) {
      return [];
    }
    if (allTags.length === 0) {
      return [];
    }
    // Extract labels from tags (handle both string and object formats)
    const tagLabels = allTags.map((tag) => {
      if (typeof tag === 'string') {
        return tag;
      }
      // Handle object format: { name, label, id, etc }
      return tag.name ?? tag.label ?? String(tag);
    });
    // Sort alphabetically
    return [...tagLabels].sort((a, b) => a.localeCompare(b));
  }, [allTags]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: backdropOpacity,
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="flex-1 bg-black/50"
        >
          <View className="flex-1 justify-end">
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <Animated.View
                className="rounded-t-3xl bg-white"
                style={{
                  maxHeight: '80%',
                  paddingBottom: Math.max(insets.bottom, 20),
                  transform: [{ translateY }],
                }}
              >
              {/* Header */}
              <View className="border-b border-gray-100 px-5 py-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-[20px] font-bold text-gray-900" style={{ letterSpacing: -0.5 }}>
                      Filters
                    </Text>
                    <Text className="mt-1 text-[13px] text-gray-500">
                      Select tags to narrow your photos
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    activeOpacity={0.6}
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: '#f3f4f6' }}
                  >
                    <Text className="text-lg text-gray-600">×</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tags List */}
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {sortedTags.length === 0 ? (
                  <View className="py-12">
                    <Text className="text-center text-[15px] text-gray-500">
                      No tags available
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap">
                    {sortedTags.map((tagLabel) => {
                      // tagLabel is already a string (extracted in sortedTags)
                      const isActive = tempSelectedTags.includes(tagLabel);
                      
                      return (
                        <TouchableOpacity
                          key={tagLabel}
                          onPress={() => toggleTag(tagLabel)}
                          activeOpacity={0.85}
                          className="mr-2 mb-2 rounded-full px-4 py-2"
                          style={{
                            backgroundColor: isActive ? '#b38f5b' : '#f3f4f6',
                            shadowColor: isActive ? '#b38f5b' : 'transparent',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: isActive ? 0.15 : 0,
                            shadowRadius: 3,
                            elevation: isActive ? 2 : 0,
                          }}
                        >
                          <Text
                            className="text-[15px] font-medium"
                            style={{
                              color: isActive ? '#ffffff' : '#374151',
                              letterSpacing: -0.1,
                            }}
                          >
                            {tagLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>

              {/* Footer Actions */}
              <View
                className="border-t border-gray-100 px-5 pt-4"
                style={{
                  paddingBottom: Math.max(insets.bottom, 20),
                }}
              >
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={handleClear}
                    activeOpacity={0.7}
                    disabled={tempSelectedTags.length === 0}
                    className="flex-1 rounded-2xl bg-white py-3.5"
                    style={{
                      borderWidth: 1,
                      borderColor: tempSelectedTags.length === 0 ? '#e5e7eb' : '#e5e7eb',
                      opacity: tempSelectedTags.length === 0 ? 0.5 : 1,
                    }}
                  >
                    <Text
                      className="text-center text-[16px] font-semibold"
                      style={{
                        color: tempSelectedTags.length === 0 ? '#9ca3af' : '#374151',
                        letterSpacing: -0.2,
                      }}
                    >
                      Clear
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleApply}
                    activeOpacity={0.85}
                    className="flex-1 rounded-2xl py-3.5"
                    style={{
                      backgroundColor: '#b38f5b',
                      shadowColor: '#b38f5b',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    <Text
                      className="text-center text-[16px] font-semibold text-white"
                      style={{ letterSpacing: -0.2 }}
                    >
                      Apply {tempSelectedTags.length > 0 ? `(${tempSelectedTags.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

