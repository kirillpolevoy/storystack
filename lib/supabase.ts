import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SupabaseClient = ReturnType<typeof createClient>;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Supabase features will be disabled.',
    );
  } else {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storage: AsyncStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    
    // Suppress refresh token errors from Supabase auth (handled silently by AuthContext)
    // Only intercept Supabase-related auth errors, not all console errors
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const errorString = String(args[0] || '');
      // Only suppress Supabase auth refresh token errors
      const isSupabaseRefreshTokenError = 
        (errorString.includes('AuthApiError') || errorString.includes('[Supabase]')) &&
        (errorString.includes('Invalid Refresh Token') ||
         errorString.includes('Refresh Token Not Found') ||
         errorString.includes('refresh token not found') ||
         (errorString.toLowerCase().includes('refresh') && errorString.toLowerCase().includes('token')));
      
      // Suppress only Supabase refresh token errors - AuthContext handles them silently
      if (!isSupabaseRefreshTokenError) {
        originalConsoleError.apply(console, args);
      }
      // Otherwise silently ignore (AuthContext already handled it)
    };
    
    console.log('[Supabase] Client initialized successfully');
  }
} catch (error) {
  console.error('[Supabase] Failed to initialize client:', error);
  supabaseClient = null;
}

export const supabase = supabaseClient;

export type SupabaseClientType = typeof supabaseClient;

