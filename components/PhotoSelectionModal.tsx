import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ImagePickerAsset } from 'expo-image-picker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_COLUMNS = 4;
const PHOTO_SIZE = (SCREEN_WIDTH - 16 - (NUM_COLUMNS - 1) * 2) / NUM_COLUMNS; // Account for padding and gaps
const HEADER_HEIGHT = 60;

type PhotoSelectionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (assets: ImagePickerAsset[]) => void;
  maxSelection?: number;
};

type MediaAsset = {
  id: string;
  uri: string;
  width: number;
  height: number;
  creationTime: number;
};

export function PhotoSelectionModal({
  visible,
  onClose,
  onSelect,
  maxSelection = 100,
}: PhotoSelectionModalProps) {
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const dragStartIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const scrollOffsetRef = useRef(0);
  const headerHeightRef = useRef(HEADER_HEIGHT);

  // Request permissions and load photos
  useEffect(() => {
    if (!visible) {
      console.log('[PhotoSelectionModal] Modal not visible, skipping load');
      return;
    }

    console.log('[PhotoSelectionModal] Modal visible, loading photos...');

    const loadPhotos = async () => {
      try {
        setIsLoading(true);
        console.log('[PhotoSelectionModal] Requesting permissions...');
        const { status } = await MediaLibrary.requestPermissionsAsync();
        
        if (status !== 'granted') {
          console.log('[PhotoSelectionModal] Permission denied');
          setHasPermission(false);
          setIsLoading(false);
          return;
        }

        console.log('[PhotoSelectionModal] Permission granted, fetching assets...');
        setHasPermission(true);
        
        // Fetch photos from device
        const { assets } = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: MediaLibrary.SortBy.creationTime,
          first: 1000, // Load up to 1000 photos
        });

        console.log(`[PhotoSelectionModal] Loaded ${assets.length} photos`);

        const formattedPhotos: MediaAsset[] = assets.map((asset) => ({
          id: asset.id,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          creationTime: asset.creationTime || 0,
        }));

        setPhotos(formattedPhotos);
      } catch (error) {
        console.error('[PhotoSelectionModal] Error loading photos:', error);
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadPhotos();
  }, [visible]);

  // Reset selection when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedIds(new Set());
      setIsDragging(false);
      isDraggingRef.current = false;
      dragStartIndexRef.current = null;
      scrollOffsetRef.current = 0;
    }
  }, [visible]);

  // Update header height
  useEffect(() => {
    headerHeightRef.current = HEADER_HEIGHT + insets.top;
  }, [insets.top]);

  // Convert MediaAsset to ImagePickerAsset format with EXIF data
  const convertToImagePickerAsset = useCallback(async (photo: MediaAsset): Promise<ImagePickerAsset> => {
    // Fetch EXIF data from MediaLibrary
    let exifData: any = undefined;
    let creationTime: number | undefined = photo.creationTime;
    
    try {
      const assetInfo = await MediaLibrary.getAssetInfoAsync(photo.id, {
        shouldDownloadFromNetwork: false,
      });
      
      if (assetInfo) {
        // Extract EXIF data if available
        // MediaLibrary.getAssetInfoAsync returns exif as a property
        if (assetInfo.exif) {
          exifData = assetInfo.exif;
          console.log(`[PhotoSelectionModal] Got EXIF for ${photo.id}:`, Object.keys(assetInfo.exif).slice(0, 5));
        }
        
        // Get creation time (prefer from assetInfo if available)
        if (assetInfo.creationTime) {
          creationTime = assetInfo.creationTime;
        }
        
        // Also check localUri for additional metadata
        if (assetInfo.localUri) {
          // localUri might have more complete EXIF data
        }
      }
    } catch (error) {
      console.warn(`[PhotoSelectionModal] Failed to get EXIF for photo ${photo.id}:`, error);
    }

    return {
      uri: photo.uri,
      width: photo.width,
      height: photo.height,
      type: 'image',
      assetId: photo.id,
      fileName: undefined,
      fileSize: undefined,
      mimeType: undefined,
      duration: undefined,
      exif: exifData,
      creationTime: creationTime,
    };
  }, []);

  // Handle photo selection/deselection
  const togglePhotoSelection = useCallback((index: number, isDrag = false) => {
    const photo = photos[index];
    if (!photo) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photo.id)) {
        next.delete(photo.id);
      } else {
        if (next.size >= maxSelection) {
          // Don't add if max selection reached
          return prev;
        }
        next.add(photo.id);
        if (!isDrag) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      return next;
    });
  }, [photos, maxSelection]);

  // Calculate photo index from screen coordinates
  const getPhotoIndexFromCoordinates = useCallback((x: number, y: number, scrollY: number = 0) => {
    const padding = 8;
    const gap = 2;
    const totalHeaderHeight = insets.top + headerHeightRef.current;
    
    // Adjust y coordinate for scroll offset and header
    const adjustedY = y + scrollY - totalHeaderHeight;
    
    const row = Math.floor(adjustedY / (PHOTO_SIZE + gap));
    const col = Math.floor((x - padding) / (PHOTO_SIZE + gap));
    const index = row * NUM_COLUMNS + col;
    
    return index >= 0 && index < photos.length ? index : null;
  }, [photos.length, insets.top]);

  // Handle drag selection (Apple Photos style)
  const handleDragSelection = useCallback((x: number, y: number, scrollY: number = 0) => {
    if (photos.length === 0) return;

    const index = getPhotoIndexFromCoordinates(x, y, scrollY);
    if (index === null) return;

    // If we have a start index, select all photos between start and current
    if (dragStartIndexRef.current !== null && !isDraggingRef.current) {
      isDraggingRef.current = true;
      setIsDragging(true);
    }

    if (dragStartIndexRef.current !== null) {
      const start = Math.min(dragStartIndexRef.current, index);
      const end = Math.max(dragStartIndexRef.current, index);
      
      // Select all photos in range
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (i >= 0 && i < photos.length) {
            const p = photos[i];
            if (next.size < maxSelection) {
              next.add(p.id);
            }
          }
        }
        return next;
      });
    } else {
      // First touch - toggle this photo
      togglePhotoSelection(index, false);
      dragStartIndexRef.current = index;
    }
  }, [photos, maxSelection, togglePhotoSelection, getPhotoIndexFromCoordinates]);

  // Create gesture handler for drag selection
  const panGesture = Gesture.Pan()
    .onStart((evt) => {
      const index = getPhotoIndexFromCoordinates(evt.x, evt.y, scrollOffsetRef.current);
      if (index !== null && index >= 0 && index < photos.length) {
        dragStartIndexRef.current = index;
        togglePhotoSelection(index, false);
      }
    })
    .onUpdate((evt) => {
      handleDragSelection(evt.x, evt.y, scrollOffsetRef.current);
    })
    .onEnd(() => {
      dragStartIndexRef.current = null;
      isDraggingRef.current = false;
      setIsDragging(false);
    });

  const handleDone = useCallback(async () => {
    const selectedPhotos = photos.filter((photo) => selectedIds.has(photo.id));
    
    // Show loading state while fetching EXIF data
    setIsLoading(true);
    
    try {
      // Convert all selected photos to ImagePickerAsset format with EXIF data
      const imagePickerAssets = await Promise.all(
        selectedPhotos.map(convertToImagePickerAsset)
      );
      
      onSelect(imagePickerAssets);
      onClose();
    } catch (error) {
      console.error('[PhotoSelectionModal] Error converting photos:', error);
      // Still proceed with basic data if EXIF fetch fails
      const basicAssets = selectedPhotos.map((photo) => ({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        type: 'image' as const,
        assetId: photo.id,
        fileName: undefined,
        fileSize: undefined,
        mimeType: undefined,
        duration: undefined,
        exif: undefined,
        creationTime: photo.creationTime,
      }));
      onSelect(basicAssets);
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [photos, selectedIds, convertToImagePickerAsset, onSelect, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderPhoto = useCallback(({ item, index }: { item: MediaAsset; index: number }) => {
    const isSelected = selectedIds.has(item.id);
    const aspectRatio = item.width / item.height;

    return (
      <TouchableOpacity
        style={[
          styles.photoContainer,
          { width: PHOTO_SIZE, height: PHOTO_SIZE },
        ]}
        onPress={() => togglePhotoSelection(index, false)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.uri }}
          style={[
            styles.photo,
            { width: PHOTO_SIZE, height: PHOTO_SIZE },
          ]}
          contentFit="cover"
          transition={200}
        />
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <View style={styles.checkmarkContainer}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#fff" />
            </View>
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedNumber}>
                {Array.from(selectedIds).indexOf(item.id) + 1}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedIds, togglePhotoSelection]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <StatusBar barStyle="light-content" />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Select Photos</Text>
          <TouchableOpacity
            onPress={handleDone}
            style={[
              styles.doneButton,
              (selectedIds.size === 0 || isLoading) && styles.doneButtonDisabled,
            ]}
            disabled={selectedIds.size === 0 || isLoading}
          >
            {isLoading ? (
              <Text style={styles.doneText}>Loading...</Text>
            ) : (
              <Text
                style={[
                  styles.doneText,
                  selectedIds.size === 0 && styles.doneTextDisabled,
                ]}
              >
                Done {selectedIds.size > 0 && `(${selectedIds.size})`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.content}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading photos...</Text>
              </View>
            ) : hasPermission === false ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={48} color="#999" />
                <Text style={styles.errorText}>Photo access is required</Text>
                <Text style={styles.errorSubtext}>
                  Please enable photo access in Settings
                </Text>
              </View>
            ) : photos.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="image-off" size={48} color="#999" />
                <Text style={styles.emptyText}>No photos found</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={photos}
                renderItem={renderPhoto}
                keyExtractor={(item) => item.id}
                numColumns={NUM_COLUMNS}
                contentContainerStyle={styles.photoGrid}
                showsVerticalScrollIndicator={false}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={5}
                onScroll={(evt) => {
                  scrollOffsetRef.current = evt.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
              />
            )}
          </View>
        </GestureDetector>

        {/* Instructions */}
        {!isLoading && hasPermission && photos.length > 0 && (
          <View style={styles.instructions}>
            <Text style={styles.instructionsText}>
              {isDragging
                ? 'Drag to select multiple photos'
                : 'Tap to select • Drag across photos to select multiple'}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    color: '#fff',
    fontSize: 17,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  doneButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  doneTextDisabled: {
    color: '#666',
  },
  content: {
    flex: 1,
  },
  photoGrid: {
    padding: 8,
  },
  photoContainer: {
    margin: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  photo: {
    borderRadius: 4,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    borderRadius: 4,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 4,
  },
  checkmarkContainer: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
  instructions: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
  },
  instructionsText: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
  },
});

