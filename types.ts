export type Campaign = {
  id: string;
  user_id?: string | null;
  name: string;
  created_at: string;
};

export type AssetSource = 'local' | 'imported' | 'generated';

export type Asset = {
  id: string;
  campaign_id: string;
  storage_path: string;
  source: AssetSource;
  tags: string[];
  created_at: string;
  publicUrl?: string;
};

export type Sequence = {
  id: string;
  campaign_id: string;
  name: string;
  asset_order: string[];
  created_at: string;
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

