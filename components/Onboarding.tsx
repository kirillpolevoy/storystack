import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
};

// Professional photos for brand teams and small businesses
const ONBOARDING_PHOTOS = {
  product1: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop',
  product2: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&fit=crop',
  product3: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
  product4: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop',
  workspace: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&h=400&fit=crop',
  team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop',
  brand: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=400&fit=crop',
  marketing: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop',
};

// Visual components for each feature
const ImportVisual = () => (
  <View style={{ marginTop: 32, alignItems: 'center', width: '100%' }}>
    <View style={{ position: 'relative', width: 280, height: 200, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
      {/* Photo grid with real photos */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          ONBOARDING_PHOTOS.product1,
          ONBOARDING_PHOTOS.product2,
          ONBOARDING_PHOTOS.product3,
          ONBOARDING_PHOTOS.product4,
        ].map((photo, i) => (
          <Image
            key={i}
            source={{ uri: photo }}
            style={{ width: 60, height: 60, borderRadius: 8 }}
            resizeMode="cover"
          />
        ))}
      </View>
      {/* Bottom Tab Bar with Add button highlighted */}
      <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, height: 60, backgroundColor: '#ffffff', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}>
        <MaterialCommunityIcons name="view-grid-outline" size={20} color="#9ca3af" />
        <MaterialCommunityIcons name="book-outline" size={20} color="#9ca3af" />
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#b38f5b', alignItems: 'center', justifyContent: 'center', shadowColor: '#b38f5b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}>
          <MaterialCommunityIcons name="plus" size={24} color="#ffffff" />
        </View>
        <MaterialCommunityIcons name="tag-outline" size={20} color="#9ca3af" />
        <MaterialCommunityIcons name="account-outline" size={20} color="#9ca3af" />
      </View>
    </View>
  </View>
);

const TagsVisual = () => (
  <View style={{ marginTop: 32, alignItems: 'center', width: '100%' }}>
    <View style={{ width: 280, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
      {/* Real product photo */}
      <View style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
        <Image
          source={{ uri: ONBOARDING_PHOTOS.product1 }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
      {/* Tags */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['Product', 'Brand', 'Campaign'].map((tag, i) => (
          <View key={i} style={{ backgroundColor: 'rgba(179, 143, 91, 0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#b38f5b' }}>{tag}</Text>
          </View>
        ))}
        <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialCommunityIcons name="plus" size={14} color="#6b7280" />
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#6b7280' }}>Add tag</Text>
        </View>
      </View>
    </View>
  </View>
);

const FilteringVisual = () => (
  <View style={{ marginTop: 32, alignItems: 'center', width: '100%' }}>
    <View style={{ width: 280, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
      {/* Search bar */}
      <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MaterialCommunityIcons name="magnify" size={18} color="#9ca3af" />
        <Text style={{ fontSize: 14, color: '#9ca3af' }}>Search assets by tags...</Text>
      </View>
      {/* Active filters */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {['Product', 'Brand'].map((tag, i) => (
          <View key={i} style={{ backgroundColor: '#b38f5b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#ffffff' }}>{tag}</Text>
            <MaterialCommunityIcons name="close" size={14} color="#ffffff" />
          </View>
        ))}
      </View>
      {/* Photo grid showing filtered results with real photos */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          ONBOARDING_PHOTOS.product1,
          ONBOARDING_PHOTOS.product2,
          ONBOARDING_PHOTOS.product3,
          ONBOARDING_PHOTOS.product4,
        ].map((photo, i) => (
          <Image
            key={i}
            source={{ uri: photo }}
            style={{ width: 60, height: 60, borderRadius: 8 }}
            resizeMode="cover"
          />
        ))}
      </View>
    </View>
  </View>
);

const TagManagementVisual = () => (
  <View style={{ marginTop: 24, alignItems: 'center', width: '100%' }}>
    <View style={{ width: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
      {/* Search bar */}
      <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MaterialCommunityIcons name="magnify" size={20} color="#8E8E93" />
        <Text style={{ fontSize: 17, color: '#8E8E93', flex: 1 }}>Search tags...</Text>
      </View>
      
      {/* Tag List Card */}
      <View style={{ backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase' }}>Tag name</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase' }}>AI</Text>
          </View>
        </View>
        
        {/* Tag rows */}
        {[
          { name: 'Product', enabled: true, count: 12 },
          { name: 'Brand', enabled: false, count: 8 },
          { name: 'Campaign', enabled: true, count: 5 },
          { name: 'Marketing', enabled: false, count: 15 },
        ].map((tag, i) => (
          <View key={i}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#ffffff' }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#111827', letterSpacing: -0.2 }}>{tag.name}</Text>
                {tag.count > 0 && (
                  <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '500', color: '#4b5563' }}>{tag.count}</Text>
                  </View>
                )}
              </View>
              {/* Star icon */}
              <MaterialCommunityIcons
                name="star-four-points"
                size={18}
                color={tag.enabled ? '#b38f5b' : '#c4c4c4'}
                style={{ opacity: tag.enabled ? 1 : 0.4 }}
              />
            </View>
            {i < 3 && (
              <View style={{ height: 0.5, backgroundColor: '#f3f4f6', marginLeft: 16 }} />
            )}
          </View>
        ))}
      </View>
      
      {/* Add Tag button in header (matching actual implementation) */}
      <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: '#b38f5b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="plus" size={16} color="#ffffff" />
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff' }}>Add Tag</Text>
        </View>
      </View>
    </View>
  </View>
);

const AutoTaggingVisual = () => (
  <View style={{ marginTop: 24, alignItems: 'center', width: '100%' }}>
    <View style={{ width: 280, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
      {/* Info banner */}
      <View style={{ backgroundColor: 'rgba(179, 143, 91, 0.1)', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 12 }}>✨</Text>
        <Text style={{ fontSize: 12, fontWeight: '500', color: '#b38f5b' }}>3 of 4 tags using AI</Text>
      </View>
      
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase' }}>Tag name</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase' }}>AI</Text>
        </View>
      </View>
      
      {/* Tag list with star icons */}
      <View>
        {[
          { name: 'Product', enabled: true, count: 12 },
          { name: 'Brand', enabled: true, count: 8 },
          { name: 'Campaign', enabled: false, count: 5 },
          { name: 'Marketing', enabled: true, count: 15 },
        ].map((tag, i) => (
          <View key={i}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#ffffff' }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#111827', letterSpacing: -0.2 }}>{tag.name}</Text>
                {tag.count > 0 && (
                  <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '500', color: '#4b5563' }}>{tag.count}</Text>
                  </View>
                )}
              </View>
              {/* Star icon */}
              <MaterialCommunityIcons
                name="star-four-points"
                size={18}
                color={tag.enabled ? '#b38f5b' : '#c4c4c4'}
                style={{ opacity: tag.enabled ? 1 : 0.4 }}
              />
            </View>
            {i < 3 && (
              <View style={{ height: 0.5, backgroundColor: '#f3f4f6', marginLeft: 16 }} />
            )}
          </View>
        ))}
      </View>
      
      {/* Helper text */}
      <View style={{ marginTop: 12, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
        <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 16 }}>
          Tap the star icon to enable AI auto-tagging for each tag
        </Text>
      </View>
    </View>
  </View>
);

const StoriesVisual = () => (
  <View style={{ marginTop: 24, alignItems: 'center', width: '100%' }}>
    <View style={{ width: 280 }}>
      {/* Story card - matches actual implementation */}
      <View style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: 20, 
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 100 }}>
          {/* Thumbnail with real photo */}
          <View style={{ 
            width: 100, 
            height: 100, 
            overflow: 'hidden',
          }}>
            <Image
              source={{ uri: ONBOARDING_PHOTOS.workspace }}
              style={{ width: 100, height: 100 }}
              resizeMode="cover"
            />
          </View>
          
          {/* Story Info */}
          <View style={{ flex: 1, padding: 20, paddingLeft: 16 }}>
            <Text style={{ 
              fontSize: 20, 
              fontWeight: '600', 
              color: '#000000', 
              letterSpacing: -0.4, 
              marginBottom: 6 
            }} numberOfLines={1}>
              Brand Campaign
            </Text>
            <Text style={{ 
              fontSize: 15, 
              fontWeight: '400', 
              color: '#8e8e93', 
              letterSpacing: -0.2 
            }}>
              12 photos
            </Text>
          </View>
          
          {/* Chevron */}
          <View style={{ paddingRight: 20 }}>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#c7c7cc" />
          </View>
        </View>
      </View>
      
      {/* Second story card */}
      <View style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: 20, 
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 100 }}>
          {/* Thumbnail with real photo */}
          <View style={{ 
            width: 100, 
            height: 100, 
            overflow: 'hidden',
          }}>
            <Image
              source={{ uri: ONBOARDING_PHOTOS.product1 }}
              style={{ width: 100, height: 100 }}
              resizeMode="cover"
            />
          </View>
          
          {/* Story Info */}
          <View style={{ flex: 1, padding: 20, paddingLeft: 16 }}>
            <Text style={{ 
              fontSize: 20, 
              fontWeight: '600', 
              color: '#000000', 
              letterSpacing: -0.4, 
              marginBottom: 6 
            }} numberOfLines={1}>
              Product Collection
            </Text>
            <Text style={{ 
              fontSize: 15, 
              fontWeight: '400', 
              color: '#8e8e93', 
              letterSpacing: -0.2 
            }}>
              8 photos
            </Text>
          </View>
          
          {/* Chevron */}
          <View style={{ paddingRight: 20 }}>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#c7c7cc" />
          </View>
        </View>
      </View>
      
      {/* Create button in header (matching actual implementation) */}
      <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: '#b38f5b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="plus" size={16} color="#ffffff" />
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff' }}>Create</Text>
        </View>
      </View>
    </View>
  </View>
);

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to StoryStack',
    description: 'Organize your visual assets into powerful stories. Let\'s start by setting up your tags, then you\'ll import your photos.',
    icon: 'book-open-variant',
    iconColor: '#b38f5b',
  },
  {
    id: 'tag-management',
    title: 'Set Up Your Tags',
    description: 'First, create your tags. Access Tag Management from the bottom navigation bar to create tags that will help organize your photos. Add tags like "Product", "Campaign", "Brand", or any categories that matter to your business.',
    icon: 'tag-multiple-outline',
    iconColor: '#b38f5b',
  },
  {
    id: 'auto-tagging',
    title: 'Enable AI Auto-Tagging',
    description: 'In Tag Management, tap the star icon next to any tag to enable AI auto-tagging. AI will automatically categorize your assets, saving your team valuable time.',
    icon: 'robot',
    iconColor: '#b38f5b',
  },
  {
    id: 'import',
    title: 'Import Your Assets',
    description: 'Tap the "Add" button in the bottom navigation bar to import photos from your library. Select multiple assets at once.',
    icon: 'image-plus',
    iconColor: '#b38f5b',
  },
  {
    id: 'tags',
    title: 'Tag Your Photos',
    description: 'After importing, AI will automatically apply tags you\'ve enabled. Tap any photo to review and update tags, or add custom tags to organize your content.',
    icon: 'tag-multiple',
    iconColor: '#b38f5b',
  },
  {
    id: 'filtering',
    title: 'Filter Your Photos',
    description: 'Use the search bar at the top to filter photos by tags. Tap multiple tags to refine your search and find exactly what you need.',
    icon: 'filter-variant',
    iconColor: '#b38f5b',
  },
  {
    id: 'stories',
    title: 'Create Stories',
    description: 'Select photos and organize them into stories. Build campaign narratives, product collections, and brand stories.',
    icon: 'book-multiple',
    iconColor: '#b38f5b',
  },
  {
    id: 'ready',
    title: "You're All Set!",
    description: 'Tags are the foundation of StoryStack - they help organize and automatically categorize your visual assets. Set up your first tags to start managing your content. You can always access this guide from the menu.',
    icon: 'check-circle',
    iconColor: '#b38f5b',
  },
];

type OnboardingProps = {
  visible: boolean;
  onComplete: () => void;
};

export function Onboarding({ visible, onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: -currentStep * SCREEN_WIDTH,
      tension: 100,
      friction: 26,
      useNativeDriver: true,
    }).start();
  }, [currentStep]);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleComplete();
  };

  const handleComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete();
  };

  if (!visible) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 32) }]}>
          {!isFirstStep && (
            <TouchableOpacity
              onPress={handlePrevious}
              style={styles.backButton}
              activeOpacity={0.6}
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color="#111827" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipButton}
            activeOpacity={0.6}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <Animated.View
            style={[
              styles.stepsContainer,
              {
                transform: [
                  { translateX: slideAnim },
                ],
                width: SCREEN_WIDTH * ONBOARDING_STEPS.length,
              },
            ]}
          >
          {ONBOARDING_STEPS.map((stepItem, index) => (
            <View
              key={stepItem.id}
              style={[
                styles.stepContainer,
                {
                  width: SCREEN_WIDTH,
                  paddingHorizontal: 32,
                },
              ]}
            >
              {/* Icon */}
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: `${stepItem.iconColor}15`,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={stepItem.icon as any}
                  size={52}
                  color={stepItem.iconColor}
                />
              </View>

              {/* Title */}
              <Text style={styles.title}>{stepItem.title}</Text>

              {/* Description */}
              <Text style={styles.description}>{stepItem.description}</Text>

              {/* Visual Demo */}
              {stepItem.id === 'import' && <ImportVisual />}
              {stepItem.id === 'tags' && <TagsVisual />}
              {stepItem.id === 'tag-management' && <TagManagementVisual />}
              {stepItem.id === 'auto-tagging' && <AutoTaggingVisual />}
              {stepItem.id === 'filtering' && <FilteringVisual />}
              {stepItem.id === 'stories' && <StoriesVisual />}
            </View>
          ))}
          </Animated.View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Progress Dots */}
          <View style={styles.dotsContainer}>
            {ONBOARDING_STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentStep && styles.dotActive,
                ]}
              />
            ))}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleNext}
            style={styles.nextButton}
            activeOpacity={0.85}
          >
            <Text style={styles.nextButtonText}>
              {isLastStep ? 'Get Started' : 'Next'}
            </Text>
            {!isLastStep && (
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#ffffff"
                style={{ marginLeft: 4 }}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    minHeight: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stepsContainer: {
    flexDirection: 'row',
    height: '100%',
  },
  stepContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 17,
    lineHeight: 24,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#b38f5b',
  },
  nextButton: {
    backgroundColor: '#b38f5b',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#b38f5b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
});

