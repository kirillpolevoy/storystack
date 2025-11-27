import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';
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
    console.error('[DownloadStory] Album operation failed:', error);
    return null;
  }
}

export async function exportStorySequence(selectedAssets: Asset[], storyName: string) {
  if (!selectedAssets.length) {
    Alert.alert('Nothing to download', 'Select at least one photo to download.');
    return;
  }

  if (!supabase) {
    Alert.alert('Error', 'Supabase is not configured. Cannot download photos.');
    return;
  }

  // Request media library permission
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permission needed',
      'StoryStack needs access to your media library to save photos.',
    );
    return;
  }

  try {
    const savedAssets: MediaLibrary.Asset[] = [];
    const errors: string[] = [];
    const albumName = storyName.trim();

    // Download and save all images
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

        // Determine file extension
        let extension = 'jpg';
        if (asset.storage_path) {
          const match = asset.storage_path.match(/\.([a-zA-Z0-9]+)$/);
          if (match) {
            extension = match[1].toLowerCase();
          }
        } else {
          const urlMatch = publicUrl.match(/\.([a-zA-Z0-9]+)(\?|$)/);
          if (urlMatch) {
            extension = urlMatch[1].toLowerCase();
          }
        }
        if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
          extension = 'jpg';
        }

        // Download image
        const tempPath = `${FileSystem.cacheDirectory}${asset.id}-${Date.now()}.${extension}`;
        const download = await FileSystem.downloadAsync(publicUrl, tempPath);
        
        if (!download || !download.uri) {
          throw new Error('Download failed - no URI returned');
        }

        // Save to media library
        const saved = await MediaLibrary.createAssetAsync(download.uri);
        if (!saved) {
          throw new Error('Failed to create media library asset');
        }

        // Add to album
        await ensureAlbum(albumName, saved);
        savedAssets.push(saved);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[DownloadStory] Failed to download asset ${asset.id}:`, errorMsg);
        errors.push(`Photo ${i + 1}: ${errorMsg}`);
      }
    }

    // Show results
    if (savedAssets.length === 0) {
      Alert.alert(
        'Download failed',
        `Could not download any photos.\n\nErrors:\n${errors.join('\n')}`,
        [{ text: 'OK' }],
      );
      return;
    }

    if (errors.length > 0) {
      Alert.alert(
        'Partial download',
        `Downloaded ${savedAssets.length} of ${selectedAssets.length} photos to the "${albumName}" album.\n\nErrors:\n${errors.join('\n')}`,
        [{ text: 'OK' }],
      );
    } else {
      Alert.alert(
        'Download complete',
        `Saved ${savedAssets.length} photo${savedAssets.length === 1 ? '' : 's'} to the "${albumName}" album in your photo library.`,
        [{ text: 'OK' }],
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DownloadStory] Download failed:', errorMsg, error);
    Alert.alert(
      'Download failed',
      `Something went wrong while downloading:\n\n${errorMsg}\n\nPlease try again.`,
    );
  }
}

