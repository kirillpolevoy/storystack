import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Keyboard, Platform, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { TagVocabulary } from '@/types';

type TagSearchBarProps = {
  selectedTags: TagVocabulary[];
  onToggleTag: (tag: TagVocabulary) => void;
  availableTags: TagVocabulary[];
  tagCounts?: Map<TagVocabulary, number>;
  showNoTagsOption?: boolean;
  noTagsLabel?: string;
  availableLocations?: string[]; // Unique locations from assets
  locationCounts?: Map<string, number>; // Count of photos per location
};

const NO_TAGS_FILTER = '__NO_TAGS__' as TagVocabulary;
const LOCATION_PREFIX = '__LOCATION__' as TagVocabulary; // Prefix to distinguish locations from tags

export function TagSearchBar({ 
  selectedTags, 
  onToggleTag, 
  availableTags,
  tagCounts = new Map(),
  showNoTagsOption = false,
  noTagsLabel = 'No Tags',
  availableLocations = [],
  locationCounts = new Map(),
}: TagSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  // Animation refs
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const dropdownScale = useRef(new Animated.Value(0.95)).current;
  const dropdownTranslateY = useRef(new Animated.Value(-8)).current;
  const searchBarScale = useRef(new Animated.Value(1)).current;
  const searchBarBorderWidth = useRef(new Animated.Value(1)).current;
  const textInputRef = useRef<TextInput>(null);
  const isInteractingWithDropdown = useRef(false);

  // Debounce search query (250ms for snappier feel)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Helper to check if a value is a location filter
  const isLocationFilter = (value: TagVocabulary): boolean => {
    return typeof value === 'string' && value.startsWith(LOCATION_PREFIX);
  };

  // Extract location name from location filter
  const getLocationName = (locationFilter: TagVocabulary): string => {
    return locationFilter.replace(LOCATION_PREFIX, '');
  };

  // Create location filter identifier
  const createLocationFilter = (location: string): TagVocabulary => {
    return `${LOCATION_PREFIX}${location}` as TagVocabulary;
  };

  // Unified tag and location list: show all when empty, filtered when typing
  const displayItems = useMemo(() => {
    const selectedSet = new Set(selectedTags || []);
    const isNoTagsSelected = selectedSet.has(NO_TAGS_FILTER);
    
    // Build list of regular tags (excluding NO_TAGS_FILTER and location filters)
    const regularTags = (availableTags || []).filter((tag) => 
      tag !== NO_TAGS_FILTER && 
      !selectedSet.has(tag) &&
      !isLocationFilter(tag)
    );

    // Build list of locations (excluding already selected ones)
    const regularLocations = (availableLocations || [])
      .filter((location) => location && location.trim())
      .filter((location) => !selectedSet.has(createLocationFilter(location)))
      .map((location) => ({
        type: 'location' as const,
        value: createLocationFilter(location),
        displayName: location,
        count: locationCounts?.get(location) || 0,
      }));

    // Build list of tags
    const tagItems = regularTags.map((tag) => ({
      type: 'tag' as const,
      value: tag,
      displayName: tag,
      count: tagCounts?.get(tag) || 0,
    }));

    // If user is typing, filter and sort by relevance
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase().trim();
      
      // Filter tags
      const filteredTags = tagItems.filter((item) => {
        return item.displayName.toLowerCase().includes(query);
      }).sort((a, b) => {
        const aLower = a.displayName.toLowerCase();
        const bLower = b.displayName.toLowerCase();
        
        if (aLower === query) return -1;
        if (bLower === query) return 1;
        
        if (aLower.startsWith(query)) return -1;
        if (bLower.startsWith(query)) return 1;
        
        return a.displayName.localeCompare(b.displayName);
      });

      // Filter locations
      const filteredLocations = regularLocations.filter((item) => {
        return item.displayName.toLowerCase().includes(query);
      }).sort((a, b) => {
        const aLower = a.displayName.toLowerCase();
        const bLower = b.displayName.toLowerCase();
        
        if (aLower === query) return -1;
        if (bLower === query) return 1;
        
        if (aLower.startsWith(query)) return -1;
        if (bLower.startsWith(query)) return 1;
        
        return a.displayName.localeCompare(b.displayName);
      });

      const results: Array<{ type: 'tag' | 'location' | 'no-tags'; value: TagVocabulary; displayName: string; count: number }> = [];
      
      // Add "No Tags" option if it matches search query and not already selected
      if (showNoTagsOption && !isNoTagsSelected && noTagsLabel.toLowerCase().includes(query)) {
        results.push({ type: 'no-tags', value: NO_TAGS_FILTER, displayName: noTagsLabel, count: 0 });
      }
      
      // Add locations first (they're more specific), then tags
      results.push(...filteredLocations, ...filteredTags);
      
      return results;
    }

    // If empty, show all items sorted by usage (most popular first)
    // Locations first, then tags
    const sortedLocations = regularLocations.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count; // Higher count first
      }
      return a.displayName.localeCompare(b.displayName); // Alphabetical tiebreaker
    });

    const sortedTags = tagItems.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count; // Higher count first
      }
      return a.displayName.localeCompare(b.displayName); // Alphabetical tiebreaker
    });

    const results: Array<{ type: 'tag' | 'location' | 'no-tags'; value: TagVocabulary; displayName: string; count: number }> = [];
    
    // Add "No Tags" option at the beginning if enabled and not selected
    if (showNoTagsOption && !isNoTagsSelected) {
      results.push({ type: 'no-tags', value: NO_TAGS_FILTER, displayName: noTagsLabel, count: 0 });
    }
    
    // Add locations first, then tags
    results.push(...sortedLocations, ...sortedTags);
    
    return results;
  }, [debouncedQuery, availableTags, availableLocations, selectedTags, tagCounts, locationCounts, showNoTagsOption, noTagsLabel]);

  // Animate search bar on focus
  useEffect(() => {
    if (isFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      Animated.parallel([
        Animated.spring(searchBarScale, {
          toValue: 1.002,
          tension: 300,
          friction: 30,
          useNativeDriver: true,
        }),
        Animated.timing(searchBarBorderWidth, {
          toValue: 2,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(searchBarScale, {
          toValue: 1,
          tension: 300,
          friction: 30,
          useNativeDriver: true,
        }),
        Animated.timing(searchBarBorderWidth, {
          toValue: 1,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isFocused]);

  // Animate dropdown when it appears/disappears
  useEffect(() => {
    const hasDisplayItems = displayItems && Array.isArray(displayItems) && displayItems.length > 0;
    if (isFocused && hasDisplayItems) {
      Animated.parallel([
        Animated.timing(dropdownOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(dropdownScale, {
          toValue: 1,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(dropdownTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(dropdownOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dropdownScale, {
          toValue: 0.96,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dropdownTranslateY, {
          toValue: -8,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isFocused, displayItems]);

  const selectedTagsSet = useMemo(() => new Set(selectedTags || []), [selectedTags]);

  const handleTagSelect = useCallback((tag: TagVocabulary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggleTag(tag);
    // Clear search query immediately - force clear both state and input
    setSearchQuery('');
    setDebouncedQuery('');
    // Force clear the TextInput value directly
    if (textInputRef.current) {
      textInputRef.current.setNativeProps({ text: '' });
    }
    setIsFocused(false);
    textInputRef.current?.blur(); // Ensure input loses focus
    Keyboard.dismiss();
  }, [onToggleTag]);

  const handleRemoveTag = useCallback((tag: TagVocabulary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleTag(tag);
  }, [onToggleTag]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay blur to allow for dropdown interactions
    // Don't blur if user is interacting with dropdown
    setTimeout(() => {
      if (!isInteractingWithDropdown.current) {
        setIsFocused(false);
      }
    }, 200);
  }, []);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchQuery('');
    setDebouncedQuery('');
    // Force clear the TextInput value directly
    if (textInputRef.current) {
      textInputRef.current.setNativeProps({ text: '' });
    }
    setIsFocused(false);
    textInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchQuery('');
    setDebouncedQuery('');
    // Force clear the TextInput value directly
    if (textInputRef.current) {
      textInputRef.current.setNativeProps({ text: '' });
    }
    setIsFocused(false);
    textInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const handleContainerPress = useCallback(() => {
    if (!isFocused) {
      textInputRef.current?.focus();
    }
  }, [isFocused]);

  const renderSuggestion = useCallback(({ item, index }: { item: { type: 'tag' | 'location' | 'no-tags'; value: TagVocabulary; displayName: string; count: number }; index: number }) => {
    if (!item) return null;
    const isSelected = selectedTagsSet.has(item.value);
    const isLocation = item.type === 'location';
    const isNoTagsFilter = item.type === 'no-tags';

    return (
      <Pressable
        onPress={() => handleTagSelect(item.value)}
        style={({ pressed }) => ({
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: index < displayItems.length - 1 ? 0.5 : 0,
          borderBottomColor: '#f0f0f0',
          backgroundColor: pressed ? '#f8f8f8' : isSelected ? '#fafafa' : '#ffffff',
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            {isLocation && (
              <MaterialCommunityIcons
                name="map-marker"
                size={18}
                color="#86868b"
                style={{ marginRight: 8 }}
              />
            )}
            {isNoTagsFilter && (
              <MaterialCommunityIcons
                name="tag-off"
                size={18}
                color="#86868b"
                style={{ marginRight: 8 }}
              />
            )}
            {!isLocation && !isNoTagsFilter && (
              <MaterialCommunityIcons
                name="tag"
                size={18}
                color="#86868b"
                style={{ marginRight: 8 }}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text 
                style={{ 
                  fontSize: 17,
                  fontWeight: '500',
                  color: '#1d1d1f',
                  letterSpacing: -0.4,
                  lineHeight: 22,
                }}
              >
                {item.displayName}
              </Text>
              {item.count > 0 && (
                <Text 
                  style={{ 
                    fontSize: 14,
                    fontWeight: '400',
                    color: '#86868b',
                    marginTop: 2,
                    letterSpacing: -0.2,
                  }}
                >
                  {item.count} {item.count === 1 ? 'photo' : 'photos'}
                </Text>
              )}
            </View>
          </View>
          {isSelected && (
            <View style={{ marginLeft: 12 }}>
              <MaterialCommunityIcons
                name="check-circle"
                size={22}
                color="#007aff"
              />
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [handleTagSelect, selectedTagsSet, displayItems.length]);

  const showDropdown = isFocused && displayItems.length > 0;

  return (
    <View style={{ position: 'relative', zIndex: 1 }}>
      {/* Search Bar Container - Apple-style design */}
      <Animated.View
        style={{
          transform: [{ scale: searchBarScale }],
        }}
      >
        <Pressable
          onPress={handleContainerPress}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 12,
            backgroundColor: isFocused ? '#ffffff' : '#f5f5f7',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderWidth: 0,
            shadowColor: isFocused ? '#000' : 'transparent',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isFocused ? 0.05 : 0,
            shadowRadius: isFocused ? 8 : 0,
            elevation: isFocused ? 2 : 0,
            opacity: pressed ? 0.95 : 1,
          })}
        >
          {/* Search Icon */}
          <View style={{ marginRight: 10 }}>
            <MaterialCommunityIcons
              name="magnify"
              size={18}
              color={isFocused ? '#007aff' : '#86868b'}
            />
          </View>

          {/* TextInput */}
          <TextInput
            ref={textInputRef}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              // Also clear debounced query if text is empty
              if (!text.trim()) {
                setDebouncedQuery('');
              }
            }}
            onFocus={handleFocus}
            onBlur={() => {
              // Only blur if not interacting with dropdown
              if (!isInteractingWithDropdown.current) {
                handleBlur();
              }
            }}
            placeholder="Search tags and locations..."
            placeholderTextColor="#86868b"
            style={{ 
              flex: 1,
              fontSize: 17,
              fontWeight: '400',
              color: '#1d1d1f',
              letterSpacing: -0.4,
              padding: 0,
              margin: 0,
              minHeight: 22,
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            returnKeyType="done"
            keyboardType="default"
            clearButtonMode="never"
            enablesReturnKeyAutomatically={false}
            showSoftInputOnFocus={true}
            blurOnSubmit={true}
            onSubmitEditing={handleDismiss}
            pointerEvents="auto"
          />

          {/* Clear Button */}
          {searchQuery.length > 0 && (
            <Pressable
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => ({
                marginLeft: 8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color="#86868b"
              />
            </Pressable>
          )}
        </Pressable>
      </Animated.View>

      {/* Dropdown Suggestions - Apple-style sheet with dismiss gesture */}
      {showDropdown && (
        <Animated.View
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 8,
            backgroundColor: '#ffffff',
            borderRadius: 12,
            maxHeight: 320,
            opacity: dropdownOpacity,
            transform: [
              { scale: dropdownScale },
              { translateY: dropdownTranslateY },
            ],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 12,
            zIndex: 1000,
            overflow: 'hidden',
            borderWidth: 0.5,
            borderColor: 'rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* Header with dismiss - Apple-style */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 0.5,
              borderBottomColor: '#f0f0f0',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: '#86868b',
                letterSpacing: -0.1,
              }}
            >
              {displayItems.length} {displayItems.length === 1 ? 'result' : 'results'}
            </Text>
            <Pressable
              onPress={handleDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: '#007aff',
                  letterSpacing: -0.3,
                }}
              >
                Done
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={displayItems}
            renderItem={renderSuggestion}
            keyExtractor={(item, index) => `${item.value}-${index}`}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={true}
            style={{ maxHeight: 280 }}
            nestedScrollEnabled={true}
            contentContainerStyle={{ paddingVertical: 4 }}
            onTouchStart={() => {
              // Mark that user is interacting with dropdown
              isInteractingWithDropdown.current = true;
              // Keep input focused to prevent blur
              textInputRef.current?.focus();
            }}
            onTouchEnd={() => {
              // Reset after a delay
              setTimeout(() => {
                isInteractingWithDropdown.current = false;
              }, 100);
            }}
            onScrollBeginDrag={() => {
              // Keep focus when scrolling starts
              isInteractingWithDropdown.current = true;
              textInputRef.current?.focus();
            }}
          />
        </Animated.View>
      )}

      {/* Selected Tags and Locations Chips - Refined Apple-style */}
      {selectedTags && selectedTags.length > 0 && (
        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {selectedTags.map((tag, index) => {
            if (!tag) return null;
            const isNoTagsFilter = tag === NO_TAGS_FILTER;
            const isLocation = isLocationFilter(tag);
            const displayName = isNoTagsFilter 
              ? noTagsLabel 
              : isLocation 
              ? getLocationName(tag)
              : tag;
            const count = isLocation 
              ? locationCounts?.get(getLocationName(tag)) || 0
              : tagCounts?.get(tag) || 0;
            return (
              <Pressable
                key={`${tag}-${index}`}
                onPress={() => handleRemoveTag(tag)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: '#b38f5b',
                  opacity: pressed ? 0.8 : 1,
                  shadowColor: '#b38f5b',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  elevation: 2,
                })}
              >
                {isLocation && (
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={14}
                    color="rgba(255, 255, 255, 0.9)"
                    style={{ marginRight: 4 }}
                  />
                )}
                {isNoTagsFilter && (
                  <MaterialCommunityIcons
                    name="tag-off"
                    size={14}
                    color="rgba(255, 255, 255, 0.9)"
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '500',
                    color: '#ffffff',
                    letterSpacing: -0.3,
                  }}
                >
                  {displayName}
                </Text>
                {count > 0 && (
                  <Text
                    style={{
                      marginLeft: 6,
                      fontSize: 13,
                      fontWeight: '500',
                      color: 'rgba(255, 255, 255, 0.85)',
                      letterSpacing: -0.2,
                    }}
                  >
                    ({count})
                  </Text>
                )}
                <View style={{ marginLeft: 6 }}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={16}
                    color="rgba(255, 255, 255, 0.9)"
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
