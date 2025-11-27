import { Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type LibraryHeaderProps = {
  onMenuPress?: () => void;
  onTagManagementPress?: () => void;
  onProfilePress?: () => void;
  selectedCount?: number;
  onCancelSelection?: () => void;
};

export function LibraryHeader({ 
  onMenuPress,
  onTagManagementPress, 
  onProfilePress,
  selectedCount = 0,
  onCancelSelection,
}: LibraryHeaderProps) {
  const insets = useSafeAreaInsets();
  const isSelecting = selectedCount > 0;

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
          {isSelecting ? (
            <View className="flex-row items-center">
              <Text className="text-[22px] font-semibold text-gray-900" style={{ letterSpacing: -0.4 }}>
                {selectedCount} {selectedCount === 1 ? 'Photo' : 'Photos'}
              </Text>
            </View>
          ) : (
            <Text className="text-[28px] font-bold leading-[34px] tracking-[-0.5px] text-gray-900">
              Your Photos
            </Text>
          )}
        </View>
        
        {/* Action buttons - Right aligned, contextual */}
        {isSelecting ? (
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
          // Normal mode: Show menu button only
          <View className="flex-row items-center gap-2">
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

