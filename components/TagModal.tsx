import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Asset, STORYSTACK_TAGS, TagVocabulary } from '@/types';

const MAX_TAGS = 5;

type TagModalProps = {
  asset: Asset | null;
  visible: boolean;
  onClose: () => void;
  onUpdateTags: (newTags: TagVocabulary[]) => Promise<void>;
  allAvailableTags?: TagVocabulary[]; // All tags from library for easy selection
  multipleAssets?: Asset[]; // Multiple assets being edited (for bulk tagging)
};

export function TagModal({ asset, visible, onClose, onUpdateTags, allAvailableTags = [], multipleAssets = [] }: TagModalProps) {
  const [localTags, setLocalTags] = useState<TagVocabulary[]>([]);
  const [newTag, setNewTag] = useState('');

  // Use ref to track previous values and prevent infinite loops
  const prevAssetIdRef = useRef<string | undefined>();
  const prevMultipleAssetsIdsRef = useRef<string>('');
  
  // Create stable string representation of asset IDs - use JSON.stringify for stable dependency
  const multipleAssetsIdsString = useMemo(() => {
    return multipleAssets.map(a => a.id).sort().join(',');
  }, [JSON.stringify(multipleAssets.map(a => a.id).sort())]);
  
  const assetId = asset?.id;
  const isMultiEdit = multipleAssets.length > 1;

  useEffect(() => {
    // Only update if values actually changed
    const assetIdChanged = prevAssetIdRef.current !== assetId;
    const multipleAssetsChanged = prevMultipleAssetsIdsRef.current !== multipleAssetsIdsString;
    
    if (!visible) {
      // Reset when modal closes
      if (prevAssetIdRef.current !== undefined || prevMultipleAssetsIdsRef.current !== '') {
        setLocalTags([]);
        setNewTag('');
        prevAssetIdRef.current = undefined;
        prevMultipleAssetsIdsRef.current = '';
      }
      return;
    }

    // Only update tags if asset or multiple assets actually changed
    if (assetIdChanged || multipleAssetsChanged) {
      if (isMultiEdit && multipleAssets.length > 0) {
        // For multi-edit, start with empty tags (user will add tags to apply to all)
        // This way we're adding tags, not replacing them
        setLocalTags([]);
      } else if (asset) {
        setLocalTags(asset.tags ?? []);
      } else {
        setLocalTags([]);
      }
      setNewTag('');
      
      // Update refs
      prevAssetIdRef.current = assetId;
      prevMultipleAssetsIdsRef.current = multipleAssetsIdsString;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, assetId, multipleAssetsIdsString]);

  const tagsSet = useMemo(() => new Set(localTags), [localTags]);

  // Combine all available tags: StoryStack tags + library tags, excluding already selected ones
  const allAvailableTagsCombined = useMemo(() => {
    const selectedSet = new Set(localTags);
    const storystackTags = STORYSTACK_TAGS.filter((tag) => !selectedSet.has(tag));
    const libraryTags = allAvailableTags.filter((tag) => !selectedSet.has(tag));
    
    // Combine and deduplicate, then sort alphabetically
    const combined = [...new Set([...storystackTags, ...libraryTags])];
    return combined.sort((a, b) => a.localeCompare(b));
  }, [allAvailableTags, localTags]);

  const toggleTag = (tag: TagVocabulary) => {
    setLocalTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= MAX_TAGS) {
        Alert.alert('Tag limit reached', `You can select up to ${MAX_TAGS} tags.`);
        return prev;
      }
      return [...prev, tag];
    });
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) {
      return;
    }
    setLocalTags((prev) => {
      if (prev.includes(trimmed)) {
        return prev;
      }
      if (prev.length >= MAX_TAGS) {
        Alert.alert('Tag limit reached', `You can select up to ${MAX_TAGS} tags.`);
        return prev;
      }
      return [...prev, trimmed];
    });
    setNewTag('');
    Keyboard.dismiss();
  };

  const handleSave = async () => {
    await onUpdateTags(localTags.slice(0, MAX_TAGS));
    onClose();
  };

  const hasChanges = useMemo(() => {
    if (isMultiEdit) {
      // For multi-edit, consider it changed if tags are not empty
      // (since we're applying tags to multiple photos that may have different tags)
      return localTags.length > 0;
    }
    if (!asset) return false;
    const originalTags = asset.tags ?? [];
    if (originalTags.length !== localTags.length) return true;
    return !originalTags.every((tag) => localTags.includes(tag));
  }, [asset, localTags, isMultiEdit]);

  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View className="flex-1 bg-[#f7f7f7]">
        {/* Header - Premium style */}
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
            <TouchableOpacity onPress={onClose} activeOpacity={0.6}>
              <Text className="text-[17px] font-semibold text-gray-900" style={{ letterSpacing: -0.3 }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <View className="items-center flex-1">
              <Text className="text-[20px] font-bold text-gray-900" style={{ letterSpacing: -0.5 }}>
                Edit Tags
              </Text>
              {isMultiEdit && (
                <Text className="mt-0.5 text-[13px] text-gray-500">
                  {multipleAssets.length} {multipleAssets.length === 1 ? 'photo' : 'photos'}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!hasChanges}
              activeOpacity={0.6}
            >
              <Text
                className={`text-[17px] font-semibold ${
                  hasChanges ? 'text-[#b38f5b]' : 'text-gray-300'
                }`}
                style={{ letterSpacing: -0.3 }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo Preview - Premium card */}
          {isMultiEdit && multipleAssets.length > 0 ? (
            <View
              className="mx-5 mt-5 rounded-2xl bg-white px-4 py-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text className="mb-3 text-center text-[13px] font-medium text-gray-500">
                {multipleAssets.length} {multipleAssets.length === 1 ? 'photo' : 'photos'} selected
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                {multipleAssets.slice(0, 9).map((assetItem, index) => (
                  <View
                    key={assetItem.id}
                    className="overflow-hidden rounded-xl bg-gray-100"
                    style={{
                      width: '31%',
                      aspectRatio: 1,
                    }}
                  >
                    {assetItem.publicUrl ? (
                      <Image
                        source={{ uri: assetItem.publicUrl }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-full w-full items-center justify-center bg-gray-200">
                        <Text className="text-[10px] text-gray-400">Loading...</Text>
                      </View>
                    )}
                  </View>
                ))}
                {multipleAssets.length > 9 && (
                  <View
                    className="items-center justify-center rounded-xl bg-gray-100"
                    style={{
                      width: '31%',
                      aspectRatio: 1,
                    }}
                  >
                    <Text className="text-[24px] font-bold text-gray-400">+{multipleAssets.length - 9}</Text>
                  </View>
                )}
              </View>
              <Text className="mt-3 text-center text-[12px] text-gray-500">
                Tags will be added to all {multipleAssets.length} {multipleAssets.length === 1 ? 'photo' : 'photos'}
              </Text>
            </View>
          ) : asset?.publicUrl ? (
            <View
              className="mx-5 mt-5 rounded-2xl bg-white p-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View
                className="overflow-hidden rounded-xl bg-gray-100"
                style={{
                  aspectRatio: 1,
                }}
              >
                <Image
                  source={{ uri: asset.publicUrl }}
                  className="h-full w-full"
                  resizeMode="contain"
                />
              </View>
            </View>
          ) : null}

          {/* Selected Tags - Premium card */}
          {localTags.length > 0 && (
            <View
              className="mx-5 mt-5 rounded-2xl bg-white px-4 py-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-[13px] font-semibold text-gray-700" style={{ letterSpacing: -0.1 }}>
                  Selected ({localTags.length}/{MAX_TAGS})
                </Text>
              </View>
              <View className="flex-row flex-wrap">
                {localTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.85}
                    className="mr-2 mb-2 rounded-full px-4 py-2"
                    style={{
                      backgroundColor: '#b38f5b',
                      shadowColor: '#b38f5b',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 3,
                      elevation: 2,
                    }}
                  >
                    <Text className="text-[15px] font-medium text-white" style={{ letterSpacing: -0.1 }}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Add Custom Tag - Premium card */}
          <View
            className="mx-5 mt-5 rounded-2xl bg-white px-4 py-4"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text className="mb-3 text-[13px] font-semibold text-gray-700" style={{ letterSpacing: -0.1 }}>
              Add Custom Tag
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 rounded-2xl border bg-gray-50 px-4 py-3 text-[16px] text-gray-900"
                placeholder="Tag name"
                placeholderTextColor="#9ca3af"
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
                maxLength={30}
                style={{
                  borderColor: '#e5e7eb',
                  letterSpacing: -0.2,
                }}
              />
              <TouchableOpacity
                onPress={handleAddTag}
                disabled={!newTag.trim() || localTags.length >= MAX_TAGS}
                activeOpacity={0.85}
                className="rounded-2xl px-5 py-3"
                style={{
                  backgroundColor: (!newTag.trim() || localTags.length >= MAX_TAGS) ? '#e5e7eb' : '#b38f5b',
                  shadowColor: (!newTag.trim() || localTags.length >= MAX_TAGS) ? 'transparent' : '#b38f5b',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: (!newTag.trim() || localTags.length >= MAX_TAGS) ? 0 : 0.2,
                  shadowRadius: 8,
                  elevation: (!newTag.trim() || localTags.length >= MAX_TAGS) ? 0 : 3,
                }}
              >
                <Text
                  className="text-[16px] font-semibold"
                  style={{
                    color: (!newTag.trim() || localTags.length >= MAX_TAGS) ? '#9ca3af' : '#ffffff',
                    letterSpacing: -0.2,
                  }}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>
            {localTags.length >= MAX_TAGS && (
              <Text className="mt-2 text-[12px] text-red-600">
                Maximum {MAX_TAGS} tags reached
              </Text>
            )}
          </View>

          {/* All Available Tags - Premium card */}
          {allAvailableTagsCombined.length > 0 && (
            <View
              className="mx-5 mt-5 rounded-2xl bg-white px-4 py-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text className="mb-4 text-[13px] font-semibold text-gray-700" style={{ letterSpacing: -0.1 }}>
                Available Tags
              </Text>
              <View className="flex-row flex-wrap">
                {allAvailableTagsCombined.map((tag) => {
                  const isActive = tagsSet.has(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => {
                        if (localTags.length < MAX_TAGS || isActive) {
                          toggleTag(tag);
                        } else {
                          Alert.alert('Tag limit reached', `You can select up to ${MAX_TAGS} tags.`);
                        }
                      }}
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
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Empty State - Premium */}
          {localTags.length === 0 && (
            <View
              className="mx-5 mt-5 rounded-2xl bg-white px-6 py-12"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="items-center">
                <Text className="mb-2 text-center text-[17px] font-medium text-gray-900" style={{ letterSpacing: -0.3 }}>
                  No tags selected
                </Text>
                <Text className="text-center text-[15px] text-gray-500">
                  Add tags to organize your photos
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
