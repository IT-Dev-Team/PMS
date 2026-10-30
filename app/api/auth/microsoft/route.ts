// app/api/auth/microsoft/route.ts
import { NextRequest, NextResponse } from 'next/server'

// ========== Configuration ==========
const MICROSOFT_CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!
// Use the specific tenant ID from environment, not "common"
const MICROSOFT_TENANT_ID = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || process.env.MICROSOFT_TENANT_ID
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

// ========== Helper Functions ==========
function generateState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ========== GET Handler ==========
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const redirect = searchParams.get('redirect') || '/dashboard'
  
  // Validate that we have a tenant ID
  if (!MICROSOFT_TENANT_ID || MICROSOFT_TENANT_ID === 'common') {
    console.error('❌ Microsoft Tenant ID is required. Please set NEXT_PUBLIC_MICROSOFT_TENANT_ID in your environment variables.')
    return NextResponse.redirect(
      `${BASE_URL}/login?error=missing_tenant_id`
    )
  }
  
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  
  // Use the specific tenant ID instead of "common"
  const authUrl = new URL(`https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`)
  authUrl.searchParams.append('client_id', MICROSOFT_CLIENT_ID)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('redirect_uri', `${BASE_URL}/api/auth/callback`)
  authUrl.searchParams.append('scope', 'openid profile email offline_access')
  authUrl.searchParams.append('state', state)
  authUrl.searchParams.append('code_challenge', codeChallenge)
  authUrl.searchParams.append('code_challenge_method', 'S256')
  
  const response = NextResponse.redirect(authUrl.toString())
  
  response.cookies.set('code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  
  response.cookies.set('oauth_redirect', redirect, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  
  return response
}