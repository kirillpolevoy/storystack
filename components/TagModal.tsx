import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Modal, Text, TextInput, TouchableOpacity, View, Animated, Easing, ActionSheetIOS, Platform, ActivityIndicator, KeyboardAvoidingView, Dimensions } from 'react-native';
import { GestureDetector, Gesture, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Asset, TagVocabulary } from '@/types';
import { queueAutoTag } from '@/utils/autoTagQueue';
import { supabase } from '@/lib/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// Apple-style gesture thresholds - more forgiving and natural
const SWIPE_THRESHOLD = 30; // Lowered from 50 - easier to trigger
const SWIPE_VELOCITY_THRESHOLD = 400; // Lowered from 500 - more responsive
const DIRECTION_LOCK_THRESHOLD = 8; // Lowered from 10/15 - faster direction detection
const VERTICAL_RATIO_THRESHOLD = 0.6; // Lowered from 0.7 - allows more diagonal movement

const PANEL_HEIGHT = SCREEN_HEIGHT * 0.75; // Panel takes 75% of screen when open
const PANEL_REVEAL_THRESHOLD = 0.25; // 25% of panel height to reveal (was 0.2)
const PANEL_VELOCITY_THRESHOLD = 400; // Consistent with horizontal swipe

type TagModalProps = {
  asset: Asset | null;
  visible: boolean;
  onClose: () => void;
  onUpdateTags: (newTags: TagVocabulary[], location?: string | null) => Promise<void>;
  allAvailableTags?: TagVocabulary[];
  multipleAssets?: Asset[];
  onDelete?: (asset: Asset) => void;
  onAutoTagSuccess?: (assetId: string) => void;
  allAssets?: Asset[];
  onAssetChange?: (asset: Asset) => void;
  autoTaggingAssets?: Set<string>; // Track which assets are currently being tagged
};

export function TagModal({ asset, visible, onClose, onUpdateTags, allAvailableTags = [], multipleAssets = [], onDelete, onAutoTagSuccess, allAssets = [], onAssetChange, autoTaggingAssets = new Set() }: TagModalProps) {
  console.log('[TagModal] Component rendering - visible:', visible, 'asset:', asset?.id);
  console.log('[TagModal] Props - allAssets.length:', allAssets.length, 'allAssets IDs:', allAssets.map(a => a.id));
  console.log('[TagModal] Props - onAssetChange:', typeof onAssetChange, 'exists:', !!onAssetChange);
  
  const [localTags, setLocalTags] = useState<TagVocabulary[]>([]);
  const [savedTags, setSavedTags] = useState<TagVocabulary[]>([]); // Track saved tags to display at bottom
  const [location, setLocation] = useState<string>(''); // Location is stored in separate column
  const [newTag, setNewTag] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isRetryingAutoTag, setIsRetryingAutoTag] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const locationInputRef = useRef<TextInput>(null);
  const inputRef = useRef<TextInput>(null);
  
  // Tag indicator animations - Apple-grade smooth
  const tagIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const tagIndicatorScale = useRef(new Animated.Value(0.9)).current;
  
  // Panel state - starts hidden, slides up when swiping down
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const panelInitialValue = PANEL_HEIGHT;
  const panelTranslateY = useRef(new Animated.Value(panelInitialValue)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  
  // Photo navigation animations - Apple-grade fast transitions
  const photoTranslateX = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current; // Overlay (next/prev photo) opacity
  const currentPhotoOpacity = useRef(new Animated.Value(1)).current; // Current photo opacity - direct control, no multiplication
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const swipeDirectionRef = useRef<'left' | 'right' | null>(null);
  const isSwipingRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const [shouldHideCurrentPhoto, setShouldHideCurrentPhoto] = useState(false); // Track when to completely hide current photo
  const gestureDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);
  const isMountedRef = useRef(true);
  const activeAnimationsRef = useRef<Animated.CompositeAnimation[]>([]);
  
  const prevAssetIdRef = useRef<string | undefined>(undefined);
  const isDismissingRef = useRef(false);
  
  // Refs to store latest values for use in gesture handlers
  const localTagsRef = useRef<TagVocabulary[]>([]);
  const locationRef = useRef<string>('');
  const assetRef = useRef<Asset | null>(null);
  // Track saved locations per asset ID to preserve them during navigation
  const savedLocationsRef = useRef<Map<string, string>>(new Map());
  
  // Keep refs updated
  useEffect(() => {
    localTagsRef.current = localTags;
    locationRef.current = location;
    assetRef.current = asset;
  }, [localTags, location, asset]);
  
  const assetId = asset?.id;
  const isMultiEdit = (multipleAssets?.length ?? 0) > 1;
  
  // Find current asset index and get adjacent assets
  const currentAssetIndex = useMemo(() => {
    if (!asset || allAssets.length === 0) return -1;
    return allAssets.findIndex(a => a.id === asset.id);
  }, [asset, allAssets]);
  
  const canSwipeLeft = currentAssetIndex > 0;
  const canSwipeRight = currentAssetIndex >= 0 && currentAssetIndex < allAssets.length - 1;
  const nextAsset = canSwipeRight ? allAssets[currentAssetIndex + 1] : null;
  const prevAsset = canSwipeLeft ? allAssets[currentAssetIndex - 1] : null;
  
  // Store current asset info in refs to avoid stale closures
  const currentAssetInfoRef = useRef({ canSwipeLeft, canSwipeRight, prevAsset, nextAsset, onAssetChange });
  
  // Keep refs updated
  useEffect(() => {
    currentAssetInfoRef.current = { canSwipeLeft, canSwipeRight, prevAsset, nextAsset, onAssetChange };
  }, [canSwipeLeft, canSwipeRight, prevAsset, nextAsset, onAssetChange]);
  
  // Wrapper functions - use refs to store latest versions for gesture handlers
  const updateSwipeDirectionRef = useRef((direction: 'left' | 'right' | null) => {
    console.log('[TagModal] updateSwipeDirectionRef called with:', direction, 'isMounted:', isMountedRef.current);
    if (swipeDirectionRef.current !== direction && isMountedRef.current) {
      swipeDirectionRef.current = direction;
      try {
        setSwipeDirection(direction);
        console.log('[TagModal] setSwipeDirection called successfully');
      } catch (e) {
        console.error('[TagModal] Error in setSwipeDirection:', e);
        throw e;
      }
    }
  });
  
  const handleAssetChangeSafeRef = useRef((targetAsset: Asset) => {
    console.log('[TagModal] handleAssetChangeSafeRef called with asset:', targetAsset?.id, 'isMounted:', isMountedRef.current, 'hasCallback:', !!onAssetChange);
    if (isMountedRef.current && onAssetChange) {
      try {
        console.log('[TagModal] Calling onAssetChange');
        onAssetChange(targetAsset);
        console.log('[TagModal] onAssetChange called successfully');
      } catch (e) {
        console.error('[TagModal] Error in onAssetChange:', e);
        throw e;
      }
    } else {
      console.log('[TagModal] Skipping onAssetChange - isMounted:', isMountedRef.current, 'hasCallback:', !!onAssetChange);
    }
  });
  
  const setPanelVisibleRef = useRef((visible: boolean) => {
    if (isMountedRef.current) {
      setIsPanelVisible(visible);
    }
  });
  
  const triggerHapticRef = useRef((style: Haptics.ImpactFeedbackStyle) => {
    try {
      Haptics.impactAsync(style);
    } catch (e) {
      // Ignore haptic errors
    }
  });
  
  // Update refs when callbacks change
  useEffect(() => {
    handleAssetChangeSafeRef.current = (targetAsset: Asset) => {
      if (isMountedRef.current && onAssetChange) {
        onAssetChange(targetAsset);
      }
    };
  }, [onAssetChange]);
  
  // Cleanup animations on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Stop all active animations
      activeAnimationsRef.current.forEach(anim => {
        try {
          anim.stop();
        } catch (e) {
          // Ignore errors when stopping animations
        }
      });
      activeAnimationsRef.current = [];
    };
  }, []);

  // Auto-save location when keyboard is dismissed
  useEffect(() => {
    if (!visible) return;

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      // Auto-save if there are unsaved changes (location or tags)
      // This handles cases where keyboard is dismissed programmatically
      if (checkHasUnsavedChanges()) {
        handleSaveSilent();
      }
    });

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [visible]);
  
  // Reset animations when asset changes - simplified Apple-grade logic
  useEffect(() => {
    if (asset) {
      const newAssetId = asset.id;
      const isTransitioning = isTransitioningRef.current;
      
      // Only reset if asset actually changed
      if (prevAssetIdRef.current !== newAssetId) {
        prevAssetIdRef.current = newAssetId;
        
        // Don't interfere with ongoing transitions
        if (!isTransitioning) {
          // Stop any running animations
          activeAnimationsRef.current.forEach(anim => anim.stop());
          activeAnimationsRef.current = [];
          
          // Reset all animation values
          photoTranslateX.setValue(0);
          overlayOpacity.setValue(0);
          currentPhotoOpacity.setValue(1);
          swipeDirectionRef.current = null;
          setSwipeDirection(null);
          gestureDirectionRef.current = null;
          isSwipingRef.current = false;
        } else {
          // During transition: asset changed, overlay is showing new photo
          // Reset translate but keep opacity states as-is (transition callback will handle)
          photoTranslateX.setValue(0);
          swipeDirectionRef.current = null;
          setSwipeDirection(null);
        }
      }
    }
  }, [asset?.id]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      // Stop all animations
      activeAnimationsRef.current.forEach(anim => anim.stop());
      activeAnimationsRef.current = [];
      
      isSwipingRef.current = false;
      isTransitioningRef.current = false;
      swipeDirectionRef.current = null;
      setSwipeDirection(null);
      photoTranslateX.setValue(0);
      overlayOpacity.setValue(0);
      currentPhotoOpacity.setValue(1);
      setShouldHideCurrentPhoto(false);
      Keyboard.dismiss(); // Dismiss keyboard when modal closes
      setIsPanelVisible(false);
      panelTranslateY.setValue(panelInitialValue);
      panelOpacity.setValue(0);
      backdropOpacity.setValue(0);
    } else if (visible && isMultiEdit) {
      // In multi-edit mode, open panel automatically
      setIsPanelVisible(true);
      panelTranslateY.setValue(0);
      panelOpacity.setValue(1);
      backdropOpacity.setValue(0);
    }
  }, [visible, isMultiEdit]);
  
  // Animate photo fade in when modal opens - Apple-grade fast
  useEffect(() => {
    if (visible && asset) {
      currentPhotoOpacity.setValue(0);
      Animated.timing(currentPhotoOpacity, {
        toValue: 1,
        duration: 200, // Faster, more responsive
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      
      // Animate tag indicator in - Apple-grade delayed entrance
      tagIndicatorOpacity.setValue(0);
      tagIndicatorScale.setValue(0.9);
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(tagIndicatorOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(tagIndicatorScale, {
            toValue: 1,
            tension: 100,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start();
      }, 300); // Slight delay for polish
    } else {
      // Fade out when closing
      tagIndicatorOpacity.setValue(0);
      tagIndicatorScale.setValue(0.9);
    }
  }, [visible]);
  
  // Update tag indicator when tags change
  useEffect(() => {
    if (visible && asset && !isPanelVisible) {
      // Pulse animation when tags change
      Animated.sequence([
        Animated.timing(tagIndicatorScale, {
          toValue: 1.05,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(tagIndicatorScale, {
          toValue: 1,
          tension: 200,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [asset?.tags, visible, isPanelVisible]);
  
  // Ensure panel is fully opaque when visible
  useEffect(() => {
    if (isPanelVisible) {
      // Ensure panel opacity is at 1.0 when visible
      panelOpacity.setValue(1);
    }
  }, [isPanelVisible]);
  
  // Helper function to check if there are unsaved changes (using refs for gesture handler access)
  const checkHasUnsavedChanges = (): boolean => {
    const currentAsset = assetRef.current;
    if (!currentAsset || isMultiEdit) return false;
    const currentTags = localTagsRef.current;
    const currentLocation = locationRef.current;
    
    const currentTagsStr = JSON.stringify((currentAsset.tags ?? []).sort());
    const localTagsStr = JSON.stringify(currentTags.sort());
    const tagsChanged = currentTagsStr !== localTagsStr;
    const assetLocation = currentAsset.location || null;
    const locationChanged = currentLocation.trim() !== (assetLocation || '');
    return tagsChanged || locationChanged;
  };

  // Helper function to save without closing (for auto-save on swipe)
  const handleSaveSilent = async (): Promise<void> => {
    const currentAsset = assetRef.current;
    if (!currentAsset || isMultiEdit) return;
    
    const finalTags: TagVocabulary[] = [...localTagsRef.current];
    const locationValue = locationRef.current.trim() || null;
    
    // Save the tags we're about to save - use this for bottom display
    setSavedTags(localTagsRef.current);
    
    // Store saved location in ref for this asset ID
    if (locationValue) {
      savedLocationsRef.current.set(currentAsset.id, locationValue);
    } else {
      savedLocationsRef.current.delete(currentAsset.id);
    }
    
    // Optimistically update asset prop immediately so bottom display shows new tags
    if (currentAsset && onAssetChange) {
      onAssetChange({ ...currentAsset, tags: finalTags, location: locationValue });
    }
    
    // Save to database - await to ensure it completes before navigation
    try {
      await onUpdateTags(finalTags, locationValue);
      console.log('[TagModal] Successfully auto-saved tags/location on swipe');
    } catch (error) {
      console.error('[TagModal] Failed to auto-save tags/location on swipe:', error);
      // Revert optimistic update on error
      if (currentAsset && onAssetChange) {
        onAssetChange({ ...currentAsset, tags: currentAsset.tags ?? [], location: currentAsset.location || null });
        setLocation(currentAsset.location || '');
      }
      setSavedTags(currentAsset?.tags ?? []);
      // Remove from saved locations on error
      savedLocationsRef.current.delete(currentAsset.id);
    }
  };
  
  // Single pan gesture that handles both horizontal and vertical swipes
  // TEMPORARILY SIMPLIFIED TO DEBUG CRASHES
  const panGesture = useMemo(() => {
    console.log('[TagModal] ===== CREATING PAN GESTURE =====');
    console.log('[TagModal] isInputFocused:', isInputFocused);
    console.log('[TagModal] isMultiEdit:', isMultiEdit);
    
    // If input is focused or multi-edit, disable gesture entirely
    if (isInputFocused || isMultiEdit) {
      console.log('[TagModal] Gesture disabled - returning null');
      return null;
    }
    
    try {
      console.log('[TagModal] Creating Gesture.Pan()...');
      const gesture = Gesture.Pan();
      console.log('[TagModal] Gesture.Pan() created successfully');
      
      console.log('[TagModal] Setting enabled...');
      gesture.enabled(true);
      console.log('[TagModal] Enabled set');
      
      console.log('[TagModal] Attaching onStart handler...');
      gesture.onStart(() => {
        console.log('[TagModal] GESTURE START CALLED');
        try {
          Keyboard.dismiss();
          gestureDirectionRef.current = null;
        } catch (e) {
          console.error('[TagModal] Error in onStart:', e);
        }
      });
      console.log('[TagModal] onStart attached');
      
      return gesture
      .onUpdate((event) => {
        try {
          if (!isMountedRef.current) {
            return;
          }
          
          const { translationX, translationY } = event;
          
          // Apple-style direction detection: faster, more forgiving, allows correction
          // Lock direction early but allow slight corrections for natural feel
          if (gestureDirectionRef.current === null) {
            const absX = Math.abs(translationX);
            const absY = Math.abs(translationY);
            
            // Faster direction lock with lower thresholds for more responsive feel
            if (absY > DIRECTION_LOCK_THRESHOLD && absY > absX * VERTICAL_RATIO_THRESHOLD) {
              gestureDirectionRef.current = 'vertical';
            } else if (absX > DIRECTION_LOCK_THRESHOLD && absX > absY * (1 / VERTICAL_RATIO_THRESHOLD)) {
              gestureDirectionRef.current = 'horizontal';
              isSwipingRef.current = true;
            }
          } else {
            // Allow direction correction if user significantly changes gesture
            // This prevents accidental direction locks
            const absX = Math.abs(translationX);
            const absY = Math.abs(translationY);
            
            if (gestureDirectionRef.current === 'horizontal' && absY > absX * 1.5 && absY > 20) {
              // User switched to vertical - allow correction
              gestureDirectionRef.current = 'vertical';
              isSwipingRef.current = false;
            } else if (gestureDirectionRef.current === 'vertical' && absX > absY * 1.5 && absX > 20) {
              // User switched to horizontal - allow correction
              gestureDirectionRef.current = 'horizontal';
              isSwipingRef.current = true;
            }
          }
          
          // Handle horizontal swipe (photo navigation) - Apple-style smooth preview
          if (gestureDirectionRef.current === 'horizontal' && !isPanelVisible && allAssets.length > 1) {
            const { canSwipeLeft: canLeft, canSwipeRight: canRight, prevAsset: prev, nextAsset: next } = currentAssetInfoRef.current;
            
            if (translationX > 0 && canLeft && prev) {
              // Swiping right to show previous photo
              if (swipeDirectionRef.current !== 'right') {
                swipeDirectionRef.current = 'right';
                updateSwipeDirectionRef.current('right');
                // Cancel any pending animations from previous swipe
                activeAnimationsRef.current.forEach(anim => anim.stop());
                activeAnimationsRef.current = [];
                // Reset transition state
                isTransitioningRef.current = false;
                // Ensure current photo is visible at start of swipe
                setShouldHideCurrentPhoto(false);
                currentPhotoOpacity.setValue(1);
                overlayOpacity.setValue(0);
                // Light haptic when starting swipe
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch (e) {
                  // Ignore haptic errors
                }
              }
              // Apple-grade smooth opacity curve
              const progress = Math.min(translationX / SCREEN_WIDTH, 1);
              const opacity = progress * progress; // Quadratic easing
              photoTranslateX.setValue(translationX);
              overlayOpacity.setValue(opacity);
              // CRITICAL: Hide current photo IMMEDIATELY when overlay appears
              // Use Math.max to ensure it's never visible when overlay is visible
              currentPhotoOpacity.setValue(Math.max(0, 1 - opacity * 1.1)); // Slightly faster fade to ensure complete hide
            } else if (translationX < 0 && canRight && next) {
              // Swiping left to show next photo
              if (swipeDirectionRef.current !== 'left') {
                swipeDirectionRef.current = 'left';
                updateSwipeDirectionRef.current('left');
                // Cancel any pending animations from previous swipe
                activeAnimationsRef.current.forEach(anim => anim.stop());
                activeAnimationsRef.current = [];
                // Reset transition state
                isTransitioningRef.current = false;
                // Ensure current photo is visible at start of swipe
                setShouldHideCurrentPhoto(false);
                currentPhotoOpacity.setValue(1);
                overlayOpacity.setValue(0);
                // Light haptic when starting swipe
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch (e) {
                  // Ignore haptic errors
                }
              }
              const progress = Math.min(Math.abs(translationX) / SCREEN_WIDTH, 1);
              const opacity = progress * progress; // Quadratic easing
              photoTranslateX.setValue(translationX);
              overlayOpacity.setValue(opacity);
              // CRITICAL: Hide current photo IMMEDIATELY when overlay appears
              // Use Math.max to ensure it's never visible when overlay is visible
              currentPhotoOpacity.setValue(Math.max(0, 1 - opacity * 1.1)); // Slightly faster fade to ensure complete hide
            } else {
              // Can't swipe in this direction - provide visual resistance
              const resistance = 0.3; // Reduce movement when at boundary
              photoTranslateX.setValue(translationX * resistance);
              overlayOpacity.setValue(0);
              currentPhotoOpacity.setValue(1);
            }
          }
          
          // Handle vertical swipe (panel reveal) - Apple-style smooth drag
          if (gestureDirectionRef.current === 'vertical') {
            if (translationY < 0 && !isPanelVisible) {
              // Swiping UP - reveal panel with natural easing
              const absY = Math.abs(translationY);
              const clampedY = Math.min(absY, PANEL_HEIGHT);
              // Use cubic easing for smoother feel during drag
              const progress = clampedY / PANEL_HEIGHT;
              const easedProgress = progress * (2 - progress); // Ease-out curve
              
              // Panel starts at PANEL_HEIGHT (off-screen below), moves to 0 (fully visible)
              // translationY is negative when swiping up, so we subtract absY from PANEL_HEIGHT
              panelTranslateY.setValue(PANEL_HEIGHT - clampedY);
              panelOpacity.setValue(easedProgress);
              backdropOpacity.setValue(easedProgress); // Full opacity to cover image
            } else if (translationY > 0 && isPanelVisible) {
              // Swiping DOWN - hide panel with natural easing
              const clampedY = Math.min(translationY, PANEL_HEIGHT);
              const progress = clampedY / PANEL_HEIGHT;
              const easedProgress = 1 - (progress * (2 - progress)); // Ease-in curve
              
              // Panel starts at 0 (fully visible), moves to PANEL_HEIGHT (off-screen)
              panelTranslateY.setValue(clampedY);
              panelOpacity.setValue(Math.max(easedProgress, 0));
              backdropOpacity.setValue(Math.max(easedProgress, 0)); // Full opacity
            }
          }
        } catch (error) {
          console.error('[TagModal] Error in gesture update:', error);
          console.error('[TagModal] Error stack:', error instanceof Error ? error.stack : 'No stack');
          console.error('[TagModal] Error name:', error instanceof Error ? error.name : typeof error);
        }
      })
      .onEnd((event) => {
        try {
          console.log('[TagModal] Gesture END (sync) - isMounted:', isMountedRef.current);
          
          if (!isMountedRef.current) {
            console.log('[TagModal] Gesture END - component unmounted, aborting');
            return;
          }
          
          const { translationX, translationY, velocityX, velocityY } = event;
          console.log('[TagModal] Gesture END - translationX:', translationX, 'translationY:', translationY);
          console.log('[TagModal] Gesture END - velocityX:', velocityX, 'velocityY:', velocityY);
          console.log('[TagModal] Gesture END - gestureDirection:', gestureDirectionRef.current);
          console.log('[TagModal] Gesture END - isPanelVisible:', isPanelVisible);
          console.log('[TagModal] Gesture END - allAssets.length:', allAssets.length);
          console.log('[TagModal] Gesture END - allAssets:', allAssets);
          console.log('[TagModal] Gesture END - currentAssetInfoRef:', JSON.stringify(currentAssetInfoRef.current, null, 2));
          
          // Handle horizontal swipe end
          const isHorizontal = gestureDirectionRef.current === 'horizontal';
          const isPanelHidden = !isPanelVisible;
          const hasMultipleAssets = allAssets.length > 1;
          
          console.log('[TagModal] Swipe conditions - isHorizontal:', isHorizontal, 'isPanelHidden:', isPanelHidden, 'hasMultipleAssets:', hasMultipleAssets);
          
          if (isHorizontal && isPanelHidden && hasMultipleAssets) {
            console.log('[TagModal] ✓ All conditions met, processing horizontal swipe');
            const shouldSwipe = Math.abs(translationX) > SWIPE_THRESHOLD || Math.abs(velocityX) > 500;
            const { canSwipeLeft: canLeft, canSwipeRight: canRight, prevAsset: prev, nextAsset: next, onAssetChange: onChange } = currentAssetInfoRef.current;
            
            if (translationX > 0 && shouldSwipe && canLeft && prev && onChange) {
              // Cancel any pending animations
              activeAnimationsRef.current.forEach(anim => anim.stop());
              activeAnimationsRef.current = [];
              
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {
                // Ignore haptic errors
              }
              
              const targetAsset = prev;
              const callback = onChange;
              
              // Auto-save location and tags before navigating (if there are unsaved changes)
              // We need to await this to ensure the save completes before changing assets
              const performSwipe = async () => {
                // Save current asset's location/tags before navigating
                let savedLocation: string | null = null;
                let savedTags: TagVocabulary[] = [];
                if (checkHasUnsavedChanges()) {
                  const currentAsset = assetRef.current;
                  savedLocation = locationRef.current.trim() || null;
                  savedTags = [...localTagsRef.current];
                  await handleSaveSilent();
                  // After save, the parent's assets array should be updated
                  // But we need to wait a tick for React to process the state update
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                // Apple-grade fast transition: 180ms (premium feel)
                // CRITICAL: COMPLETELY HIDE current photo IMMEDIATELY
                setShouldHideCurrentPhoto(true); // Remove from render tree completely
                currentPhotoOpacity.setValue(0); // INSTANT hide - no animation delay
                
                const anim = Animated.parallel([
                  Animated.spring(photoTranslateX, {
                    toValue: SCREEN_WIDTH,
                    tension: 100, // Snappier for premium feel
                    friction: 8,
                    useNativeDriver: true,
                  }),
                  Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 180, // Fast, Apple-grade timing
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                  }),
                ]);
                
                activeAnimationsRef.current.push(anim);
                
                anim.start((finished) => {
                  activeAnimationsRef.current = activeAnimationsRef.current.filter(a => a !== anim);
                  
                  if (!isMountedRef.current || !finished) return;
                  
                  // Reset translate - overlay is showing new photo
                  photoTranslateX.setValue(0);
                  updateSwipeDirectionRef.current(null);
                  
                  // Change asset immediately - no delay
                  if (isMountedRef.current && callback !== undefined && targetAsset) {
                    isTransitioningRef.current = true;
                    handleAssetChangeSafeRef.current(targetAsset);
                  
                  // Immediate transition: fade out overlay, fade in new photo
                  // No setTimeout delay - Apple-grade instant transitions
                  Animated.parallel([
                    Animated.timing(overlayOpacity, {
                      toValue: 0,
                      duration: 180,
                      easing: Easing.out(Easing.ease),
                      useNativeDriver: true,
                    }),
                    Animated.timing(currentPhotoOpacity, {
                      toValue: 1,
                      duration: 180,
                      easing: Easing.out(Easing.ease),
                      useNativeDriver: true,
                    }),
                  ]).start(() => {
                    if (isMountedRef.current) {
                      setShouldHideCurrentPhoto(false); // Show new photo
                      isSwipingRef.current = false;
                      isTransitioningRef.current = false;
                    }
                  });
                  } else {
                    // Reset if no callback
                    overlayOpacity.setValue(0);
                    currentPhotoOpacity.setValue(1);
                    setShouldHideCurrentPhoto(false);
                    isSwipingRef.current = false;
                    isTransitioningRef.current = false;
                  }
                });
              };
              
              // Execute the swipe (with save if needed)
              performSwipe();
            } else if (translationX < 0 && shouldSwipe && canRight && next && onChange) {
              // Cancel any pending animations
              activeAnimationsRef.current.forEach(anim => anim.stop());
              activeAnimationsRef.current = [];
              
              try {
                triggerHapticRef.current(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {
                // Ignore haptic errors
              }
              
              const targetAsset = next;
              const callback = onChange;
              
              // Auto-save location and tags before navigating (if there are unsaved changes)
              // We need to await this to ensure the save completes before changing assets
              const performSwipe = async () => {
                // Save current asset's location/tags before navigating
                let savedLocation: string | null = null;
                let savedTags: TagVocabulary[] = [];
                if (checkHasUnsavedChanges()) {
                  const currentAsset = assetRef.current;
                  savedLocation = locationRef.current.trim() || null;
                  savedTags = [...localTagsRef.current];
                  await handleSaveSilent();
                  // After save, the parent's assets array should be updated
                  // But we need to wait a tick for React to process the state update
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                // Apple-grade fast transition: 180ms (premium feel)
                // CRITICAL: COMPLETELY HIDE current photo IMMEDIATELY
                setShouldHideCurrentPhoto(true); // Remove from render tree completely
                currentPhotoOpacity.setValue(0); // INSTANT hide - no animation delay
                
                const anim = Animated.parallel([
                  Animated.spring(photoTranslateX, {
                    toValue: -SCREEN_WIDTH,
                    tension: 100, // Snappier for premium feel
                    friction: 8,
                    useNativeDriver: true,
                  }),
                  Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 180, // Fast, Apple-grade timing
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                  }),
                ]);
                
                activeAnimationsRef.current.push(anim);
                
                anim.start((finished) => {
                  activeAnimationsRef.current = activeAnimationsRef.current.filter(a => a !== anim);
                  
                  if (!isMountedRef.current || !finished) return;
                  
                  // Reset translate - overlay is showing new photo
                  photoTranslateX.setValue(0);
                  updateSwipeDirectionRef.current(null);
                  
                  // Change asset immediately - no delay
                  if (isMountedRef.current && callback !== undefined && targetAsset) {
                    isTransitioningRef.current = true;
                    handleAssetChangeSafeRef.current(targetAsset);
                  
                  // Immediate transition: fade out overlay, fade in new photo
                  // No setTimeout delay - Apple-grade instant transitions
                  Animated.parallel([
                    Animated.timing(overlayOpacity, {
                      toValue: 0,
                      duration: 180,
                      easing: Easing.out(Easing.ease),
                      useNativeDriver: true,
                    }),
                    Animated.timing(currentPhotoOpacity, {
                      toValue: 1,
                      duration: 180,
                      easing: Easing.out(Easing.ease),
                      useNativeDriver: true,
                    }),
                  ]).start(() => {
                    if (isMountedRef.current) {
                      setShouldHideCurrentPhoto(false); // Show new photo
                      isSwipingRef.current = false;
                      isTransitioningRef.current = false;
                    }
                  });
                } else {
                  // Reset if no callback
                  overlayOpacity.setValue(0);
                  currentPhotoOpacity.setValue(1);
                  setShouldHideCurrentPhoto(false);
                  isSwipingRef.current = false;
                  isTransitioningRef.current = false;
                }
              });
            };
            
            // Execute the swipe (with save if needed)
            performSwipe();
          } else {
            // Apple-grade snappy bounce-back when swipe doesn't complete
            setShouldHideCurrentPhoto(false); // Ensure current photo is visible
              const anim = Animated.parallel([
                Animated.spring(photoTranslateX, {
                  toValue: 0,
                  tension: 120, // Snappier return
                  friction: 7,
                  useNativeDriver: true,
                }),
                Animated.spring(overlayOpacity, {
                  toValue: 0,
                  tension: 120,
                  friction: 7,
                  useNativeDriver: true,
                }),
                Animated.spring(currentPhotoOpacity, {
                  toValue: 1,
                  tension: 120,
                  friction: 7,
                  useNativeDriver: true,
                }),
              ]);
              
              activeAnimationsRef.current.push(anim);
              anim.start((finished) => {
                activeAnimationsRef.current = activeAnimationsRef.current.filter(a => a !== anim);
                if (isMountedRef.current) {
                  isSwipingRef.current = false;
                  updateSwipeDirectionRef.current(null);
                }
              });
            }
          }
          
          // Handle vertical swipe end (only on mobile, not on large screens)
          console.log('[TagModal] Checking vertical swipe end - gestureDirection:', gestureDirectionRef.current, 'isMounted:', isMountedRef.current, 'translationY:', translationY);
          
          if (gestureDirectionRef.current === 'vertical' && isMountedRef.current) {
            const absY = Math.abs(translationY);
            const revealThreshold = PANEL_HEIGHT * PANEL_REVEAL_THRESHOLD;
            const absVelocityY = Math.abs(velocityY);
            const isSwipingUp = translationY < 0; // Negative Y means swiping UP
            
            // Apple-style reveal: consider both distance and velocity for natural feel
            // For swipe UP to reveal, check if swiping up with enough distance/velocity
            const shouldReveal = isSwipingUp && (absY > revealThreshold || absVelocityY > PANEL_VELOCITY_THRESHOLD);
            const shouldHide = !isSwipingUp && isPanelVisible && (absY > revealThreshold || absVelocityY > PANEL_VELOCITY_THRESHOLD);
            
            console.log('[TagModal] Vertical swipe end - translationY:', translationY, 'isSwipingUp:', isSwipingUp);
            console.log('[TagModal] Threshold:', revealThreshold, 'absY:', absY, 'velocityY:', velocityY, 'absVelocityY:', absVelocityY);
            console.log('[TagModal] shouldReveal:', shouldReveal, 'shouldHide:', shouldHide, 'isPanelVisible:', isPanelVisible);
            
            if (shouldReveal && !isPanelVisible) {
              console.log('[TagModal] ✓ Revealing panel');
              
              try {
                setPanelVisibleRef.current(true);
                triggerHapticRef.current(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {
                console.error('[TagModal] Error revealing panel:', e);
              }
              // Apple-style panel reveal - smooth spring with natural timing
              // Use timing instead of spring to ensure it reaches 0 exactly
              Animated.parallel([
                Animated.timing(panelTranslateY, {
                  toValue: 0, // Fully open - panel at top of visible area
                  duration: 350,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.timing(panelOpacity, {
                  toValue: 1,
                  duration: 320,
                  easing: Easing.out(Easing.cubic), // Cubic for smoother fade
                  useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                  toValue: 1,
                  duration: 320,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.timing(tagIndicatorOpacity, {
                  toValue: 0,
                  duration: 200,
                  easing: Easing.in(Easing.ease),
                  useNativeDriver: true,
                }),
              ]).start((finished) => {
                // Ensure panel is fully open after animation completes
                if (finished && isMountedRef.current) {
                  panelTranslateY.setValue(0);
                  backdropOpacity.setValue(1); // Ensure backdrop is fully opaque
                }
              });
            } else if (shouldHide && isPanelVisible) {
              // Hide panel when swiping down
              Keyboard.dismiss(); // Dismiss keyboard when panel is dismissed
              
              if (isMultiEdit) {
                // In multi-edit mode, dismissing panel should close modal entirely (go back to library)
                // Auto-save tags if any were selected
                if (localTags.length > 0) {
                  console.log('[TagModal] Auto-saving tags and closing modal (multi-edit mode)');
                  handleSave(false); // Close modal completely, go back to library
                } else {
                  // No tags selected, just close modal
                  console.log('[TagModal] Closing modal without saving (multi-edit mode, no tags)');
                  handleClose();
                }
                return;
              }
              
              // Single-edit mode: auto-save tags and location when panel is dismissed
              const currentTagsStr = JSON.stringify((asset?.tags ?? []).sort());
              const localTagsStr = JSON.stringify(localTags.sort());
              const tagsChanged = currentTagsStr !== localTagsStr;
              const currentLocation = asset?.location || null;
              const locationChanged = location.trim() !== (currentLocation || '');
              const shouldAutoSave = tagsChanged || locationChanged;
              
              if (shouldAutoSave) {
                console.log('[TagModal] Auto-saving tags and location on panel dismiss', { tagsChanged, locationChanged });
                // handleSave will handle the animation, so return early
                handleSave(true); // skipClose=true to only close panel, not modal
                return;
              }
              
              // No save needed, just close panel with animation
              setIsPanelVisible(false);
              Animated.parallel([
                Animated.timing(panelTranslateY, {
                  toValue: PANEL_HEIGHT,
                  duration: 350,
                  easing: Easing.in(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.timing(panelOpacity, {
                  toValue: 0,
                  duration: 320,
                  easing: Easing.in(Easing.ease),
                  useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                  toValue: 0,
                  duration: 320,
                  easing: Easing.in(Easing.ease),
                  useNativeDriver: true,
                }),
                Animated.timing(tagIndicatorOpacity, {
                  toValue: 1,
                  duration: 300,
                  delay: 320, // Wait for backdrop to fade out completely
                  easing: Easing.out(Easing.ease),
                  useNativeDriver: true,
                }),
              ]).start((finished) => {
                if (finished && isMountedRef.current) {
                  panelTranslateY.setValue(panelInitialValue);
                  backdropOpacity.setValue(0); // Ensure it's fully gone
                }
              });
            } else {
              // Snap back to current state
              if (isPanelVisible) {
                // Panel is visible but swipe wasn't enough - snap back to fully open
                Animated.timing(panelTranslateY, {
                  toValue: 0, // Ensure it's fully open
                  duration: 250,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }).start((finished) => {
                  if (finished && isMountedRef.current) {
                    panelTranslateY.setValue(0); // Force to 0
                  }
                });
              } else {
                // Panel is hidden but swipe wasn't enough - snap back to closed
                Animated.parallel([
                  Animated.timing(panelTranslateY, {
                    toValue: PANEL_HEIGHT,
                    duration: 250,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                  }),
                  Animated.timing(panelOpacity, {
                    toValue: 0,
                    duration: 200,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                  }),
                  Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 200,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                  }),
                ]).start((finished) => {
                  if (finished && isMountedRef.current) {
                    panelTranslateY.setValue(PANEL_HEIGHT);
                  }
                });
              }
            }
          }
          
          gestureDirectionRef.current = null;
        } catch (error) {
          console.error('[TagModal] Error in gesture end:', error);
          console.error('[TagModal] Error stack:', error instanceof Error ? error.stack : 'No stack');
          console.error('[TagModal] Error name:', error instanceof Error ? error.name : typeof error);
          console.error('[TagModal] Error message:', error instanceof Error ? error.message : String(error));
          
          // Reset state on error
          try {
            activeAnimationsRef.current.forEach(anim => {
              try {
                anim.stop();
              } catch (e) {
                console.error('[TagModal] Error stopping animation:', e);
              }
            });
            activeAnimationsRef.current = [];
            isSwipingRef.current = false;
            
            try {
              updateSwipeDirectionRef.current(null);
            } catch (e) {
              console.error('[TagModal] Error resetting swipe direction:', e);
            }
            
            photoTranslateX.setValue(0);
            overlayOpacity.setValue(0);
            gestureDirectionRef.current = null;
          } catch (cleanupError) {
            console.error('[TagModal] Error during cleanup:', cleanupError);
          }
        }
      })
      .onFinalize(() => {
        console.log('[TagModal] Gesture FINALIZE - isMounted:', isMountedRef.current);
        
        isSwipingRef.current = false;
        gestureDirectionRef.current = null;
        if (isMountedRef.current) {
          try {
            updateSwipeDirectionRef.current(null);
          } catch (e) {
            console.error('[TagModal] Error in finalize updating swipe direction:', e);
          }
        }
      });
      
      console.log('[TagModal] All gesture handlers attached, returning gesture');
      return gesture;
    } catch (error) {
      console.error('[TagModal] CRITICAL ERROR creating panGesture:', error);
      console.error('[TagModal] Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('[TagModal] Error name:', error instanceof Error ? error.name : typeof error);
      console.error('[TagModal] Error message:', error instanceof Error ? error.message : String(error));
      // Return a minimal gesture that does nothing to prevent crashes
      try {
        return Gesture.Pan().enabled(false);
      } catch (e) {
        console.error('[TagModal] Even creating minimal gesture failed:', e);
        // Last resort - return undefined and handle in JSX
        return undefined as any;
      }
    }
  }, [isInputFocused, isMultiEdit, allAssets.length, isPanelVisible]);
  
  console.log('[TagModal] panGesture created:', !!panGesture);
  
  // Track previous asset ID to detect asset changes
  const prevAssetIdForTagsRef = useRef<string | null>(null);
  
  // Load tags when asset changes - sync with latest tags from asset prop
  useEffect(() => {
    if (asset) {
      const assetChanged = prevAssetIdForTagsRef.current !== asset.id;
      
      if (isMultiEdit && multipleAssets.length > 0) {
        setLocalTags([]);
        setSavedTags([]);
        // In multi-edit, check if all assets have the same location
        const locations = multipleAssets
          .map(a => a.location)
          .filter(Boolean) as string[];
        // If all assets have the same location, show it; otherwise show empty
        const uniqueLocations = Array.from(new Set(locations));
        setLocation(uniqueLocations.length === 1 ? uniqueLocations[0] : '');
      } else if (asset) {
        // Always sync with latest tags from asset prop to show all tags
        // Location is now stored in separate column, not in tags
        const assetTags = asset.tags ?? [];
        setLocalTags(assetTags);
        // Use saved location from ref if available (preserves unsaved changes during navigation)
        // Otherwise use asset.location from prop
        const savedLocation = savedLocationsRef.current.get(asset.id);
        setLocation(savedLocation !== undefined ? savedLocation : (asset.location || ''));
        
        if (assetChanged) {
          // Reset savedTags when asset changes (new photo selected)
          setSavedTags(assetTags);
          prevAssetIdForTagsRef.current = asset.id;
        } else if (savedTags.length > 0) {
          // If we have savedTags and asset.tags matches them, update savedTags
          // This handles the case where database update completes and asset.tags is now correct
          const savedTagsStr = JSON.stringify(savedTags.sort());
          const assetTagsStr = JSON.stringify(assetTags.sort());
          // Only update if they match (database update completed) or if asset has more tags (new tags added)
          if (assetTagsStr === savedTagsStr || assetTags.length >= savedTags.length) {
            setSavedTags(assetTags);
          }
        }
      } else {
        setLocalTags([]);
        setSavedTags([]);
        setLocation('');
      }
      setNewTag('');
      setIsInputFocused(false);
      prevAssetIdRef.current = asset.id;
    }
  }, [asset?.id, asset?.tags, isMultiEdit, multipleAssets.length]); // Added asset?.tags to dependency array
  
  const handleClose = () => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    Keyboard.dismiss();
    
    // In multi-edit mode, use faster fade-out animation (no panel slide needed)
    if (isMultiEdit) {
      Animated.timing(panelOpacity, {
        toValue: 0,
        duration: 150, // Faster for multi-edit
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        isDismissingRef.current = false;
        onClose();
      });
      return;
    }
    
    // Animate panel down if visible (single-edit mode)
    if (isPanelVisible) {
      Animated.parallel([
        Animated.spring(panelTranslateY, {
          toValue: PANEL_HEIGHT,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(panelOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(currentPhotoOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(tagIndicatorOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        isDismissingRef.current = false;
        onClose();
      });
    } else {
      Animated.timing(currentPhotoOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        isDismissingRef.current = false;
        onClose();
      });
    }
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
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
  

  const handleSave = async (skipClose = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Location is now stored in separate column, not in tags
    const finalTags: TagVocabulary[] = [...localTags];
    const locationValue = location.trim() || null;
    
    // Save the tags we're about to save - use this for bottom display
    setSavedTags(localTags);
    
    // Optimistically update asset prop immediately so bottom display shows new tags
    // This ensures tags are visible even before database update completes
    if (asset && onAssetChange && !isMultiEdit) {
      // Only update single asset in single-edit mode
      // In multi-edit mode, onUpdateTags handles updating all assets
      onAssetChange({ ...asset, tags: finalTags, location: locationValue });
    }
    
    // In multi-edit mode, always close modal completely (go back to library)
    // In single-edit mode, respect skipClose parameter
    if (isMultiEdit) {
      // Multi-edit: close modal immediately for fast UX, save tags in background
      console.log('[TagModal] Closing modal immediately, saving tags and location in background');
      
      // Close modal immediately (optimistic close for fast UX)
      handleClose();
      
      // Update tags and location in database in background (don't await - let it happen async)
      onUpdateTags(finalTags, locationValue).catch((error) => {
        console.error('[TagModal] Failed to update tags/location:', error);
        // Show error alert but don't block the UI
        Alert.alert('Update failed', 'Unable to save tags and location. Please try again.');
      });
    } else if (!skipClose) {
      // Single-edit: save first, then close panel and modal
      // Save tags and location before closing to ensure they persist
      await onUpdateTags(finalTags, locationValue).catch((error) => {
        console.error('[TagModal] Failed to update tags/location:', error);
        Alert.alert('Update failed', 'Unable to save tags and location. Please try again.');
        // Don't close if save failed
        return;
      });
      handleClose();
    } else {
      // Single-edit auto-save: just close the panel, don't close the modal
      setIsPanelVisible(false);
      Animated.parallel([
        Animated.timing(panelTranslateY, {
          toValue: PANEL_HEIGHT,
          duration: 350,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(panelOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(tagIndicatorOpacity, {
          toValue: 1,
          duration: 300,
          delay: 320,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
    
    // Update tags in database (only for single-edit auto-save, multi-edit already handled above)
    if (!isMultiEdit && skipClose) {
      onUpdateTags(finalTags, locationValue).catch((error) => {
        console.error('[TagModal] Failed to update tags/location:', error);
        // Revert optimistic update on error
        if (asset && onAssetChange) {
          // Revert to original asset state
          onAssetChange({ ...asset, tags: asset.tags ?? [], location: asset.location || null });
          setLocation(asset.location || '');
        }
        // Revert saved tags on error
        setSavedTags(asset?.tags ?? []);
      });
    }
  };
  
  const handleRetryAutoTag = async () => {
    if (!asset || !asset.publicUrl) return;
    
    setIsRetryingAutoTag(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      if (supabase) {
        const { error: updateError } = await supabase
          .from('assets')
          // @ts-expect-error - Supabase type inference issue with auto_tag_status
          .update({ auto_tag_status: 'pending' })
          .eq('id', asset.id);
        
        if (updateError) {
          console.error('[TagModal] Failed to update auto_tag_status:', updateError);
        }
      }
      
      queueAutoTag(asset.id, asset.publicUrl, {
        onSuccess: async (result) => {
          setIsRetryingAutoTag(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setLocalTags(result.tags);
          
          if (onAutoTagSuccess) {
            onAutoTagSuccess(asset.id);
          }
          
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 2500);
          
          if (onUpdateTags) {
            await onUpdateTags(result.tags);
          }
        },
        onError: async (error) => {
          setIsRetryingAutoTag(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          if (supabase && error.message.includes('Rate limit')) {
            const { error: updateError } = await supabase
              .from('assets')
              // @ts-expect-error - Supabase type inference issue with auto_tag_status column
              .update({ auto_tag_status: 'failed' })
              .eq('id', asset.id);
            
            if (updateError) {
              console.error('[TagModal] Failed to update auto_tag_status:', updateError);
            }
          }
          Alert.alert('Auto-tagging failed', 'Please try again later or tag manually.');
        },
      });
    } catch (error) {
      setIsRetryingAutoTag(false);
      console.error('[TagModal] Error retrying auto-tag:', error);
      Alert.alert('Error', 'Failed to retry auto-tagging. Please try again.');
    }
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
  
  if (!visible || !asset) return null;
  
  return (
    <Modal 
      visible={visible} 
      animationType="none" 
      onRequestClose={handleClose} 
      presentationStyle="fullScreen"
      transparent={true}
    >
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Full Screen Photo Viewer */}
        {panGesture ? (
          <GestureDetector gesture={panGesture}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {/* CURRENT PHOTO - Bottom layer, COMPLETELY HIDDEN when transitioning */}
              {!shouldHideCurrentPhoto && (
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    height: '100%',
                    opacity: currentPhotoOpacity,
                    transform: [{ translateX: photoTranslateX }],
                    zIndex: 1, // Below overlay
                  }}
                  pointerEvents="none"
                >
                  {asset?.publicUrl ? (
                    <Image
                      source={{ uri: asset.publicUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  ) : null}
                </Animated.View>
              )}
              
              {/* OVERLAY PHOTO - Top layer, always on top when visible */}
              {allAssets.length > 1 && (
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    height: '100%',
                    opacity: overlayOpacity,
                    backgroundColor: '#000',
                    zIndex: 2, // ALWAYS above current photo
                    pointerEvents: 'none',
                  }}
                >
                  {swipeDirection === 'right' && prevAsset?.publicUrl ? (
                    <Image
                      source={{ uri: prevAsset.publicUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  ) : null}
                  {swipeDirection === 'left' && nextAsset?.publicUrl ? (
                    <Image
                      source={{ uri: nextAsset.publicUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  ) : null}
                </Animated.View>
              )}
            </View>
          </GestureDetector>
        ) : isMultiEdit ? (
          // Multi-edit mode: Clean white background - Apple-style simplicity
          // No photo preview - panel opens immediately showing tag selection
          <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                opacity: currentPhotoOpacity,
                transform: [{ translateX: photoTranslateX }],
              }}
            >
              {asset?.publicUrl ? (
                <Image
                  source={{ uri: asset.publicUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              ) : null}
            </Animated.View>
          </View>
        )}
        
        {/* Top bar with close button */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: 12,
            paddingHorizontal: 20,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: isMultiEdit ? 30 : 10, // Higher z-index in multi-edit to ensure it's above the panel
            backgroundColor: isMultiEdit ? '#ffffff' : 'transparent',
            borderBottomWidth: isMultiEdit ? 1 : 0,
            borderBottomColor: isMultiEdit ? '#e5e7eb' : 'transparent',
          }}
        >
          <TouchableOpacity
            onPress={handleClose}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="close" size={24} color={isMultiEdit ? "#111827" : "#ffffff"} />
          </TouchableOpacity>
        </View>
        
        {/* Success Banner */}
        {showSuccessMessage && (
          <View
            style={{
              position: 'absolute',
              top: Math.max(insets.top, 16) + 56,
              left: 0,
              right: 0,
              zIndex: 1000,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                marginHorizontal: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <MaterialCommunityIcons name="check" size={16} color="#10b981" style={{ marginRight: 10 }} />
              <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500' }}>
                Tags added
              </Text>
            </View>
          </View>
        )}
        
        {/* Backdrop overlay - Only show in single-edit mode (not multi-edit) */}
        {/* Fully opaque backdrop when panel is visible in single-edit */}
        {isPanelVisible && !isMultiEdit && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#000000', // Fully opaque - no transparency
              zIndex: 15, // Above images, below panel
              pointerEvents: 'auto',
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => {
                Keyboard.dismiss(); // Dismiss keyboard when panel is dismissed
                
                if (isMultiEdit) {
                  // In multi-edit mode, tapping backdrop should close modal entirely (go back to library)
                  // Auto-save tags if any were selected
                  if (localTags.length > 0) {
                    console.log('[TagModal] Auto-saving tags and closing modal (multi-edit mode, backdrop tap)');
                    handleSave(false); // Close modal completely, go back to library
                  } else {
                    // No tags selected, just close modal
                    console.log('[TagModal] Closing modal without saving (multi-edit mode, no tags, backdrop tap)');
                    handleClose();
                  }
                  return;
                }
                
                // Single-edit mode: auto-save tags and location when backdrop is tapped
                const currentTagsStr = JSON.stringify((asset?.tags ?? []).sort());
                const localTagsStr = JSON.stringify(localTags.sort());
                const tagsChanged = currentTagsStr !== localTagsStr;
                const currentLocation = asset?.location || null;
                const locationChanged = location.trim() !== (currentLocation || '');
                const shouldAutoSave = tagsChanged || locationChanged;
                
                if (shouldAutoSave) {
                  console.log('[TagModal] Auto-saving tags and location on backdrop tap', { tagsChanged, locationChanged });
                  // handleSave will handle the animation, so return early
                  handleSave(true); // skipClose=true to only close panel, not modal
                  return;
                }
                
                // No save needed, just close panel with animation
                setIsPanelVisible(false);
                Animated.parallel([
                  Animated.timing(panelTranslateY, {
                    toValue: PANEL_HEIGHT,
                    duration: 350,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                  }),
                  Animated.timing(panelOpacity, {
                    toValue: 0,
                    duration: 320,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                  }),
                  Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 320,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                  }),
                  Animated.timing(tagIndicatorOpacity, {
                    toValue: 1,
                    duration: 300,
                    delay: 320,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                  }),
                ]).start((finished) => {
                  if (finished && isMountedRef.current) {
                    panelTranslateY.setValue(PANEL_HEIGHT);
                    backdropOpacity.setValue(0);
                  }
                });
              }}
            />
          </View>
        )}
        {/* Animated backdrop for smooth fade-in when opening - hidden when panel is fully visible */}
        {!isPanelVisible && (
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#000000',
              opacity: backdropOpacity,
              zIndex: 15,
              pointerEvents: 'none',
            }}
          />
        )}
        
        {/* Tag Display & Swipe Up Indicator - Bottom (only show in single-edit mode) */}
        {(!isPanelVisible && asset !== null && asset !== undefined && !isMultiEdit) ? (
          <Animated.View
            style={{
              position: 'absolute',
              bottom: Math.max(insets.bottom, 20),
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 16,
              opacity: tagIndicatorOpacity,
              transform: [{ scale: tagIndicatorScale }],
              pointerEvents: 'box-none', // Allow gestures to pass through to parent
            }}
          >
            {/* Applied Tags Display - Apple-style refined design */}
            {/* When panel is dismissed, show savedTags if available (user's saved tags), otherwise asset.tags */}
            {/* This ensures we show the latest user-edited tags, not stale OpenAI tags */}
            <View pointerEvents="none">
              {(() => {
                // Defensive check: ensure we always have an array
                const savedTagsArray = Array.isArray(savedTags) ? savedTags : [];
                const assetTagsArray = Array.isArray(asset?.tags) ? asset.tags : [];
                const tagsToShow = savedTagsArray.length > 0 ? savedTagsArray : assetTagsArray;
                const hasTags = tagsToShow.length > 0;
                
                if (hasTags) {
                  return (
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        alignItems: 'center',
                        maxWidth: SCREEN_WIDTH - 48,
                        marginBottom: 16,
                        gap: 6,
                        paddingHorizontal: 4,
                      }}
                    >
                      {tagsToShow.map((tag) => {
                        // Ensure tag is a string before rendering
                        const tagString = typeof tag === 'string' ? tag : String(tag);
                        return (
                          <View
                            key={tagString}
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              borderRadius: 20,
                              paddingVertical: 10,
                              paddingHorizontal: 16,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.15,
                              shadowRadius: 12,
                              elevation: 8,
                              borderWidth: 0.5,
                              borderColor: 'rgba(0, 0, 0, 0.05)',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: '500',
                                color: '#111827',
                                letterSpacing: -0.3,
                              }}
                            >
                              {tagString}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                }
                
                return (
                  <View
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      borderRadius: 24,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      marginBottom: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    <MaterialCommunityIcons 
                      name="tag-outline" 
                      size={16} 
                      color="rgba(255, 255, 255, 0.8)" 
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '500',
                        color: 'rgba(255, 255, 255, 0.85)',
                        letterSpacing: -0.2,
                      }}
                    >
                      No tags
                    </Text>
                  </View>
                );
              })()}
            </View>
            
            {/* Swipe Up Indicator */}
            <TouchableOpacity
              onPress={() => {
                // Open panel with smooth animation
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsPanelVisible(true);
                Animated.parallel([
                  Animated.timing(panelTranslateY, {
                    toValue: 0, // Fully open - panel at top of visible area
                    duration: 350,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                  }),
                  Animated.timing(panelOpacity, {
                    toValue: 1,
                    duration: 320,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                  }),
                  Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 320,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                  }),
                  Animated.timing(tagIndicatorOpacity, {
                    toValue: 0,
                    duration: 200,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                  }),
                ]).start((finished) => {
                  // Ensure panel is fully open after animation completes
                  if (finished && isMountedRef.current) {
                    panelTranslateY.setValue(0);
                    backdropOpacity.setValue(1);
                  }
                });
              }}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                borderRadius: 24,
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <MaterialCommunityIcons 
                name="chevron-up" 
                size={16} 
                color="rgba(255, 255, 255, 0.9)" 
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.95)',
                  letterSpacing: -0.2,
                }}
              >
                Swipe up for details
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
            
            {/* Auto-tag Status Indicator - Show when actively tagging or pending */}
            {asset && (autoTaggingAssets.has(asset.id) || asset.auto_tag_status === 'pending') ? (
              <View
                style={{
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(179, 143, 91, 0.25)',
                  borderRadius: 12,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(179, 143, 91, 0.3)',
                }}
              >
                <ActivityIndicator size="small" color="#b38f5b" style={{ marginRight: 6 }} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: '#b38f5b',
                  }}
                >
                  Auto-tagging...
                </Text>
              </View>
            ) : null}
            {asset && asset.auto_tag_status === 'failed' && !autoTaggingAssets.has(asset.id) ? (
              <TouchableOpacity
                onPress={handleRetryAutoTag}
                style={{
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 59, 48, 0.25)',
                  borderRadius: 12,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 59, 48, 0.3)',
                }}
              >
                <MaterialCommunityIcons name="alert-circle" size={14} color="#ff3b30" style={{ marginRight: 6 }} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: '#ff3b30',
                  }}
                >
                  Tagging failed
                </Text>
              </TouchableOpacity>
            ) : null}
        
        {/* Bottom Panel - Slides up when swiping up */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: isMultiEdit ? SCREEN_HEIGHT : PANEL_HEIGHT,
            borderTopLeftRadius: isMultiEdit ? 0 : 20,
            borderTopRightRadius: isMultiEdit ? 0 : 20,
            transform: [{ translateY: panelTranslateY }],
            backgroundColor: '#ffffff', // Fully opaque white
            opacity: panelOpacity, // Controlled by animation and useEffect
            zIndex: 20, // Above backdrop
            // Ensure no transparency - fully opaque
            overflow: 'hidden',
          }}
        >
          {/* Panel content */}
          <View
            style={{
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
            }}
          >
          </View>
          
          {/* Panel handle indicator - only show in single-edit mode */}
          {!isMultiEdit && (
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: '#d1d5db',
                borderRadius: 2,
                alignSelf: 'center',
                marginTop: 12,
                marginBottom: 8,
              }}
            />
          )}
          
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ 
                paddingBottom: Math.max(insets.bottom, 200), 
                paddingHorizontal: 20,
                paddingTop: isMultiEdit ? Math.max(insets.top, 16) + 56 + 16 : 0, // Account for top bar (safe area + 56px bar height + 16px spacing)
              }}
              showsVerticalScrollIndicator={false}
              bounces={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header */}
              {!isMultiEdit ? (
                <View style={{ paddingTop: 8, paddingBottom: 24 }}>
                  {/* Removed generic "Tags" header - content is self-explanatory */}
                </View>
              ) : (
                // Multi-edit header with photo grid - Apple-style clean design
                <View style={{ paddingTop: 0, paddingBottom: 24 }}>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
                    {multipleAssets.length} {multipleAssets.length === 1 ? 'Photo' : 'Photos'}
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: '400', color: '#6b7280', marginBottom: 20 }}>
                    Add tags to all selected photos
                  </Text>
                  
                  {/* Compact photo grid preview - shows selection */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {multipleAssets.slice(0, 6).map((assetItem) => (
                      <View
                        key={assetItem.id}
                        style={{
                          width: (SCREEN_WIDTH - 52) / 6 - 5,
                          height: (SCREEN_WIDTH - 52) / 6 - 5,
                          borderRadius: 8,
                          overflow: 'hidden',
                          backgroundColor: '#f3f4f6',
                        }}
                      >
                        {assetItem.publicUrl ? (
                          <Image
                            source={{ uri: assetItem.publicUrl }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="image" size={16} color="#9ca3af" />
                          </View>
                        )}
                      </View>
                    ))}
                    {multipleAssets.length > 6 ? (
                      <View
                        style={{
                          width: (SCREEN_WIDTH - 52) / 6 - 5,
                          height: (SCREEN_WIDTH - 52) / 6 - 5,
                          borderRadius: 8,
                          backgroundColor: '#f3f4f6',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600' }}>
                          +{multipleAssets.length - 6}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
              
              {/* Location Section - Core metadata first */}
              <View style={{ marginBottom: 32 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: 12,
                    letterSpacing: -0.2,
                  }}
                >
                  Location
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: location ? '#b38f5b' : '#e5e7eb',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0,
                    shadowRadius: 0,
                  }}
                  onPress={() => {
                    // Focus the TextInput when the container is tapped
                    // This provides a larger tap target and better UX
                    locationInputRef.current?.focus();
                  }}
                >
                  {/* Map Pin Icon - SF Symbol style */}
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: location ? '#b38f5b' : '#8e8e93',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <MaterialCommunityIcons 
                      name="map-marker" 
                      size={12} 
                      color="#ffffff" 
                    />
                  </View>
                  
                  {/* Text Input - Integrated */}
                  <TextInput
                    ref={locationInputRef}
                    placeholder="Add a location..."
                    placeholderTextColor="#8e8e93"
                    value={location}
                    onChangeText={setLocation}
                    returnKeyType="done"
                    maxLength={50}
                    onFocus={() => {
                      setIsInputFocused(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    onBlur={() => {
                      setIsInputFocused(false);
                      // Auto-save location when keyboard is dismissed
                      if (checkHasUnsavedChanges()) {
                        handleSaveSilent();
                      }
                    }}
                    style={{
                      flex: 1,
                      fontSize: 16,
                      fontWeight: location ? '500' : '400',
                      color: location ? '#111827' : '#8e8e93',
                      padding: 0, // Remove default padding since container handles it
                    }}
                  />
                  
                  {/* Clear button - only show when there's text */}
                  {location.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => setLocation('')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: '#e5e7eb',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginLeft: 8,
                      }}
                    >
                      <MaterialCommunityIcons 
                        name="close" 
                        size={12} 
                        color="#6b7280" 
                      />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
                
                {/* Helper text for multi-edit */}
                {isMultiEdit && location.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <MaterialCommunityIcons name="information-outline" size={14} color="#6b7280" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>
                      Will be applied to all {multipleAssets.length} selected photos
                    </Text>
                  </View>
                )}
                
                {/* Helper text for empty state - subtle guidance */}
                {(!location || location.length === 0) && !isMultiEdit && (
                  <View style={{ 
                    marginTop: 8, 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    backgroundColor: '#f9fafb',
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}>
                    <MaterialCommunityIcons name="information-outline" size={14} color="#9ca3af" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: '#9ca3af', flex: 1 }}>
                      Location from photo metadata will appear here
                    </Text>
                  </View>
                )}
              </View>
              
              {/* Auto-tag / Re-tag Section - Primary action after location */}
              {!!asset && (
                <View style={{ marginBottom: 32 }}>
                  <TouchableOpacity
                    onPress={handleRetryAutoTag}
                    disabled={isRetryingAutoTag}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      paddingVertical: 18,
                      paddingHorizontal: 24,
                      borderRadius: 16,
                      backgroundColor: isRetryingAutoTag
                        ? 'rgba(179, 143, 91, 0.08)'
                        : localTags.length > 0
                        ? '#f9fafb'
                        : '#b38f5b',
                      borderWidth: localTags.length > 0 && !isRetryingAutoTag ? 2.5 : 0,
                      borderColor: localTags.length > 0 ? '#b38f5b' : 'transparent',
                      shadowColor: localTags.length === 0 ? '#b38f5b' : localTags.length > 0 ? '#b38f5b' : 'transparent',
                      shadowOffset: { width: 0, height: localTags.length === 0 ? 6 : 2 },
                      shadowOpacity: localTags.length === 0 ? 0.2 : localTags.length > 0 ? 0.08 : 0,
                      shadowRadius: localTags.length === 0 ? 12 : 4,
                      elevation: localTags.length === 0 ? 4 : localTags.length > 0 ? 1 : 0,
                    }}
                  >
                    {isRetryingAutoTag ? (
                      <>
                        <ActivityIndicator size="small" color="#b38f5b" />
                        <Text style={{ fontSize: 17, fontWeight: '600', color: '#b38f5b', letterSpacing: -0.3 }}>
                          {isMultiEdit ? 'Tagging Photos...' : 'Tagging...'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="auto-fix"
                          size={22}
                          color={localTags.length > 0 ? '#b38f5b' : '#ffffff'}
                        />
                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: '600',
                            color: localTags.length > 0 ? '#b38f5b' : '#ffffff',
                            letterSpacing: -0.3,
                          }}
                        >
                          {isMultiEdit 
                            ? (localTags.length > 0 ? `Re-tag ${multipleAssets.length} Photos` : `Auto-tag ${multipleAssets.length} Photos`)
                            : (localTags.length > 0 ? 'Re-tag Photo' : 'Auto-tag Photo')
                          }
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Tags Section - Show existing tags */}
              {localTags.length > 0 ? (
                <View style={{ marginBottom: 32 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#111827',
                        letterSpacing: -0.2,
                      }}
                    >
                      Tags
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: '#6b7280',
                      }}
                    >
                      {localTags.length} {localTags.length === 1 ? 'tag' : 'tags'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {localTags.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        activeOpacity={0.7}
                        style={{
                          backgroundColor: '#b38f5b',
                          borderRadius: 22,
                          paddingVertical: 11,
                          paddingHorizontal: 18,
                          flexDirection: 'row',
                          alignItems: 'center',
                          shadowColor: '#b38f5b',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '500',
                            color: '#ffffff',
                            marginRight: 8,
                            letterSpacing: -0.2,
                          }}
                        >
                          {tag}
                        </Text>
                        <MaterialCommunityIcons name="close" size={15} color="#ffffff" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={{ marginBottom: 32 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: 12,
                      letterSpacing: -0.2,
                    }}
                  >
                    Tags
                  </Text>
                  <View style={{ 
                    backgroundColor: '#f9fafb', 
                    borderRadius: 12, 
                    paddingVertical: 24, 
                    paddingHorizontal: 20,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    borderStyle: 'dashed',
                  }}>
                    <MaterialCommunityIcons name="tag-outline" size={24} color="#9ca3af" style={{ marginBottom: 8 }} />
                    <Text style={{ fontSize: 15, fontWeight: '500', color: '#6b7280', marginBottom: 4 }}>
                      No tags yet
                    </Text>
                    <Text style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                      Add tags manually or use auto-tag
                    </Text>
                  </View>
                </View>
              )}
              
              {/* Add Tag Section */}
              <View style={{ marginBottom: 32 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: 12,
                    letterSpacing: -0.2,
                  }}
                >
                  Add Tag
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    ref={inputRef}
                    placeholder="Type a tag name..."
                    placeholderTextColor="#8e8e93"
                    value={newTag}
                    onChangeText={setNewTag}
                    onSubmitEditing={handleAddTag}
                    onFocus={() => {
                      setIsInputFocused(true);
                      // Scroll to show input when focused so user can see what they're typing
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 300); // Wait for keyboard to appear
                    }}
                    onBlur={() => setIsInputFocused(false)}
                    returnKeyType="done"
                    maxLength={30}
                    style={{
                      flex: 1,
                      backgroundColor: '#f9fafb',
                      borderRadius: 14,
                      paddingVertical: 16,
                      paddingHorizontal: 18,
                      fontSize: 16,
                      fontWeight: '400',
                      color: '#111827',
                      borderWidth: isInputFocused ? 2 : 1,
                      borderColor: isInputFocused ? '#b38f5b' : '#e5e7eb',
                    }}
                  />
                  {newTag.trim().length > 0 ? (
                    <TouchableOpacity
                      onPress={handleAddTag}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: '#b38f5b',
                        borderRadius: 10,
                        paddingHorizontal: 20,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 17, fontWeight: '600', color: '#ffffff' }}>
                        Add
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              
              {/* Suggested Tags */}
              {allAvailableTagsCombined.length > 0 && (
                <View style={{ marginBottom: 32 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#111827',
                        letterSpacing: -0.2,
                      }}
                    >
                      Suggested Tags
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: '#6b7280',
                      }}
                    >
                      {allAvailableTagsCombined.length} {allAvailableTagsCombined.length === 1 ? 'suggestion' : 'suggestions'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {allAvailableTagsCombined.map((tag) => {
                      const isActive = tagsSet.has(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => toggleTag(tag)}
                          activeOpacity={0.7}
                          style={{
                            backgroundColor: isActive ? '#b38f5b' : '#f9fafb',
                            borderRadius: 22,
                            paddingVertical: 11,
                            paddingHorizontal: 18,
                            borderWidth: isActive ? 0 : 1.5,
                            borderColor: '#e5e7eb',
                            shadowColor: isActive ? '#b38f5b' : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: isActive ? 0.1 : 0,
                            shadowRadius: 4,
                            elevation: isActive ? 2 : 0,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: '500',
                              color: isActive ? '#ffffff' : '#374151',
                              letterSpacing: -0.2,
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
              
              {/* Delete Button */}
              {!isMultiEdit && !!asset && !!onDelete && (
                <View style={{ marginTop: 40, marginBottom: 20 }}>
                  <TouchableOpacity
                    onPress={handleDelete}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                      borderRadius: 12,
                      backgroundColor: '#ff3b30',
                    }}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ffffff" />
                    <Text style={{ fontSize: 17, fontWeight: '600', color: '#ffffff' }}>
                      Delete Photo
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}
