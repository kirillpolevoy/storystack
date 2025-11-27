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
  campaign_id: string;
  storage_path: string;
  source: AssetSource;
  tags: string[];
  created_at: string;
  publicUrl?: string;
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

// Legacy tags (kept for backward compatibility)
export const BASE_TAGS = ['Product', 'Queens', 'Tali', 'Quotes', 'Testimonials'] as const;
export const BRAND_TAGS = ['Necklace', 'Earrings', 'Rings', 'Bracelets'] as const;

// New tag vocabulary for StoryStack
export const STORYSTACK_TAGS = [
  'Product',
  'Lifestyle',
  'Studio',
  'Bright',
  'Moody',
  'Onyx',
  'Layered Look',
  'Semi-Precious Stone',
  'Choker Statement',
  'Everyday Luxe',
  'Necklace Stack',
] as const;

export type TagVocabulary = string;

