// Shared types for web app
export type Campaign = {
  id: string;
  user_id?: string | null;
  name: string;
  created_at: string;
};

export type AssetSource = 'local' | 'imported' | 'generated';

export type Asset = {
  id: string;
  user_id?: string;
  campaign_id?: string;
  storage_path: string;
  storage_path_preview?: string | null;
  storage_path_thumb?: string | null;
  source: AssetSource;
  tags: string[];
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

