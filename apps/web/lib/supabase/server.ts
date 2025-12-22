import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = `Missing Supabase environment variables. URL: ${!!supabaseUrl}, Key: ${!!supabaseAnonKey}`
    console.error('[createClient]', errorMsg)
    console.error('[createClient] Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))
    throw new Error(errorMsg)
  }

  try {
    const cookieStore = await cookies()

    return createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            try {
              return cookieStore.getAll()
            } catch (error) {
              console.error('[createClient] Error getting cookies:', error)
              return []
            }
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
              console.error('[createClient] Error setting cookies:', error)
            }
          },
        },
      }
    )
  } catch (error) {
    console.error('[createClient] Error creating Supabase client:', error)
    // Re-throw with more context
    throw new Error(`Failed to create Supabase client: ${error instanceof Error ? error.message : String(error)}`)
  }
}

