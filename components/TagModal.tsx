import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Modal, ScrollView, Text, TextInput, TouchableOpacity, View, Animated, Easing, ActionSheetIOS, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Asset, TagVocabulary } from '@/types';

type TagModalProps = {
  asset: Asset | null;
  visible: boolean;
  onClose: () => void;
  onUpdateTags: (newTags: TagVocabulary[]) => Promise<void>;
  allAvailableTags?: TagVocabulary[];
  multipleAssets?: Asset[];
  onDelete?: (asset: Asset) => void;
};

export function TagModal({ asset, visible, onClose, onUpdateTags, allAvailableTags = [], multipleAssets = [], onDelete }: TagModalProps) {
  const [localTags, setLocalTags] = useState<TagVocabulary[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  
  // Smooth, delightful entrance animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.96)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const photoOpacity = useRef(new Animated.Value(0)).current;
  const photoScale = useRef(new Animated.Value(0.95)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(12)).current;

  const prevAssetIdRef = useRef<string | undefined>(undefined);
  const prevMultipleAssetsIdsRef = useRef<string>('');
  
  const multipleAssetsIdsString = useMemo(() => {
    return multipleAssets.map(a => a.id).sort().join(',');
  }, [JSON.stringify(multipleAssets.map(a => a.id).sort())]);
  
  const assetId = asset?.id;
  const isMultiEdit = multipleAssets.length > 1;

  useEffect(() => {
    if (visible) {
      setIsAnimatingOut(false);
      // Reset animations with refined starting values
      backdropOpacity.setValue(0);
      modalScale.setValue(0.96);
      photoOpacity.setValue(0);
      photoScale.setValue(0.94);
      contentOpacity.setValue(0);
      contentTranslateY.setValue(16);
      slideAnim.setValue(0);

      // Ultra-smooth entrance - Apple's refined animation principles
      // Perfect synchronization with refined spring physics
      Animated.parallel([
        // Backdrop fades in with refined timing
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Refined ease-out
          useNativeDriver: true,
        }),
        // Modal slides up with refined spring physics
        Animated.spring(slideAnim, {
          toValue: 1,
          tension: 110,
          friction: 28,
          useNativeDriver: true,
        }),
        // Modal scales with matching refined spring
        Animated.spring(modalScale, {
          toValue: 1,
          tension: 110,
          friction: 28,
          useNativeDriver: true,
        }),
        // Photo fades in with elegant scale - refined timing
        Animated.sequence([
          Animated.delay(60),
          Animated.parallel([
            Animated.timing(photoOpacity, {
              toValue: 1,
              duration: 380,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
            Animated.spring(photoScale, {
              toValue: 1,
              tension: 130,
              friction: 20,
              useNativeDriver: true,
            }),
          ]),
        ]),
        // Content fades in with refined upward motion
        Animated.sequence([
          Animated.delay(120),
          Animated.parallel([
            Animated.timing(contentOpacity, {
              toValue: 1,
              duration: 320,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
            Animated.spring(contentTranslateY, {
              toValue: 0,
              tension: 110,
              friction: 22,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    const assetIdChanged = prevAssetIdRef.current !== assetId;
    const multipleAssetsChanged = prevMultipleAssetsIdsRef.current !== multipleAssetsIdsString;
    
    if (!visible) {
      if (prevAssetIdRef.current !== undefined || prevMultipleAssetsIdsRef.current !== '') {
        setLocalTags([]);
        setNewTag('');
        setIsInputFocused(false);
        prevAssetIdRef.current = undefined;
        prevMultipleAssetsIdsRef.current = '';
      }
      return;
    }

    if (assetIdChanged || multipleAssetsChanged) {
      if (isMultiEdit && multipleAssets.length > 0) {
        setLocalTags([]);
      } else if (asset) {
        setLocalTags(asset.tags ?? []);
      } else {
        setLocalTags([]);
      }
      setNewTag('');
      setIsInputFocused(false);
      
      prevAssetIdRef.current = assetId;
      prevMultipleAssetsIdsRef.current = multipleAssetsIdsString;
    }
  }, [visible, assetId, multipleAssetsIdsString]);

  const handleClose = () => {
    if (isAnimatingOut) return; // Prevent multiple calls
    
    setIsAnimatingOut(true);
    Keyboard.dismiss();
    
    // Ultra-smooth exit - refined, cohesive motion
    // Everything moves together with refined timing
    Animated.parallel([
      // Content fades out quickly for immediate feedback
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 100,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
      // Photo fades out smoothly with refined scale
      Animated.sequence([
        Animated.delay(20),
        Animated.parallel([
          Animated.timing(photoOpacity, {
            toValue: 0,
            duration: 180,
            easing: Easing.bezier(0.4, 0, 1, 1),
            useNativeDriver: true,
          }),
          Animated.timing(photoScale, {
            toValue: 0.94,
            duration: 180,
            easing: Easing.bezier(0.4, 0, 1, 1),
            useNativeDriver: true,
          }),
        ]),
      ]),
      // Backdrop and modal move as one - refined synchronization
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          easing: Easing.bezier(0.4, 0, 0.2, 1), // Refined ease-in-out
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.bezier(0.4, 0, 0.2, 1), // Identical easing for unity
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 0.96,
          duration: 250,
          easing: Easing.bezier(0.4, 0, 0.2, 1), // Perfect synchronization
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Animation complete, close the modal
      setIsAnimatingOut(false);
      onClose();
    });
  };

  const tagsSet = useMemo(() => new Set(localTags), [localTags]);

  const allAvailableTagsCombined = useMemo(() => {
    const selectedSet = new Set(localTags);
    const libraryTags = allAvailableTags.filter((tag) => !selectedSet.has(tag));
    return libraryTags.sort((a, b) => a.localeCompare(b));
  }, [allAvailableTags, localTags]);

  const toggleTag = (tag: TagVocabulary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalTags((prev) => {
      if (prev.includes(trimmed)) {
        return prev;
      }
      return [...prev, trimmed];
    });
    setNewTag('');
    Keyboard.dismiss();
    setIsInputFocused(false);
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await onUpdateTags(localTags);
    handleClose();
  };

  const handleDelete = () => {
    if (!asset || !onDelete) return;
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Delete Photo'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onDelete(asset);
            handleClose();
          }
        }
      );
    } else {
      Alert.alert(
        'Delete Photo',
        'Are you sure you want to delete this photo? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onDelete(asset);
              handleClose();
            },
          },
        ]
      );
    }
  };

  const hasChanges = useMemo(() => {
    if (isMultiEdit) {
      return localTags.length > 0;
    }
    if (!asset) return false;
    const originalTags = asset.tags ?? [];
    if (originalTags.length !== localTags.length) return true;
    return !originalTags.every((tag) => localTags.includes(tag));
  }, [asset, localTags, isMultiEdit]);

  const insets = useSafeAreaInsets();

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0], // Reduced distance for smoother, more natural motion
  });

  return (
    <Modal visible={visible || isAnimatingOut} animationType="none" onRequestClose={handleClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        {/* Seamless backdrop - perfectly synchronized with modal motion */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            opacity: backdropOpacity,
          }}
        />
        <Animated.View 
          className="flex-1 bg-white"
          style={{
            flex: 1,
            transform: [
              { translateY },
              { scale: modalScale },
            ],
          }}
        >
        {/* Minimal Header */}
        <View
          style={{
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: 12,
            paddingHorizontal: 20,
          }}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleClose();
              }} 
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text className="text-[17px] font-regular text-gray-900" style={{ letterSpacing: -0.4 }}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <View className="flex-row items-center gap-6">
              {!isMultiEdit && asset && onDelete && (
                <TouchableOpacity
                  onPress={handleDelete}
                  activeOpacity={0.6}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#8E8E93" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleSave}
                disabled={!hasChanges}
                activeOpacity={0.6}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text
                  className="text-[17px] font-semibold"
                  style={{
                    color: hasChanges ? '#b38f5b' : '#C7C7CC',
                    letterSpacing: -0.4,
                  }}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 40) }}
          showsVerticalScrollIndicator={false}
          bounces={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Photo - Elegant scale and fade */}
          {!isMultiEdit && asset?.publicUrl ? (
            <Animated.View
              style={{
                opacity: photoOpacity,
                transform: [{ scale: photoScale }],
                width: '100%',
                aspectRatio: 1,
                backgroundColor: '#000',
              }}
            >
              <Image
                source={{ uri: asset.publicUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </Animated.View>
          ) : isMultiEdit && multipleAssets.length > 0 ? (
            <Animated.View
              style={{
                opacity: contentOpacity,
                transform: [{ translateY: contentTranslateY }],
                paddingHorizontal: 20,
                paddingTop: 8,
                paddingBottom: 32,
              }}
            >
              <View className="flex-row flex-wrap gap-2">
                {multipleAssets.slice(0, 9).map((assetItem) => (
                  <View
                    key={assetItem.id}
                    className="overflow-hidden rounded-2xl bg-gray-100"
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
                    ) : null}
                  </View>
                ))}
                {multipleAssets.length > 9 && (
                  <View
                    className="items-center justify-center rounded-2xl bg-gray-100"
                    style={{
                      width: '31%',
                      aspectRatio: 1,
                    }}
                  >
                    <Text className="text-[16px] font-medium text-gray-400">+{multipleAssets.length - 9}</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          ) : null}

          {/* Content - Smooth fade and slide */}
          <Animated.View
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
              paddingHorizontal: 20,
              paddingTop: 24,
            }}
          >
            {/* Selected Tags */}
            {localTags.length > 0 && (
              <View className="mb-6">
                <View className="flex-row flex-wrap gap-2">
                  {localTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      activeOpacity={0.7}
                      className="rounded-full px-4 py-2"
                      style={{
                        backgroundColor: '#b38f5b',
                      }}
                    >
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[15px] font-medium text-white" style={{ letterSpacing: -0.3 }}>
                          {tag}
                        </Text>
                        <Text className="text-[13px] font-medium text-white opacity-75">
                          ×
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Add Tag Input */}
            <View className="mb-8">
              <TextInput
                className="w-full rounded-xl bg-gray-50 px-4 py-3.5 text-[16px] text-gray-900"
                placeholder="Add tag"
                placeholderTextColor="#9CA3AF"
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={handleAddTag}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                returnKeyType="done"
                maxLength={30}
                style={{
                  letterSpacing: -0.4,
                  borderWidth: isInputFocused ? 1 : 0,
                  borderColor: '#b38f5b',
                }}
              />
            </View>

            {/* Available Tags */}
            {allAvailableTagsCombined.length > 0 && (
              <View>
                <View className="flex-row flex-wrap gap-2">
                  {allAvailableTagsCombined.map((tag) => {
                    const isActive = tagsSet.has(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        activeOpacity={0.7}
                        className="rounded-full px-4 py-2"
                        style={{
                          backgroundColor: isActive ? '#b38f5b' : '#F3F4F6',
                        }}
                      >
                        <Text
                          className="text-[15px] font-medium"
                          style={{
                            color: isActive ? '#FFFFFF' : '#374151',
                            letterSpacing: -0.3,
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
          </Animated.View>
        </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
