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
    console.log('[Supabase] Client initialized successfully');
  }
} catch (error) {
  console.error('[Supabase] Failed to initialize client:', error);
  supabaseClient = null;
}

export const supabase = supabaseClient;

export type SupabaseClientType = typeof supabaseClient;

