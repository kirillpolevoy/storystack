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
      // For first-time onboarding, navigate to home (no back stack)
      router.replace('/');
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

