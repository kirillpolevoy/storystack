import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '@/contexts/AuthContext';
import { StoryWithAssets } from '@/types';
import { getStories, deleteStory } from '@/utils/stories';
import { MenuDrawer } from '@/components/MenuDrawer';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import * as Haptics from 'expo-haptics';

export default function StoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [stories, setStories] = useState<StoryWithAssets[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Animation refs for empty state
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.9)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const loadStories = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const userStories = await getStories(session.user.id);
      setStories(userStories);
    } catch (error) {
      console.error('[StoriesScreen] Failed to load stories:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  // Filter stories based on search query
  const filteredStories = useMemo(() => {
    return stories.filter((story) =>
      story.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stories, searchQuery]);

  // Animate empty state entrance
  useEffect(() => {
    if (!isLoading && filteredStories.length === 0 && !searchQuery) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(iconScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(iconOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.spring(buttonScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // Reset animations
      iconScale.setValue(0);
      iconOpacity.setValue(0);
      textOpacity.setValue(0);
      buttonScale.setValue(0.9);
      buttonOpacity.setValue(0);
    }
  }, [isLoading, filteredStories.length, searchQuery]);

  const handleDeleteStory = async (story: StoryWithAssets) => {
    if (!session?.user?.id) return;

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
              loadStories();
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete story. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Story Item Component (separate component to use hooks)
  const StoryItem = ({ story }: { story: StoryWithAssets }) => {
    const swipeableRef = useRef<Swipeable>(null);
    const thumbnailAsset = story.assets && story.assets.length > 0 ? story.assets[0] : null;
    const hasThumbnail = thumbnailAsset?.publicUrl;

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
            handleDeleteStory(story);
          }}
          activeOpacity={0.9}
          style={{
            backgroundColor: '#FF3B30',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
            borderTopRightRadius: 20,
            borderBottomRightRadius: 20,
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
      <View style={{ marginBottom: 16, marginHorizontal: 20 }}>
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          overshootRight={false}
          friction={2}
          containerStyle={{
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            onPress={() => {
              swipeableRef.current?.close();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/stories/${story.id}` as any);
            }}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 100 }}>
              {/* Thumbnail - Larger, more prominent */}
              <View
                style={{
                  width: 100,
                  height: 100,
                  backgroundColor: '#f5f5f7',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {hasThumbnail ? (
                  <Image
                    source={{ uri: thumbnailAsset.publicUrl }}
                    style={{ width: 100, height: 100 }}
                    contentFit="cover"
                  />
                ) : (
                  <MaterialCommunityIcons name="image-outline" size={36} color="#c7c7cc" />
                )}
              </View>

              {/* Story Info */}
              <View style={{ flex: 1, padding: 20, paddingLeft: 16 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '600',
                    color: '#000000',
                    letterSpacing: -0.4,
                    marginBottom: 6,
                  }}
                  numberOfLines={1}
                >
                  {story.name}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '400',
                    color: '#8e8e93',
                    letterSpacing: -0.2,
                  }}
                >
                  {story.asset_count} {story.asset_count === 1 ? 'photo' : 'photos'}
                </Text>
              </View>

              {/* Chevron */}
              <View style={{ paddingRight: 20 }}>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#c7c7cc" />
              </View>
            </View>
          </TouchableOpacity>
        </Swipeable>
      </View>
    );
  };

  const renderStoryItem = ({ item: story }: { item: StoryWithAssets }) => {
    return <StoryItem story={story} />;
  };

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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: '#111827',
              letterSpacing: -0.5,
            }}
          >
            Stories
          </Text>
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
            }}
          >
            <MaterialCommunityIcons name="menu" size={20} color="#b38f5b" />
          </TouchableOpacity>
        </View>

        {/* Search Bar - Refined */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f5f5f7',
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <MaterialCommunityIcons name="magnify" size={20} color="#8e8e93" style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search stories..."
            placeholderTextColor="#8e8e93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              fontSize: 17,
              fontWeight: '400',
              color: '#000000',
              letterSpacing: -0.3,
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              activeOpacity={0.6}
            >
              <MaterialCommunityIcons name="close-circle" size={20} color="#8e8e93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stories List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#b38f5b" />
        </View>
      ) : filteredStories.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          {/* Icon Container */}
          <Animated.View
            style={{
              opacity: iconOpacity,
              transform: [{ scale: iconScale }],
              marginBottom: 32,
            }}
          >
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 30,
                backgroundColor: '#ffffff',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 16,
                elevation: 4,
              }}
            >
              <MaterialCommunityIcons 
                name="book-multiple-outline" 
                size={56} 
                color="#b38f5b"
              />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View
            style={{
              opacity: textOpacity,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: '700',
                color: '#000000',
                textAlign: 'center',
                letterSpacing: -0.6,
                marginBottom: 8,
              }}
            >
              {searchQuery ? 'No Stories Found' : 'No Stories Yet'}
            </Text>
          </Animated.View>

          {/* Description */}
          <Animated.View
            style={{
              opacity: textOpacity,
              marginBottom: 40,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '400',
                color: '#8e8e93',
                textAlign: 'center',
                lineHeight: 24,
                letterSpacing: -0.3,
              }}
            >
              {searchQuery
                ? 'Try a different search term or create a new story'
                : 'Organize your photos into beautiful stories.\nSelect photos from your library to get started.'}
            </Text>
          </Animated.View>

          {/* CTA Button */}
          {!searchQuery && (
            <Animated.View
              style={{
                opacity: buttonOpacity,
                transform: [{ scale: buttonScale }],
                width: '100%',
                maxWidth: 280,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/');
                }}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#b38f5b',
                  borderRadius: 16,
                  paddingVertical: 16,
                  paddingHorizontal: 32,
                  shadowColor: '#b38f5b',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons 
                    name="image-multiple" 
                    size={20} 
                    color="#ffffff" 
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '600',
                      color: '#ffffff',
                      letterSpacing: -0.3,
                    }}
                  >
                    Go to Library
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      ) : (
        <>
          <FlatList
            data={filteredStories}
            renderItem={renderStoryItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom + 100, 120),
            }}
            showsVerticalScrollIndicator={false}
          />
          
          {/* Floating Action Button - Create Story */}
          <FloatingActionButton
            icon="plus"
            onPress={() => {
              // Navigate to empty story builder, which will show empty state
              router.push({
                pathname: '/story-builder',
                params: {},
              } as any);
            }}
            visible={!searchQuery}
          />
        </>
      )}

      {/* Menu Drawer */}
      <MenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </View>
  );
}
