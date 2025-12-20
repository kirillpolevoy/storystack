import { Image, View, Text, ActivityIndicator } from 'react-native';
import { Workspace } from '@/types';
import { getWorkspaceLogoUrl, getWorkspaceInitials } from '@/utils/workspaceHelpers';
import { useState } from 'react';

type WorkspaceAvatarProps = {
  workspace: Workspace | null;
  size?: number;
  showName?: boolean;
};

// Generate a consistent color for a workspace based on its ID
function getWorkspaceColor(workspaceId: string): string {
  // Simple hash function to generate consistent color
  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    hash = workspaceId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate a color from the hash (warm, professional colors)
  const hue = Math.abs(hash % 360);
  // Use a warm color palette (hue 0-60 and 300-360)
  const adjustedHue = hue < 60 ? hue : 300 + (hue - 60) % 60;
  
  // Convert to HSL and then to a nice color
  // Using a fixed saturation and lightness for consistency
  const saturation = 65;
  const lightness = 50;
  
  // Convert HSL to RGB (simplified)
  const h = adjustedHue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  if (h < 1/6) {
    r = c; g = x; b = 0;
  } else if (h < 2/6) {
    r = x; g = c; b = 0;
  } else if (h < 3/6) {
    r = 0; g = c; b = x;
  } else if (h < 4/6) {
    r = 0; g = x; b = c;
  } else if (h < 5/6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return `rgb(${r}, ${g}, ${b})`;
}

export function WorkspaceAvatar({ workspace, size = 32, showName = false }: WorkspaceAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  if (!workspace) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#e5e7eb',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: size * 0.4,
            fontWeight: '600',
            color: '#6b7280',
          }}
        >
          ?
        </Text>
      </View>
    );
  }

  const logoUrl = workspace.logo_path ? getWorkspaceLogoUrl(workspace.logo_path) : null;
  const initials = getWorkspaceInitials(workspace.name);
  const backgroundColor = getWorkspaceColor(workspace.id);

  return (
    <View className="flex-row items-center gap-2">
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: logoUrl && !imageError ? 'transparent' : backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {logoUrl && !imageError ? (
          <>
            {imageLoading && (
              <View
                style={{
                  position: 'absolute',
                  width: size,
                  height: size,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: backgroundColor,
                }}
              >
                <ActivityIndicator size="small" color="#ffffff" />
              </View>
            )}
            <Image
              source={{ uri: logoUrl }}
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
              }}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              onLoad={() => {
                setImageLoading(false);
              }}
            />
          </>
        ) : (
          <Text
            style={{
              fontSize: size * 0.4,
              fontWeight: '600',
              color: '#ffffff',
            }}
          >
            {initials}
          </Text>
        )}
      </View>
      {showName && (
        <Text
          className="text-[16px] font-semibold text-gray-900"
          style={{ letterSpacing: -0.2 }}
          numberOfLines={1}
        >
          {workspace.name}
        </Text>
      )}
    </View>
  );
}



