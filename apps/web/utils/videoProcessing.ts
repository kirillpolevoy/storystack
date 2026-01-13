/**
 * Video processing utilities for thumbnail extraction and metadata
 * Uses HTML5 video element + canvas for client-side frame extraction
 */

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

export interface VideoThumbnail {
  blob: Blob;
  timestamp: number;
}

const DEFAULT_THUMBNAIL_COUNT = 10;
const THUMBNAIL_WIDTH = 400; // Match image thumbnail width

/**
 * Check if a file is a video based on type or extension
 */
export function isVideoFile(file: File): boolean {
  const videoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
  const videoExtensions = ['.mp4', '.mov', '.webm'];

  if (videoTypes.includes(file.type)) return true;

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  return videoExtensions.includes(ext);
}

/**
 * Validate video file meets requirements
 */
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE_MB = 50;
  const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
  const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm'];

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `Invalid video format. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      };
    }
  }

  // Check file size
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_SIZE_MB) {
    return {
      valid: false,
      error: `Video too large (${sizeMB.toFixed(1)}MB). Maximum: ${MAX_SIZE_MB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Extract metadata from a video file
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Video metadata loading timed out'));
    }, 30000); // 30 second timeout

    video.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata'));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Extract thumbnail frames from video at evenly spaced intervals
 * Generates frames at 0%, 10%, 20%, ... 90% of video duration
 */
export async function extractVideoThumbnails(
  file: File,
  frameCount: number = DEFAULT_THUMBNAIL_COUNT,
  onProgress?: (progress: number) => void
): Promise<VideoThumbnail[]> {
  const metadata = await getVideoMetadata(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;

  // Calculate thumbnail dimensions maintaining aspect ratio
  const aspectRatio = metadata.width / metadata.height;
  const thumbWidth = THUMBNAIL_WIDTH;
  const thumbHeight = Math.round(thumbWidth / aspectRatio);

  const canvas = document.createElement('canvas');
  canvas.width = thumbWidth;
  canvas.height = thumbHeight;
  const ctx = canvas.getContext('2d')!;

  return new Promise((resolve, reject) => {
    const thumbnails: VideoThumbnail[] = [];
    let currentFrame = 0;

    // Calculate timestamps for each frame (0%, 10%, 20%, etc.)
    // Avoid exact 0 and 100% as they can be problematic
    const timestamps = Array.from({ length: frameCount }, (_, i) => {
      const percentage = i / frameCount;
      // Add small offset to avoid first/last frame issues
      return Math.max(0.1, metadata.duration * percentage);
    });

    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(video.src);
      // Return what we have so far if we timeout
      if (thumbnails.length > 0) {
        resolve(thumbnails);
      } else {
        reject(new Error('Video thumbnail extraction timed out'));
      }
    }, 60000); // 60 second timeout for full extraction

    const captureFrame = () => {
      if (currentFrame >= frameCount) {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(video.src);
        resolve(thumbnails);
        return;
      }

      const timestamp = timestamps[currentFrame];
      video.currentTime = timestamp;
    };

    video.onseeked = async () => {
      try {
        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);

        // Convert to blob
        const blob = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(
            (b) => {
              if (b) {
                res(b);
              } else {
                rej(new Error('Failed to create blob from canvas'));
              }
            },
            'image/jpeg',
            0.8
          );
        });

        thumbnails.push({
          blob,
          timestamp: timestamps[currentFrame],
        });

        currentFrame++;
        onProgress?.(Math.round((currentFrame / frameCount) * 100));
        captureFrame();
      } catch (error) {
        // Continue to next frame on error
        currentFrame++;
        onProgress?.(Math.round((currentFrame / frameCount) * 100));
        captureFrame();
      }
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(video.src);
      // Return what we have so far if we have any frames
      if (thumbnails.length > 0) {
        resolve(thumbnails);
      } else {
        reject(new Error('Failed to process video'));
      }
    };

    video.src = URL.createObjectURL(file);
    video.onloadeddata = () => captureFrame();
  });
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatVideoDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get a single thumbnail at a specific percentage of video duration
 * Useful for getting a cover image
 */
export async function getVideoThumbnailAt(
  file: File,
  percentage: number = 0.1
): Promise<Blob> {
  const metadata = await getVideoMetadata(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;

  const aspectRatio = metadata.width / metadata.height;
  const thumbWidth = THUMBNAIL_WIDTH;
  const thumbHeight = Math.round(thumbWidth / aspectRatio);

  const canvas = document.createElement('canvas');
  canvas.width = thumbWidth;
  canvas.height = thumbHeight;
  const ctx = canvas.getContext('2d')!;

  return new Promise((resolve, reject) => {
    const timestamp = Math.max(0.1, metadata.duration * percentage);

    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Video thumbnail extraction timed out'));
    }, 15000);

    video.onseeked = async () => {
      clearTimeout(timeoutId);
      try {
        ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(video.src);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          'image/jpeg',
          0.8
        );
      } catch (error) {
        URL.revokeObjectURL(video.src);
        reject(error);
      }
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video for thumbnail'));
    };

    video.src = URL.createObjectURL(file);
    video.onloadeddata = () => {
      video.currentTime = timestamp;
    };
  });
}
