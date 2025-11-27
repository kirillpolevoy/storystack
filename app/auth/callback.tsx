import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase email confirmation links come with token_hash and type as query params
        // They can come from either URL params or deep link
        let token_hash: string | undefined;
        let type: string | undefined;

        // Check URL params first (from deep link)
        if (params.token_hash && params.type) {
          token_hash = params.token_hash as string;
          type = params.type as string;
        } else {
          // Try to get from the initial URL if available
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) {
            const url = new URL(initialUrl);
            token_hash = url.searchParams.get('token_hash') || undefined;
            type = url.searchParams.get('type') || undefined;
          }
        }

        // Also check if params are passed as arrays (expo-router sometimes does this)
        if (!token_hash && Array.isArray(params.token_hash)) {
          token_hash = params.token_hash[0];
        }
        if (!type && Array.isArray(params.type)) {
          type = params.type[0];
        }

        if (!token_hash || !type) {
          console.log('[AuthCallback] Missing params:', { token_hash, type, params });
          setStatus('error');
          setMessage('Invalid confirmation link. Please try signing up again.');
          setTimeout(() => router.replace('/signup'), 2000);
          return;
        }

        // Verify the email using the token
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token_hash,
          type: type as 'email' | 'signup' | 'recovery' | 'email_change',
        });

        if (error) {
          console.error('[AuthCallback] Verification error:', error);
          setStatus('error');
          setMessage(error.message || 'Failed to verify email. The link may have expired.');
          setTimeout(() => router.replace('/signup'), 3000);
          return;
        }

        // Success - email verified
        setStatus('success');
        setMessage('Email verified successfully!');

        // Wait a moment then redirect to login
        setTimeout(() => {
          router.replace('/login');
        }, 1500);
      } catch (error) {
        console.error('[AuthCallback] Unexpected error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try signing up again.');
        setTimeout(() => router.replace('/signup'), 2000);
      }
    };

    handleAuthCallback();
  }, [params, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa', padding: 20 }}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color="#b38f5b" />
          <Text style={{ marginTop: 20, fontSize: 16, color: '#374151', textAlign: 'center' }}>
            {message}
          </Text>
        </>
      )}

      {status === 'success' && (
        <>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#b38f5b', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 32, color: '#ffffff' }}>✓</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8, textAlign: 'center' }}>
            Email Verified!
          </Text>
          <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center' }}>
            {message}
          </Text>
        </>
      )}

      {status === 'error' && (
        <>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 32, color: '#ffffff' }}>✕</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8, textAlign: 'center' }}>
            Verification Failed
          </Text>
          <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
            {message}
          </Text>
          <Text
            style={{ fontSize: 15, color: '#b38f5b', fontWeight: '600', textAlign: 'center' }}
            onPress={() => router.replace('/login')}
          >
            Go to Login
          </Text>
        </>
      )}
    </View>
  );
}

