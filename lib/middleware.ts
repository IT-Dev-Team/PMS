// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const path = request.nextUrl.pathname;

  // Public routes
  const publicPaths = ['/login', '/register', '/api/auth'];
  if (publicPaths.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Check authentication
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based routing
  const role = token.role as string;
  const pathSegments = path.split('/').filter(Boolean);
  
  // Define role-specific path patterns
  const rolePaths: Record<string, string[]> = {
    CEO: ['/ceo', '/governance', '/reports', '/admin'],
    PORTFOLIO_MANAGER: ['/portfolio', '/procurement', '/reports', '/admin'],
    PROJECT_MANAGER: ['/pm', '/projects', '/tasks', '/risks'],
    FINANCE: ['/finance', '/reports/financial'],
    PROCUREMENT: ['/procurement', '/vendors'],
    BOARD_MEMBER: ['/governance/board', '/reports'],
    TEAM_MEMBER: ['/tasks', '/projects'],
  };

  const allowedPaths = rolePaths[role] || [];
  const isAllowed = allowedPaths.some(p => path.startsWith(p));
  
  if (!isAllowed && path !== '/') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};