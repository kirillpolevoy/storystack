import { Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type LibraryHeaderProps = {
  onMenuPress?: () => void;
  onTagManagementPress?: () => void;
  onProfilePress?: () => void;
  selectedCount?: number;
  isSelectionMode?: boolean;
  onEnterSelectionMode?: () => void;
  onCancelSelection?: () => void;
};

export function LibraryHeader({ 
  onMenuPress,
  onTagManagementPress, 
  onProfilePress,
  selectedCount = 0,
  isSelectionMode = false,
  onEnterSelectionMode,
  onCancelSelection,
}: LibraryHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
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
      {/* Main title and actions - Apple-style compact header */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-1">
          {isSelectionMode ? (
            <View className="flex-row items-center">
              <Text className="text-[22px] font-semibold text-gray-900" style={{ letterSpacing: -0.4 }}>
                {selectedCount === 0 ? 'Select Items' : `${selectedCount} ${selectedCount === 1 ? 'Photo' : 'Photos'}`}
              </Text>
            </View>
          ) : (
            <Text className="text-[28px] font-bold leading-[34px] tracking-[-0.5px] text-gray-900">
              Your Photos
            </Text>
          )}
        </View>
        
        {/* Action buttons - Right aligned, contextual */}
        {isSelectionMode ? (
          // Selection mode: Show Cancel
          <TouchableOpacity
            onPress={onCancelSelection}
            activeOpacity={0.6}
          >
            <Text className="text-[17px] font-semibold text-gray-900" style={{ letterSpacing: -0.3 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        ) : (
          // Normal mode: Show Select and Menu buttons
          <View className="flex-row items-center gap-2">
            {/* Select button - Apple-style prominent CTA */}
            {onEnterSelectionMode && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  // Call immediately without delay
                  onEnterSelectionMode();
                }}
                activeOpacity={0.7}
                style={{
                  backgroundColor: '#b38f5b',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  shadowColor: '#b38f5b',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text 
                  className="text-[16px] font-semibold text-white" 
                  style={{ 
                    letterSpacing: -0.2,
                  }}
                >
                  Select
                </Text>
              </TouchableOpacity>
            )}
            {/* Menu button - Hamburger menu */}
            {onMenuPress && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onMenuPress();
                }}
                activeOpacity={0.6}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: 'rgba(179, 143, 91, 0.1)',
                }}
              >
                <MaterialCommunityIcons
                  name="menu"
                  size={20}
                  color="#b38f5b"
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

