import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Simply check if token cookie exists (don't verify)
  const token = request.cookies.get('token')?.value
  
  const pathname = request.nextUrl.pathname
  
  // Public routes (no authentication required)
  const isPublicRoute = pathname === '/' ||
                        pathname === '/auth/login' ||
                        pathname === '/auth/signup' ||
                        pathname.startsWith('/_next') ||
                        pathname.startsWith('/api/auth/login') ||
                        pathname.startsWith('/api/auth/register') ||
                        pathname.startsWith('/api/auth/create-test-user') ||
                        pathname.startsWith('/api/test-db')
  
  // Protected routes
  const isProtectedRoute = pathname.startsWith('/chat') ||
                           pathname.startsWith('/api/chats')
  
  // Redirect if accessing protected route without token
  if (isProtectedRoute && !token && !isPublicRoute) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/api/chats/:path*',
    '/auth/:path*',
  ],
}