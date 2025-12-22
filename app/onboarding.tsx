import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Onboarding } from '@/components/Onboarding';
import { markOnboardingCompleted } from '@/utils/onboarding';
import { useAuth } from '@/contexts/AuthContext';

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ skipCompletion?: string }>();
  const { session } = useAuth();
  const [isFirstTime, setIsFirstTime] = useState(true);

  useEffect(() => {
    // Check if this is first-time onboarding or viewing from menu
    const skipCompletion = params.skipCompletion === 'true';
    setIsFirstTime(!skipCompletion);
  }, [params]);

  const handleComplete = async () => {
    // Only mark as completed if this is first-time onboarding
    if (isFirstTime && session) {
      await markOnboardingCompleted(session.user.id);
      // For first-time onboarding, redirect to tag setup first
      // Check if user already has tags set up in any workspace
      const { hasTagsSetUp } = await import('@/utils/tagSetup');
      // Check if user has tags in any workspace they belong to
      const { supabase } = await import('@/lib/supabase');
      let hasTags = false;
      
      if (supabase) {
        try {
          // Get user's workspaces
          const { data: memberships } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', session.user.id)
            .limit(10);
          
          if (memberships && memberships.length > 0) {
            // Check if any workspace has tags
            for (const membership of memberships) {
              const workspaceId = (membership as { workspace_id: string }).workspace_id;
              if (workspaceId) {
                const workspaceHasTags = await hasTagsSetUp(workspaceId, session.user.id);
                if (workspaceHasTags) {
                  hasTags = true;
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.warn('[Onboarding] Error checking for tags:', error);
        }
      }
      
      if (!hasTags) {
        // Redirect to tag management for setup
        router.replace('/tag-management?setup=true');
      } else {
        // User already has tags, go to library
        router.replace('/');
      }
    } else {
      // For menu access, navigate to home instead of going back
      // This prevents the GO_BACK error when there's no previous screen
      router.replace('/');
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!session) {
      router.replace('/login');
    }
  }, [session]);

  if (!session) {
    return null;
  }

  return <Onboarding visible={true} onComplete={handleComplete} />;
}

