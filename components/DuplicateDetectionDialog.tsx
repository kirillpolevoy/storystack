import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  StyleSheet, 
  ScrollView, 
  Image, 
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

type DuplicatePhoto = {
  uri: string;
  index: number;
};

type DuplicateDetectionDialogProps = {
  visible: boolean;
  duplicateCount: number;
  totalCount: number;
  duplicatePhotos: DuplicatePhoto[];
  onProceed: () => void;
  onSkipDuplicates: () => void;
  onCancel: () => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DIALOG_MAX_WIDTH = Math.min(SCREEN_WIDTH - 20, 560);
const PHOTO_SIZE = 100;
const PHOTO_GAP = 8;

export function DuplicateDetectionDialog({
  visible,
  duplicateCount,
  totalCount,
  duplicatePhotos,
  onProceed,
  onSkipDuplicates,
  onCancel,
}: DuplicateDetectionDialogProps) {
  const uniqueCount = totalCount - duplicateCount;
  const showPhotos = duplicatePhotos.length > 0;
  const allDuplicates = duplicateCount === totalCount;
  
  // Animation values - refined timing
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const photoAnims = useRef(
    duplicatePhotos.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.88),
      translateY: new Animated.Value(16),
    }))
  ).current;
  const summaryAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.96);
      slideAnim.setValue(28);
      summaryAnim.setValue(0);
      buttonAnim.setValue(0);
      photoAnims.forEach(anim => {
        anim.opacity.setValue(0);
        anim.scale.setValue(0.88);
        anim.translateY.setValue(16);
      });

      // Refined entrance animation - Apple-like spring physics
      Animated.parallel([
        Animated.spring(fadeAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 40,
          friction: 9,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 40,
          friction: 9,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      // Staggered photo animations - refined timing
      photoAnims.forEach((anim, index) => {
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 300,
            delay: 150 + index * 30,
            useNativeDriver: true,
          }),
          Animated.spring(anim.scale, {
            toValue: 1,
            delay: 150 + index * 30,
            useNativeDriver: true,
            tension: 160,
            friction: 5,
          }),
          Animated.timing(anim.translateY, {
            toValue: 0,
            duration: 300,
            delay: 150 + index * 30,
            useNativeDriver: true,
          }),
        ]).start();
      });

      // Summary animation
      Animated.timing(summaryAnim, {
        toValue: 1,
        duration: 320,
        delay: 180 + duplicatePhotos.length * 30,
        useNativeDriver: true,
      }).start();

      // Button animation
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 320,
        delay: 220 + duplicatePhotos.length * 30,
        useNativeDriver: true,
      }).start();

      // Refined haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [visible]);

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  const handleSkipDuplicates = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSkipDuplicates();
  };

  const handleProceed = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onProceed();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]} />
        )}
        
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim },
              ],
            },
          ]}
        >
          <View style={[styles.dialog, { maxWidth: DIALOG_MAX_WIDTH }]}>
            {/* Refined Header - Apple-style minimalism */}
            <View style={styles.header}>
              <Animated.View 
                style={[
                  styles.iconContainer,
                  {
                    transform: [{ scale: scaleAnim }],
                  }
                ]}
              >
                <View style={[styles.iconBadge, allDuplicates && styles.iconBadgeWarning]}>
                  <MaterialCommunityIcons 
                    name={allDuplicates ? "alert-circle" : "information-outline"} 
                    size={32} 
                    color={allDuplicates ? "#f59e0b" : "#b38f5b"} 
                  />
                </View>
              </Animated.View>
              
              <Text style={styles.title}>
                {allDuplicates ? 'All Photos Are Duplicates' : 'Duplicate Photos Found'}
              </Text>
              <Text style={styles.subtitle}>
                {allDuplicates
                  ? `${duplicateCount} photo${duplicateCount > 1 ? 's' : ''} already exist in your library`
                  : `${duplicateCount} of ${totalCount} photo${totalCount > 1 ? 's' : ''} already exist`}
              </Text>
            </View>

            {/* Refined Photo Gallery */}
            {showPhotos && (
              <View style={styles.photoSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>Duplicate Photos</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{duplicateCount}</Text>
                  </View>
                </View>
                
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.photoGrid}
                  style={styles.photoScrollView}
                  decelerationRate="fast"
                  snapToInterval={PHOTO_SIZE + PHOTO_GAP}
                  snapToAlignment="start"
                >
                  {duplicatePhotos.map((photo, idx) => {
                    const anim = photoAnims[idx] || { 
                      opacity: new Animated.Value(1), 
                      scale: new Animated.Value(1),
                      translateY: new Animated.Value(0),
                    };
                    return (
                      <Animated.View
                        key={idx}
                        style={[
                          styles.photoWrapper,
                          {
                            opacity: anim.opacity,
                            transform: [
                              { scale: anim.scale },
                              { translateY: anim.translateY },
                            ],
                          },
                        ]}
                      >
                        <View style={styles.photoContainer}>
                          <Image 
                            source={{ uri: photo.uri }} 
                            style={styles.photo}
                            resizeMode="cover"
                          />
                          <View style={styles.duplicateBadge}>
                            <MaterialCommunityIcons name="check" size={11} color="#ffffff" />
                          </View>
                        </View>
                      </Animated.View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Apple-style Summary Card */}
            <Animated.View
              style={[
                styles.summaryContainer,
                {
                  opacity: summaryAnim,
                  transform: [
                    {
                      translateY: summaryAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {allDuplicates ? (
                <View style={styles.warningCard}>
                  <View style={styles.summaryRow}>
                    <MaterialCommunityIcons name="alert-circle" size={20} color="#ff9500" />
                    <View style={styles.summaryTextContainer}>
                      <Text style={styles.summaryText}>
                        Importing will create duplicate copies in your library
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#34C759" />
                    <View style={styles.summaryTextContainer}>
                      <Text style={styles.summaryText}>
                        {uniqueCount} new photo{uniqueCount > 1 ? 's' : ''} will be imported
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Refined Action Buttons */}
            <Animated.View
              style={[
                styles.actions,
                {
                  opacity: buttonAnim,
                  transform: [
                    {
                      translateY: buttonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Primary Action - Skip Duplicates (when mixed) or Import (when all duplicates) */}
              {!allDuplicates ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSkipDuplicates}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Skip Duplicates</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleProceed}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Import {duplicateCount}</Text>
                </TouchableOpacity>
              )}

              {/* Secondary Actions Row */}
              <View style={styles.secondaryActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  activeOpacity={0.6}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                {!allDuplicates && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleProceed}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>Import All</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
  },
  dialog: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.9,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.2,
        shadowRadius: 50,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  header: {
    padding: 36,
    paddingBottom: 32,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeWarning: {
    backgroundColor: '#FFF4E6',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -1.2,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 17,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  photoSection: {
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  photoScrollView: {
    marginHorizontal: -32,
    paddingHorizontal: 32,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: PHOTO_GAP,
    paddingRight: 32,
  },
  photoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  photoContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  duplicateBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff9500',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#ff9500',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  summaryContainer: {
    paddingHorizontal: 32,
    paddingBottom: 28,
  },
  summaryCard: {
    backgroundColor: '#F2FBF6',
    borderRadius: 16,
    padding: 16,
  },
  warningCard: {
    backgroundColor: '#FFF9F0',
    borderRadius: 16,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryTextContainer: {
    flex: 1,
    paddingTop: 1,
  },
  summaryText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  actions: {
    padding: 24,
    paddingTop: 28,
    backgroundColor: '#F9F9F9',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    backgroundColor: '#b38f5b',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#b38f5b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: '#fef3c7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fde68a',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: -0.2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    letterSpacing: -0.2,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
