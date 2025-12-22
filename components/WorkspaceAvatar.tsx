import { Image, View, Text, ActivityIndicator } from 'react-native';
import { Workspace } from '@/types';
import { getWorkspaceLogoUrl, getWorkspaceInitials } from '@/utils/workspaceHelpers';
import { useState } from 'react';

type WorkspaceAvatarProps = {
  workspace: Workspace | null;
  size?: number;
  showName?: boolean;
};

// Apple-style color system: Systematic HSL-based palette ensuring clear distinction
// Base accent: #b38f5b (HSL: ~35°, 35%, 53%) - warm gold
// Strategy: Wider hue range (15-55°) with varied lightness (40-65%) for maximum distinction
// Maintains warm, earthy feel while ensuring each workspace is clearly identifiable
function getWorkspaceColor(workspaceId: string): string {
  // Curated palette with wider hue variation and varied lightness for clear distinction
  // Each color is perceptually distinct while staying within warm gold/bronze/amber/terracotta family
  // Format: {hue, saturation, lightness} in HSL
  const palette = [
    { h: 35, s: 35, l: 53 },   // Base: #b38f5b (warm gold) - app accent
    { h: 18, s: 45, l: 48 },   // Terracotta: #b86d4e (warmer, more orange)
    { h: 45, s: 40, l: 58 },   // Bright amber: #d4a85a (yellower)
    { h: 25, s: 42, l: 42 },   // Deep rust: #9e6b4e (darker, redder)
    { h: 38, s: 36, l: 65 },   // Light honey: #d8b070 (lighter, warmer)
    { h: 30, s: 38, l: 52 },   // Warm caramel: #b9875f (medium)
    { h: 15, s: 38, l: 45 },   // Burnt sienna: #9e6b52 (darker, more red)
    { h: 42, s: 34, l: 60 },   // Butterscotch: #c9a068 (lighter, yellow)
    { h: 22, s: 40, l: 44 },   // Dark amber: #9b6f4e (darker)
    { h: 36, s: 33, l: 62 },   // Golden tan: #d0a46c (light)
    { h: 20, s: 35, l: 40 },   // Deep brown: #916948 (very dark)
    { h: 40, s: 36, l: 56 },   // Light bronze: #c19a64 (medium-light)
    { h: 28, s: 34, l: 47 },   // Coffee: #a07852 (medium-dark)
    { h: 48, s: 38, l: 59 },   // Warm beige: #c9a066 (light, yellow)
    { h: 32, s: 36, l: 43 },   // Chestnut: #96704e (dark)
  ];
  
  // Simple hash function to generate consistent index
  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    hash = workspaceId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Select a distinct color from the palette
  const index = Math.abs(hash) % palette.length;
  const color = palette[index];
  
  // Convert HSL to RGB
  const h = color.h / 360;
  const s = color.s / 100;
  const l = color.l / 100;
  
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



