import { supabase } from '@/lib/supabase';
import { Campaign } from '@/types';

const DEFAULT_CAMPAIGN_NAME = 'My Library';

/**
 * Gets or creates a default campaign for the library.
 * Returns the campaign ID to use for all library operations.
 * Now user-specific: each user gets their own "My Library" campaign.
 * 
 * @param userId - User ID from AuthContext (optional, will fetch if not provided)
 */
export async function getDefaultCampaignId(userId?: string): Promise<string | null> {
  if (!supabase) {
    // No Supabase - return null, caller should handle
    console.warn('[getDefaultCampaign] Supabase not configured');
    return null;
  }

  // Use provided userId - require it to avoid refresh token errors
  if (!userId) {
    console.error('[getDefaultCampaign] userId is required. Pass it from AuthContext to avoid refresh token errors.');
    return null;
  }
  
  const finalUserId = userId;

  console.log('[getDefaultCampaign] User authenticated:', finalUserId);

  try {
    // Try to find existing default campaign for this user
    const { data: existing, error: findError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', finalUserId)
      .eq('name', DEFAULT_CAMPAIGN_NAME)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!findError && existing) {
      return existing.id;
    }

    // Create default campaign if it doesn't exist for this user
    const { data: newCampaign, error: createError } = await supabase
      .from('campaigns')
      .insert({ 
        user_id: finalUserId,
        name: DEFAULT_CAMPAIGN_NAME 
      })
      .select('id')
      .single();

    if (createError || !newCampaign) {
      console.error('[getDefaultCampaign] Failed to create default campaign', createError);
      return null;
    }

    return newCampaign.id;
  } catch (error) {
    console.error('[getDefaultCampaign] Unexpected error', error);
    return null;
  }
}




