import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Asset } from '@/types';

async function ensureAlbum(name: string, asset: MediaLibrary.Asset) {
  try {
    const albums = await MediaLibrary.getAlbumsAsync();
    const existing = albums.find((album) => album.title === name);
    if (existing) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], existing, false);
      return existing;
    }
    return await MediaLibrary.createAlbumAsync(name, asset, false);
  } catch (error) {
    console.error('[ExportStory] Album operation failed:', error);
    // Don't throw - album creation is not critical for export
    return null;
  }
}

export async function exportStorySequence(selectedAssets: Asset[], storyName: string) {
  if (!selectedAssets.length) {
    Alert.alert('Nothing to export', 'Select at least one photo to export.');
    return;
  }

  if (!storyName.trim()) {
    Alert.alert('Story name required', 'Please enter a name for your story.');
    return;
  }

  if (!supabase) {
    Alert.alert('Error', 'Supabase is not configured. Cannot export photos.');
    return;
  }

  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permission needed',
      'StoryStack needs access to your media library to save the exported story.',
    );
    return;
  }

  try {
    const savedAssets: MediaLibrary.Asset[] = [];
    const errors: string[] = [];
    const albumName = storyName.trim();

    for (let i = 0; i < selectedAssets.length; i++) {
      const asset = selectedAssets[i];
      try {
        // Get public URL
        let publicUrl = asset.publicUrl;
        if (!publicUrl && asset.storage_path) {
          const { data } = supabase.storage.from('assets').getPublicUrl(asset.storage_path);
          publicUrl = data.publicUrl;
        }

        if (!publicUrl) {
          throw new Error(`No public URL available for asset ${asset.id}`);
        }

        // Determine file extension from storage_path or URL
        let extension = 'jpg';
        if (asset.storage_path) {
          const match = asset.storage_path.match(/\.([a-zA-Z0-9]+)$/);
          if (match) {
            extension = match[1].toLowerCase();
          }
        } else {
          // Try to get extension from URL
          const urlMatch = publicUrl.match(/\.([a-zA-Z0-9]+)(\?|$)/);
          if (urlMatch) {
            extension = urlMatch[1].toLowerCase();
          }
        }
        // Ensure valid image extension
        if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
          extension = 'jpg';
        }

        // Download image
        const tempPath = `${FileSystem.cacheDirectory}${asset.id}-${Date.now()}.${extension}`;
        console.log(`[ExportStory] Downloading ${i + 1}/${selectedAssets.length}: ${publicUrl}`);
        
        const download = await FileSystem.downloadAsync(publicUrl, tempPath);
        
        if (!download || !download.uri) {
          throw new Error('Download failed - no URI returned');
        }

        // Save to media library
        console.log(`[ExportStory] Saving to media library: ${download.uri}`);
        const saved = await MediaLibrary.createAssetAsync(download.uri);
        
        if (!saved) {
          throw new Error('Failed to create media library asset');
        }

        // Add to album
        await ensureAlbum(albumName, saved);
        savedAssets.push(saved);
        console.log(`[ExportStory] Successfully exported ${i + 1}/${selectedAssets.length}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[ExportStory] Failed to export asset ${asset.id}:`, errorMsg);
        errors.push(`Photo ${i + 1}: ${errorMsg}`);
      }
    }

    // Show results
    if (savedAssets.length === 0) {
      Alert.alert(
        'Export failed',
        `Could not export any photos.\n\nErrors:\n${errors.join('\n')}`,
        [{ text: 'OK' }],
      );
      return;
    }

    if (errors.length > 0) {
      Alert.alert(
        'Partial export',
        `Exported ${savedAssets.length} of ${selectedAssets.length} photos.\n\nErrors:\n${errors.join('\n')}`,
        [{ text: 'OK' }],
      );
    } else {
      // Auto-open Instagram after successful export
      setTimeout(() => {
        Linking.openURL('instagram://story-camera').catch(() => {
          Alert.alert(
            'Export complete',
            `Saved ${savedAssets.length} photos to the "${albumName}" album. Please open Instagram manually to create your story.`,
          );
        });
      }, 500);

      Alert.alert(
        'Export complete',
        `Saved ${savedAssets.length} photo${savedAssets.length === 1 ? '' : 's'} to the "${albumName}" album. Opening Instagram...`,
        [{ text: 'OK' }],
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ExportStory] Export failed:', errorMsg, error);
    Alert.alert(
      'Export failed',
      `Something went wrong while exporting:\n\n${errorMsg}\n\nPlease try again.`,
    );
  }
}

