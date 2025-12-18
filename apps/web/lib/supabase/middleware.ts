import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  console.log(`[Middleware] Processing request: ${pathname}`)
  
  try {
    // Check for required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log(`[Middleware] Env check - URL: ${!!supabaseUrl}, Key: ${!!supabaseAnonKey}`)

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Middleware] Missing Supabase environment variables')
      // If env vars are missing, handle routing manually
      
      // Redirect root to login
      if (pathname === '/') {
        console.log('[Middleware] Redirecting root (/) to /login (no env vars)')
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
      
      // Block protected routes
      if (pathname.startsWith('/app')) {
        console.log(`[Middleware] Blocking protected route: ${pathname} (no env vars)`)
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
      
      // Allow public routes (login, logout, static assets) to proceed
      console.log(`[Middleware] Allowing public route: ${pathname} (no env vars)`)
      return NextResponse.next({ request })
    }

    let supabaseResponse = NextResponse.next({
      request,
    })

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            try {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
              supabaseResponse = NextResponse.next({
                request,
              })
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              )
            } catch (error) {
              console.error('[Middleware] Error setting cookies:', error)
            }
          },
        },
      }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it so that the
    // middleware constantly redirects users.

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('[Middleware] Auth error:', authError)
      // Continue with unauthenticated user
    }

  // Allow access to login page, logout, static assets, and root
  console.log(`[Middleware] Pathname: ${pathname}, User: ${!!user}`)
  
  // Handle root path
  if (pathname === '/') {
    console.log('[Middleware] Handling root path (/), user:', !!user)
    if (!user) {
      console.log('[Middleware] Redirecting root (/) to /login (no user)')
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    } else {
      console.log('[Middleware] Redirecting root (/) to /app/library (has user)')
      const url = request.nextUrl.clone()
      url.pathname = '/app/library'
      return NextResponse.redirect(url)
    }
  }
  
  // Allow login and logout pages
  if (pathname === '/login' || pathname.startsWith('/logout')) {
    console.log(`[Middleware] Allowing ${pathname} page`)
    // Redirect authenticated users away from login
    if (user && pathname === '/login') {
      console.log('[Middleware] Redirecting authenticated user away from /login')
      const url = request.nextUrl.clone()
      url.pathname = '/app/library'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }
  
  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    console.log(`[Middleware] Allowing static asset: ${pathname}`)
    return supabaseResponse
  }

  // Protect /app routes
  if (!user && pathname.startsWith('/app')) {
    console.log(`[Middleware] Blocking protected route: ${pathname} (no user)`)
    // no user, redirect to login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login page
  if (user && pathname === '/login') {
    console.log('[Middleware] Redirecting authenticated user away from /login')
    const url = request.nextUrl.clone()
    url.pathname = '/app/library'
    return NextResponse.redirect(url)
  }
  
  console.log(`[Middleware] Allowing route: ${pathname}`)

    // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
    // creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely.

    return supabaseResponse
  } catch (error) {
    console.error('[Middleware] Unexpected error:', error)
    console.error('[Middleware] Error pathname:', pathname)
    console.error('[Middleware] Error stack:', error instanceof Error ? error.stack : 'No stack')
    // Return a response to prevent middleware failure
    return NextResponse.next({ request })
  }
}

