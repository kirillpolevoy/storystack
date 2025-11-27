import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
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

// Visual components for each feature
const ImportVisual = () => (
  <View style={{ marginTop: 32, alignItems: 'center', width: '100%' }}>
    <View style={{ position: 'relative', width: 280, height: 200, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
      {/* Photo grid mockup */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ width: 60, height: 60, backgroundColor: '#e5e7eb', borderRadius: 8 }} />
        ))}
      </View>
      {/* Floating Action Button */}
      <View style={{ position: 'absolute', bottom: 16, right: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: '#b38f5b', alignItems: 'center', justifyContent: 'center', shadowColor: '#b38f5b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}>
        <MaterialCommunityIcons name="image-plus" size={28} color="#ffffff" />
      </View>
    </View>
  </View>
);

const TagsVisual = () => (
  <View style={{ marginTop: 32, alignItems: 'center', width: '100%' }}>
    <View style={{ width: 280, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
      {/* Photo mockup */}
      <View style={{ width: '100%', height: 120, backgroundColor: '#e5e7eb', borderRadius: 12, marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="image" size={48} color="#9ca3af" />
      </View>
      {/* Tags */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['Nature', 'Outdoor', 'Summer'].map((tag, i) => (
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
        <Text style={{ fontSize: 14, color: '#9ca3af' }}>Search by tags...</Text>
      </View>
      {/* Active filters */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {['Nature', 'Summer'].map((tag, i) => (
          <View key={i} style={{ backgroundColor: '#b38f5b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#ffffff' }}>{tag}</Text>
            <MaterialCommunityIcons name="close" size={14} color="#ffffff" />
          </View>
        ))}
      </View>
      {/* Photo grid showing filtered results */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ width: 60, height: 60, backgroundColor: '#e5e7eb', borderRadius: 8 }} />
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
          { name: 'Nature', enabled: true, count: 12 },
          { name: 'Outdoor', enabled: false, count: 8 },
          { name: 'Summer', enabled: true, count: 5 },
          { name: 'Product', enabled: false, count: 15 },
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
      
      {/* Floating Action Button */}
      <View style={{ position: 'absolute', bottom: -28, right: 0, width: 64, height: 64, borderRadius: 32, backgroundColor: '#D4A574', alignItems: 'center', justifyContent: 'center', shadowColor: '#D4A574', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 12 }}>
        <MaterialCommunityIcons name="plus" size={32} color="#ffffff" />
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
          { name: 'Nature', enabled: true, count: 12 },
          { name: 'Outdoor', enabled: true, count: 8 },
          { name: 'Summer', enabled: false, count: 5 },
          { name: 'Product', enabled: true, count: 15 },
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
          {/* Thumbnail */}
          <View style={{ 
            width: 100, 
            height: 100, 
            backgroundColor: '#f5f5f7', 
            alignItems: 'center', 
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <MaterialCommunityIcons name="image-outline" size={36} color="#c7c7cc" />
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
              My Summer Trip
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
          {/* Thumbnail with image */}
          <View style={{ 
            width: 100, 
            height: 100, 
            backgroundColor: '#e5e7eb', 
            overflow: 'hidden',
          }} />
          
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
      
      {/* Floating Action Button */}
      <View style={{ 
        position: 'absolute', 
        bottom: -28, 
        right: 0, 
        width: 64, 
        height: 64, 
        borderRadius: 32, 
        backgroundColor: '#D4A574', 
        alignItems: 'center', 
        justifyContent: 'center', 
        shadowColor: '#D4A574', 
        shadowOffset: { width: 0, height: 10 }, 
        shadowOpacity: 0.6, 
        shadowRadius: 20, 
        elevation: 12 
      }}>
        <MaterialCommunityIcons name="plus" size={32} color="#ffffff" />
      </View>
    </View>
  </View>
);

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to StoryStack',
    description: 'Organize your photos into beautiful stories. Import, tag, and create collections effortlessly.',
    icon: 'book-open-variant',
    iconColor: '#b38f5b',
  },
  {
    id: 'import',
    title: 'Import Your Photos',
    description: 'Tap the floating button or use the "Import Photos" button to add photos from your library. Select multiple photos at once.',
    icon: 'image-plus',
    iconColor: '#b38f5b',
  },
  {
    id: 'tags',
    title: 'Tag Your Photos',
    description: 'Tap any photo to add tags. Use AI-powered auto-tagging or create custom tags. Organize your library with meaningful labels.',
    icon: 'tag-multiple',
    iconColor: '#b38f5b',
  },
  {
    id: 'tag-management',
    title: 'Manage Tags',
    description: 'Access Tag Management from the menu to view all your tags, see how many photos use each tag, rename tags, and create new ones. Keep your tag library organized.',
    icon: 'tag-multiple-outline',
    iconColor: '#b38f5b',
  },
  {
    id: 'auto-tagging',
    title: 'AI Auto-Tagging',
    description: 'In Tag Management, tap the star icon next to any tag to enable AI auto-tagging. When enabled, AI will automatically suggest these tags for new photos you import, saving you time.',
    icon: 'robot',
    iconColor: '#b38f5b',
  },
  {
    id: 'filtering',
    title: 'Filter Your Photos',
    description: 'Use the search bar at the top to filter photos by tags. Tap multiple tags to find photos that match all selected tags. Clear filters anytime.',
    icon: 'filter-variant',
    iconColor: '#b38f5b',
  },
  {
    id: 'stories',
    title: 'Create Stories',
    description: 'Select photos and add them to stories. Organize your photos into collections. Build beautiful narratives from your library.',
    icon: 'book-multiple',
    iconColor: '#b38f5b',
  },
  {
    id: 'ready',
    title: "You're All Set!",
    description: 'Start importing photos and building your first story. You can always access this guide from the menu.',
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

