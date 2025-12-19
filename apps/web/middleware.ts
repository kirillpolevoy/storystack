import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  console.log(`[Middleware] Top-level - Path: ${request.nextUrl.pathname}, Method: ${request.method}`)
  try {
    const response = await updateSession(request)
    console.log(`[Middleware] Top-level - Response status: ${response.status}, Redirect: ${response.headers.get('location') || 'none'}`)
    return response
  } catch (error) {
    console.error('[Middleware] Top-level error:', error)
    console.error('[Middleware] Top-level error pathname:', request.nextUrl.pathname)
    // Return a response to prevent middleware failure
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - opengraph-image (Open Graph image route)
     * - Static file extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}

