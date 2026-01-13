// Shared types for web app
export type Campaign = {
  id: string;
  user_id?: string | null;
  name: string;
  created_at: string;
};

export type AssetSource = 'local' | 'imported' | 'generated';

export type AssetType = 'image' | 'video';

export type AssetRating = 'approved' | 'maybe' | 'rejected';

export type Asset = {
  id: string;
  user_id?: string;
  campaign_id?: string;
  storage_path: string;
  storage_path_preview?: string | null;
  storage_path_thumb?: string | null;
  source: AssetSource;
  tags: string[] | null;
  created_at: string;
  publicUrl?: string;
  previewUrl?: string;
  thumbUrl?: string;
  auto_tag_status?: 'pending' | 'failed' | 'completed' | null;
  openai_batch_id?: string | null;
  location?: string | null;
  file_hash?: string | null;
  date_taken?: string | null; // Date when photo was taken (from EXIF)
  original_filename?: string | null; // Original filename from upload
  // Story membership data (from asset_story_summary view)
  story_ids?: string[];
  story_names?: string[];
  story_count?: number;
  // Video fields
  asset_type?: AssetType;
  thumbnail_frames?: string[] | null; // Array of storage paths for video thumbnails
  thumbnailFrameUrls?: string[]; // Computed public URLs for thumbnail frames
  video_duration_seconds?: number | null;
  video_width?: number | null;
  video_height?: number | null;
  // Rating fields
  rating?: AssetRating | null;
  rating_note?: string | null;
  rated_at?: string | null;
  rated_by?: string | null;
};

export type Sequence = {
  id: string;
  user_id: string;
  campaign_id: string;
  name: string;
  asset_order: string[];
  created_at: string;
};

export type Story = {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  post_text?: string | null;
  cover_asset_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type StoryAsset = {
  id: string;
  story_id: string;
  asset_id: string;
  order_index: number;
  created_at: string;
};

export type StoryWithAssets = Story & {
  assets: Asset[];
  asset_count: number;
};

export type TagVocabulary = string;

// Review link for client approval
export type ReviewLink = {
  id: string;
  workspace_id: string;
  name: string;
  allowed_tags: string[];
  allowed_asset_ids: string[];
  expires_at?: string | null;
  is_active: boolean;
  allow_rating: boolean;
  allow_notes: boolean;
  created_by: string;
  created_at: string;
};

// Story share link
export type StoryLink = {
  id: string;
  story_id: string;
  name: string;
  expires_at?: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  view_count: number;
};

