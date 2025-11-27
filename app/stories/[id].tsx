import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, TextInput, ScrollView, Animated, Easing, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '@/contexts/AuthContext';
import { StoryWithAssets, Asset } from '@/types';
import { getStoryById, updateStory, deleteStory, removeAssetFromStory, reorderStoryAssets } from '@/utils/stories';
import { exportStorySequence } from '@/utils/exportStory';
import { MenuDrawer } from '@/components/MenuDrawer';
import * as Haptics from 'expo-haptics';

export default function StoryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const storyId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [story, setStory] = useState<StoryWithAssets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Modal animations
  const modalScale = useRef(new Animated.Value(0.95)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const loadStory = useCallback(async () => {
    if (!session?.user?.id || !storyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const storyData = await getStoryById(storyId, session.user.id);
      if (storyData) {
        setStory(storyData);
        setEditName(storyData.name);
        setEditDescription(storyData.description || '');
      } else {
        Alert.alert('Error', 'Story not found');
        router.back();
      }
    } catch (error) {
      console.error('[StoryDetail] Failed to load story:', error);
      Alert.alert('Error', 'Failed to load story');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [session, storyId, router]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

  // Animate modal
  useEffect(() => {
    if (isEditModalOpen) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isEditModalOpen]);

  const handleSaveEdit = async () => {
    if (!session?.user?.id || !story) return;

    const success = await updateStory(story.id, session.user.id, {
      name: editName.trim(),
      description: editDescription.trim() || null,
    });

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditModalOpen(false);
      loadStory();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update story');
    }
  };

  const handleDelete = async () => {
    if (!session?.user?.id || !story) return;

    Alert.alert(
      'Delete Story',
      `Are you sure you want to delete "${story.name}"? This will remove the story but keep the photos.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const success = await deleteStory(story.id, session.user.id);
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete story');
            }
          },
        },
      ]
    );
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!session?.user?.id || !story) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const success = await removeAssetFromStory(story.id, session.user.id, assetId);
    if (success) {
      loadStory();
    } else {
      Alert.alert('Error', 'Failed to remove photo from story');
    }
  };

  const handleDownload = async () => {
    if (!story || story.assets.length === 0) return;

    setIsDownloading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await exportStorySequence(story.assets, story.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[StoryDetail] Download failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to download story');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddPhotos = () => {
    if (!story) return;
    router.push({
      pathname: '/',
      params: {
        existingAssetIds: story.assets.map((a) => a.id).join(','),
        storyName: story.name,
      },
    } as any);
  };

  // Asset Item Component
  const AssetItem = ({ asset, index }: { asset: Asset; index: number }) => {
    const swipeableRef = useRef<Swipeable>(null);

    const renderRightActions = () => (
      <View 
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'flex-end',
          marginRight: 20,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            swipeableRef.current?.close();
            handleRemoveAsset(asset.id);
          }}
          activeOpacity={0.9}
          style={{
            backgroundColor: '#FF3B30',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
            borderTopRightRadius: 16,
            borderBottomRightRadius: 16,
          }}
        >
          <Text
            style={{
              color: '#ffffff',
              fontSize: 17,
              fontWeight: '400',
              letterSpacing: -0.41,
            }}
          >
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View style={{ marginBottom: 12, marginHorizontal: 20 }}>
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          overshootRight={false}
          friction={2}
          containerStyle={{
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 88 }}>
              {/* Photo */}
              {asset.publicUrl ? (
                <Image
                  source={{ uri: asset.publicUrl }}
                  style={{ width: 88, height: 88 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 88,
                    height: 88,
                    backgroundColor: '#f5f5f7',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="image-outline" size={32} color="#c7c7cc" />
                </View>
              )}

              {/* Info */}
              <View style={{ flex: 1, padding: 16, paddingLeft: 16, justifyContent: 'center' }}>
                {asset.tags.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {asset.tags.slice(0, 3).map((tag) => (
                      <View
                        key={tag}
                        style={{
                          backgroundColor: 'rgba(179, 143, 91, 0.12)',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '500',
                            color: '#b38f5b',
                            letterSpacing: -0.1,
                          }}
                        >
                          {tag}
                        </Text>
                      </View>
                    ))}
                    {asset.tags.length > 3 && (
                      <Text style={{ fontSize: 13, color: '#8e8e93', lineHeight: 20 }}>
                        +{asset.tags.length - 3}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={{ height: 20 }} />
                )}
              </View>
            </View>
          </View>
        </Swipeable>
      </View>
    );
  };

  const renderAssetItem = ({ item: asset, index }: { item: Asset; index: number }) => {
    return <AssetItem asset={asset} index={index} />;
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#b38f5b" />
      </View>
    );
  }

  if (!story) {
    return null;
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: '#111827',
                letterSpacing: -0.5,
              }}
              numberOfLines={1}
            >
              {story.name}
            </Text>
            {story.description && (
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '400',
                  color: '#6b7280',
                  marginTop: 4,
                  letterSpacing: -0.2,
                }}
                numberOfLines={1}
              >
                {story.description}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsMenuOpen(true);
            }}
            activeOpacity={0.6}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(179, 143, 91, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 16,
            }}
          >
            <MaterialCommunityIcons name="menu" size={20} color="#b38f5b" />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={() => setIsEditModalOpen(true)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: '#f5f5f7',
            }}
          >
            <MaterialCommunityIcons name="pencil" size={18} color="#000000" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#000000', letterSpacing: -0.3 }}>
              Edit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDownload}
            disabled={isDownloading || story.assets.length === 0}
            activeOpacity={0.7}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: isDownloading || story.assets.length === 0 ? '#e5e5ea' : '#b38f5b',
            }}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
            ) : (
              <MaterialCommunityIcons name="download" size={18} color={isDownloading || story.assets.length === 0 ? '#8e8e93' : '#ffffff'} style={{ marginRight: 6 }} />
            )}
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDownloading || story.assets.length === 0 ? '#8e8e93' : '#ffffff',
                letterSpacing: -0.3,
              }}
            >
              {isDownloading ? 'Downloading...' : 'Download'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Photos List */}
      {story.assets.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 25,
              backgroundColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            <MaterialCommunityIcons name="image-outline" size={48} color="#c7c7cc" />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: '#000000',
              marginBottom: 8,
              textAlign: 'center',
              letterSpacing: -0.5,
            }}
          >
            No Photos Yet
          </Text>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '400',
              color: '#8e8e93',
              textAlign: 'center',
              marginBottom: 32,
              lineHeight: 24,
              letterSpacing: -0.3,
            }}
          >
            Add photos to this story from your library
          </Text>
          <TouchableOpacity
            onPress={handleAddPhotos}
            activeOpacity={0.8}
            style={{
              paddingHorizontal: 28,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: '#b38f5b',
              shadowColor: '#b38f5b',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#ffffff', letterSpacing: -0.3 }}>
              Add Photos
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={story.assets}
          renderItem={renderAssetItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom + 20, 40),
          }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <TouchableOpacity
              onPress={handleAddPhotos}
              activeOpacity={0.7}
              style={{
                marginHorizontal: 20,
                marginTop: 8,
                padding: 24,
                borderRadius: 16,
                backgroundColor: '#ffffff',
                borderWidth: 2,
                borderColor: '#e5e5ea',
                borderStyle: 'dashed',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <MaterialCommunityIcons name="plus-circle" size={36} color="#b38f5b" />
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: '#b38f5b',
                  marginTop: 12,
                  letterSpacing: -0.3,
                }}
              >
                Add More Photos
              </Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* Edit Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="none"
        onRequestClose={() => {
          Keyboard.dismiss();
          setIsEditModalOpen(false);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          Keyboard.dismiss();
          setIsEditModalOpen(false);
        }}>
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
              opacity: backdropOpacity,
            }}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <Animated.View
                style={{
                  width: '100%',
                  maxWidth: 400,
                  backgroundColor: '#ffffff',
                  borderRadius: 20,
                  padding: 28,
                  opacity: modalOpacity,
                  transform: [{ scale: modalScale }],
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.2,
                  shadowRadius: 24,
                  elevation: 8,
                }}
              >
            <Text
              style={{
                fontSize: 28,
                fontWeight: '700',
                color: '#000000',
                marginBottom: 24,
                letterSpacing: -0.6,
              }}
            >
              Edit Story
            </Text>

            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#8e8e93',
                  marginBottom: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Name
              </Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Story name"
                placeholderTextColor="#c7c7cc"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  // Focus description field when name is submitted
                }}
                style={{
                  fontSize: 17,
                  fontWeight: '400',
                  color: '#000000',
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: '#f5f5f7',
                  letterSpacing: -0.3,
                }}
              />
            </View>

            <View style={{ marginBottom: 28 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#8e8e93',
                  marginBottom: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Description (Optional)
              </Text>
              <TextInput
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Add a description..."
                placeholderTextColor="#c7c7cc"
                multiline
                numberOfLines={3}
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                }}
                style={{
                  fontSize: 17,
                  fontWeight: '400',
                  color: '#000000',
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: '#f5f5f7',
                  minHeight: 88,
                  textAlignVertical: 'top',
                  letterSpacing: -0.3,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setIsEditModalOpen(false);
                }}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 12,
                  backgroundColor: '#f5f5f7',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#000000', letterSpacing: -0.3 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  handleSaveEdit();
                }}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 12,
                  backgroundColor: '#b38f5b',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#ffffff', letterSpacing: -0.3 }}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Menu Drawer */}
      <MenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </View>
  );
}
