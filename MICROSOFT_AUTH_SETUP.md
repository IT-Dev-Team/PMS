# Microsoft Authentication Setup Guide

Complete guide to integrate Microsoft OAuth with NextAuth.js for EIH AI Assistant.

## Prerequisites

- Vercel account
- Microsoft Azure account
- GitHub repository connected to Vercel

## Step 1: Create Azure AD Application

### 1.1 Go to Azure Portal

1. Visit [Azure Portal](https://portal.azure.com/)
2. Sign in with your Microsoft account
3. Search for "App registrations" in the search bar
4. Click "New registration"

### 1.2 Register Application

Fill in the application details:

- **Name**: `EIH AI Assistant`
- **Supported account types**: Select "Accounts in this organizational directory only"
- **Redirect URI**: 
  - Platform: Web
  - URI: `http://localhost:3000/api/auth/callback/azure-ad` (development)
  - Also add: `https://yourdomain.vercel.app/api/auth/callback/azure-ad` (production)

Click "Register"

### 1.3 Copy Application Details

Save these values:
- **Application (client) ID** - shown on Overview page
- **Directory (tenant) ID** - shown on Overview page

### 1.4 Create Client Secret

1. Go to "Certificates & secrets" in the left menu
2. Click "New client secret"
3. Add description: "NextAuth secret"
4. Set expiration to 24 months
5. Click "Add"
6. **Copy the secret value immediately** (won't be shown again!)

### 1.5 Configure API Permissions

1. Go to "API permissions" in the left menu
2. Click "Add a permission"
3. Select "Microsoft Graph"
4. Select "Delegated permissions"
5. Check these permissions:
   - `openid`
   - `profile`
   - `email`
6. Click "Add permissions"

## Step 2: Install Dependencies

```bash
pnpm add next-auth@latest
```

## Step 3: Create Auth Configuration

Create a new file `auth.ts` in the root:

```typescript
import NextAuth from 'next-auth';
import AzureAD from 'next-auth/providers/azure-ad';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    AzureAD({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
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
      }
      return session;
    },
  },
});
```

## Step 4: Create Middleware

Create `middleware.ts`:

```typescript
export { auth as middleware } from '@/auth';

export const config = {
  matcher: [
    '/((?!_next|api(?:/auth)?|favicon.ico|public).*)',
  ],
};
```

## Step 5: Update Environment Variables

### Development (.env.local)

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
NEXT_PUBLIC_DEEPSEEK_API_KEY=your-deepseek-key
```

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### Production (Vercel)

1. Go to Vercel Project Settings → Environment Variables
2. Add the following variables:
   - `NEXTAUTH_URL`: `https://yourdomain.vercel.app`
   - `NEXTAUTH_SECRET`: Generate a new one
   - `MICROSOFT_CLIENT_ID`: From Azure
   - `MICROSOFT_CLIENT_SECRET`: From Azure
   - `MICROSOFT_TENANT_ID`: From Azure
   - `NEXT_PUBLIC_DEEPSEEK_API_KEY`: Your DeepSeek key

## Step 6: Update Login Component

Replace the demo login with NextAuth:

```typescript
'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function LoginPage() {
  const handleMicrosoftLogin = async () => {
    await signIn('azure-ad', {
      redirect: true,
      callbackUrl: '/',
    });
  };

  return (
    // Your login UI with handleMicrosoftLogin button click
  );
}
```

## Step 7: Protect Routes

### Option A: Using Middleware (Recommended)

Middleware will automatically redirect unauthenticated users to login.

### Option B: Using Session in Components

```typescript
'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function ProtectedPage() {
  const { data: session } = useSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div>
      Welcome, {session.user?.email}
    </div>
  );
}
```

## Step 8: Add Logout Functionality

```typescript
import { signOut } from 'next-auth/react';

export function LogoutButton() {
  return (
    <button onClick={() => signOut()}>
      Sign Out
    </button>
  );
}
```

## Step 9: Test Locally

```bash
pnpm dev
```

1. Go to http://localhost:3000
2. Click "Sign in with Microsoft"
3. Enter your Microsoft account credentials
4. Authorize the application
5. You should be redirected to the app

## Step 10: Deploy to Vercel

```bash
git add .
git commit -m "Add Microsoft OAuth authentication"
git push
```

Vercel will automatically deploy. Check deployment status in your Vercel dashboard.

## Troubleshooting

### "Invalid redirect_uri"
- Verify the redirect URI in Azure matches your Vercel URL
- Add both localhost and production URLs

### "unauthorized_client"
- Check client ID and secret are correct
- Verify API permissions are configured
- Check tenant ID is correct

### "NEXTAUTH_SECRET" error
- Ensure NEXTAUTH_SECRET is set in environment variables
- Generate new secret and update both local and Vercel

### Session not persisting
- Clear browser cookies
- Check browser console for errors
- Verify middleware configuration

### User not signing out
- Clear application cache
- Check NextAuth version is up to date
- Try in a different browser

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Rotate secrets regularly** - Change client secret every 6 months
3. **Use strong NEXTAUTH_SECRET** - Generate with cryptographic tools
4. **Enable MFA in Azure** - Add extra security layer
5. **Review permissions** - Only request needed scopes
6. **Monitor logs** - Check Azure sign-in logs for unusual activity
7. **Use HTTPS** - Always in production
8. **Implement rate limiting** - Prevent brute force attacks

## Advanced Configuration

### Custom Scopes

```typescript
AzureAD({
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  tenantId: process.env.MICROSOFT_TENANT_ID!,
  authorization: {
    params: {
      scope: 'openid profile email offline_access',
    },
  },
})
```

### Multi-Tenant Support

```typescript
tenantId: 'common', // Allow any Azure AD tenant
```

### Additional User Data

```typescript
async profile(profile) {
  return {
    id: profile.sub,
    name: profile.name,
    email: profile.email,
    image: profile.picture,
    // Add custom fields
    organization: profile.oid,
  };
}
```

## Resources

- [NextAuth.js Docs](https://next-auth.js.org/)
- [Azure AD Provider](https://next-auth.js.org/providers/azure-ad)
- [Azure Portal](https://portal.azure.com/)
- [Microsoft Graph API](https://docs.microsoft.com/graph/)

## Support

For authentication issues:
1. Check the troubleshooting section
2. Review Azure logs for sign-in attempts
3. Check NextAuth documentation
4. Search GitHub issues in next-auth repository
