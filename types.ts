// ============================================================================
// WORKSPACE TYPES
// ============================================================================

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type WorkspaceStatus = 'active' | 'archived' | 'deleted';

export type Workspace = {
  id: string;
  name: string;
  logo_path?: string | null;
  logo_updated_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: WorkspaceStatus;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  created_by?: string | null;
};

export type Tag = {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// LEGACY TYPES (kept for backward compatibility during migration)
// ============================================================================

export type Campaign = {
  id: string;
  user_id?: string | null;
  name: string;
  created_at: string;
};

// ============================================================================
// ASSET TYPES
// ============================================================================

export type AssetSource = 'local' | 'imported' | 'generated';

export type Asset = {
  id: string;
  user_id?: string;
  workspace_id: string; // Required - workspace owns the asset
  storage_path: string;
  source: AssetSource;
  // Tags are now via join table (asset_tags), not array
  // Use getAllAvailableTags() and asset_tags join to get tags
  created_at: string;
  publicUrl?: string;
  auto_tag_status?: 'pending' | 'failed' | 'completed' | null;
  openai_batch_id?: string | null; // OpenAI Batch API batch_id for async processing (20+ images)
  location?: string | null; // City name where photo was taken (from EXIF or manually entered)
  deleted_at?: string | null; // Soft delete timestamp
  deleted_by?: string | null; // User who soft-deleted the asset
  // Story membership data (from asset_story_summary view)
  story_ids?: string[];
  story_names?: string[];
  story_count?: number;
  // Legacy: tags array kept for backward compatibility during migration
  // Will be removed after full migration to normalized tags
  tags?: string[];
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
  workspace_id: string; // Required - workspace owns the story
  name: string;
  description?: string | null;
  post_text?: string | null; // Text content associated with the story/post that will be included in zip downloads
  cover_asset_id?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null; // Soft delete timestamp
  deleted_by?: string | null; // User who soft-deleted the story
};

export type StoryAsset = {
  id: string;
  story_id: string;
  asset_id: string;
  order_index: number;
  created_at: string;
  added_by?: string | null; // User who added asset to story
  added_at?: string | null; // When asset was added to story
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

// ============================================================================
// USER PREFERENCES TYPES
// ============================================================================

export type UserPreferences = {
  user_id: string;
  active_workspace_id?: string | null;
  updated_at: string;
};

