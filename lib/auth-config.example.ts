// NextAuth Configuration Example for Microsoft OAuth
// This is a template. Copy to auth.ts and customize for production.

import NextAuth from 'next-auth';
import AzureAD from 'next-auth/providers/azure-ad';

const config = {
  providers: [
    AzureAD({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
    }),
  ],

  pages: {
    signIn: '/auth/login',
    error: '/atuh/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },

    async authorized({ request, auth }) {
      // Protect routes - check if user is authenticated
      if (
        !auth &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/api')
      ) {
        const loginUrl = new URL('/login', request.nextUrl.origin);
        loginUrl.searchParams.append('callbackUrl', request.nextUrl.href);
        return Response.redirect(loginUrl);
      }
      return true;
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Logging
  logger: {
    error(code, metadata) {
      console.error(code, metadata);
    },
    warn(code) {
      console.warn(code);
    },
    debug(code, metadata) {
      console.debug(code, metadata);
    },
  },

  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
