import { supabase } from '@/lib/supabase';
import { Campaign } from '@/types';

const DEFAULT_CAMPAIGN_NAME = 'My Library';

/**
 * Gets or creates a default campaign for the library.
 * Returns the campaign ID to use for all library operations.
 */
export async function getDefaultCampaignId(): Promise<string> {
  if (!supabase) {
    // Fallback ID when Supabase is not configured
    return 'fallback-library';
  }

  try {
    // Try to find existing default campaign
    const { data: existing, error: findError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('name', DEFAULT_CAMPAIGN_NAME)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!findError && existing) {
      return existing.id;
    }

    // Create default campaign if it doesn't exist
    const { data: newCampaign, error: createError } = await supabase
      .from('campaigns')
      .insert({ name: DEFAULT_CAMPAIGN_NAME })
      .select('id')
      .single();

    if (createError || !newCampaign) {
      console.error('[getDefaultCampaign] Failed to create default campaign', createError);
      // Return a fallback ID
      return 'fallback-library';
    }

    return newCampaign.id;
  } catch (error) {
    console.error('[getDefaultCampaign] Unexpected error', error);
    return 'fallback-library';
  }
}



