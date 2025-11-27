import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const ONBOARDING_COMPLETED_KEY = '@storystack:onboarding_completed';

/**
 * Get the onboarding key for a specific user
 */
function getOnboardingKey(userId: string | null): string {
  if (userId) {
    return `${ONBOARDING_COMPLETED_KEY}:${userId}`;
  }
  return ONBOARDING_COMPLETED_KEY;
}

/**
 * Check if the user has completed onboarding
 */
export async function hasCompletedOnboarding(userId?: string | null): Promise<boolean> {
  try {
    // Try to get userId from session if not provided
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;
      } catch (error) {
        console.error('[Onboarding] Error getting user:', error);
        // Fall back to device-specific check if we can't get user
        const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        return value === 'true';
      }
    }
    
    const key = getOnboardingKey(currentUserId);
    const value = await AsyncStorage.getItem(key);
    console.log('[Onboarding] Checking onboarding for user:', currentUserId, 'result:', value === 'true');
    return value === 'true';
  } catch (error) {
    console.error('[Onboarding] Error checking onboarding status:', error);
    return false;
  }
}

/**
 * Mark onboarding as completed
 */
export async function markOnboardingCompleted(userId?: string | null): Promise<void> {
  try {
    // Try to get userId from session if not provided
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;
      } catch (error) {
        console.error('[Onboarding] Error getting user:', error);
        // Fall back to device-specific storage if we can't get user
        await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
        return;
      }
    }
    
    const key = getOnboardingKey(currentUserId);
    await AsyncStorage.setItem(key, 'true');
    console.log('[Onboarding] Marked onboarding as completed for user:', currentUserId);
  } catch (error) {
    console.error('[Onboarding] Error marking onboarding as completed:', error);
  }
}

/**
 * Reset onboarding status (useful for testing or if user wants to see it again)
 */
export async function resetOnboarding(userId?: string | null): Promise<void> {
  try {
    // Try to get userId from session if not provided
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;
      } catch (error) {
        console.error('[Onboarding] Error getting user:', error);
        // Fall back to device-specific storage if we can't get user
        await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
        return;
      }
    }
    
    const key = getOnboardingKey(currentUserId);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('[Onboarding] Error resetting onboarding:', error);
  }
}

