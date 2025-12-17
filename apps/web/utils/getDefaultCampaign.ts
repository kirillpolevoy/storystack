import { createClient } from '@/lib/supabase/client'

const DEFAULT_CAMPAIGN_NAME = 'My Library'

/**
 * Gets or creates a default campaign for the library.
 * Returns the campaign ID to use for all library operations.
 * Matches mobile app behavior: each user gets their own "My Library" campaign.
 * 
 * @param userId - User ID (required)
 */
export async function getDefaultCampaignId(userId: string): Promise<string | null> {
  const supabase = createClient()

  console.log('[getDefaultCampaign] Getting default campaign for user:', userId)

  try {
    // Try to find existing default campaign for this user
    const { data: existing, error: findError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', userId)
      .eq('name', DEFAULT_CAMPAIGN_NAME)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!findError && existing) {
      console.log('[getDefaultCampaign] Found existing campaign:', existing.id)
      return existing.id
    }

    // Create default campaign if it doesn't exist for this user
    const { data: newCampaign, error: createError } = await supabase
      .from('campaigns')
      .insert({ 
        user_id: userId,
        name: DEFAULT_CAMPAIGN_NAME 
      })
      .select('id')
      .single()

    if (createError || !newCampaign) {
      console.error('[getDefaultCampaign] Failed to create default campaign', createError)
      return null
    }

    console.log('[getDefaultCampaign] Created new campaign:', newCampaign.id)
    return newCampaign.id
  } catch (error) {
    console.error('[getDefaultCampaign] Unexpected error', error)
    return null
  }
}

