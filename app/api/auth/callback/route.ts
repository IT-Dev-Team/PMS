// app/api/auth/microsoft/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

// ========== Configuration ==========
const JWT_SECRET = process.env.JWT_SECRET || 'your-eih-super-secret-key-minimum-32-characters'
const MICROSOFT_CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '8f155ce1-2edc-49d7-8e8b-7ed4181b1d3e'
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || 'ixH8Q~mi6Q4IJfLSmB4GM4GftwzgbyzyPpfinbSp'
const MICROSOFT_TENANT_ID = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || process.env.MICROSOFT_TENANT_ID || '01749f33-f17c-4886-bbce-416612559128'
const BASE_URL = process.env.NEXTAUTH_URL || 'https://pms.eih.et'
const TOKEN_EXPIRY = '7d'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// ========== Cache ==========
let cachedManusProjectId: string | null = null
let isCacheValid = false

// ========== Helper Functions ==========
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email)
}

// app/api/auth/microsoft/callback/route.ts - Update the token endpoint
const getTokenEndpoint = (): string => {
  // Use the specific tenant ID from environment
  const tenantId = MICROSOFT_TENANT_ID
  // Fallback to 'common' only if tenant ID is not set (but this will error)
  const tenant = tenantId || 'common'
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString()
}

async function getManusProjectId(): Promise<string | null> {
  if (isCacheValid) {
    return cachedManusProjectId
  }

  try {
    const result = await pool.query(
      `SELECT manus_project_id 
       FROM admin_settings 
       WHERE id = 1 
       LIMIT 1`
    )
    
    if (result.rows.length > 0) {
      cachedManusProjectId = result.rows[0].manus_project_id
      isCacheValid = true
      return cachedManusProjectId
    }
    return null
  } catch (error) {
    console.error('Failed to fetch Manus project ID:', error)
    return null
  }
}

// ========== GET Handler ==========
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      `${BASE_URL}/auth/login?error=oauth_failed&message=${encodeURIComponent(errorDescription || error)}`
    )
  }

  // If we have a code, process the callback
  if (code && state) {
    try {
      // Get code_verifier from cookie
      const codeVerifier = request.cookies.get('code_verifier')?.value
      
      if (!codeVerifier) {
        console.error('Missing code_verifier cookie')
        return NextResponse.redirect(
          `${BASE_URL}/auth/login?error=missing_verifier`
        )
      }

      // Get redirect URL from cookie
      const redirectUrl = request.cookies.get('oauth_redirect')?.value || '/dashboard'

      // Process authentication
      const result = await processAuthentication(code, state, codeVerifier)

      if (!result.success) {
        return NextResponse.redirect(
          `${BASE_URL}/auth/login?error=${result.error || 'authentication_failed'}`
        )
      }

      // Create response with redirect
      const response = NextResponse.redirect(`${BASE_URL}${redirectUrl}`)

      // Set JWT cookie
      response.cookies.set('token', result.token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
        priority: 'high'
      })

      // Clear OAuth cookies
      response.cookies.delete('code_verifier')
      response.cookies.delete('oauth_state')
      response.cookies.delete('oauth_redirect')

      return response

    } catch (error) {
      console.error('Callback processing error:', error)
      return NextResponse.redirect(
        `${BASE_URL}/auth/login?error=processing_failed`
      )
    }
  }

  // If no code, show the popup HTML
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Completing Sign In...</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:linear-gradient(135deg,#1b3b34 0%,#0d1f1b 100%);font-family:system-ui,-apple-system,sans-serif}
    .container{text-align:center}
    .spinner{width:48px;height:48px;margin:0 auto 16px;border:3px solid rgba(173,157,111,0.2);border-top-color:#ad9d6f;border-radius:50%;animation:spin .8s linear infinite}
    h1{color:#ad9d6f;font-weight:500;margin:0;font-size:1.2rem}
    p{color:rgba(255,255,255,0.6);font-size:14px;margin-top:8px}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
  <script>
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');
      
      if (window.opener) {
        if (error) {
          window.opener.postMessage({
            type: 'OAUTH_CALLBACK',
            error: errorDescription || error
          }, '${BASE_URL}');
        } else if (code && state) {
          window.opener.postMessage({
            type: 'OAUTH_CALLBACK',
            code: code,
            state: state
          }, '${BASE_URL}');
        }
        window.close();
      } else {
        window.location.href = '/auth/login?error=no_opener';
      }
    } catch (err) {
      console.error('Callback error:', err);
      window.location.href = '/auth/login?error=callback_failed';
    }
  </script>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Completing sign in...</h1>
    <p>This window will close automatically</p>
  </div>
</body>
</html>`;
  
  return new NextResponse(html, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// ========== POST Handler (popup flow) ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, state, code_verifier } = body

    if (!code || !state || !code_verifier) {
      return NextResponse.json(
        { error: 'missing_parameters' },
        { status: 400 }
      )
    }

    const result = await processAuthentication(code, state, code_verifier)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'authentication_failed' },
        { status: 400 }
      )
    }

    const response = NextResponse.json({ 
      success: true, 
      user: result.user
    })

    response.cookies.set('token', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      priority: 'high'
    })

    return response

  } catch (error) {
    console.error('Authentication failed:', error)
    return NextResponse.json(
      { error: 'authentication_failed' },
      { status: 500 }
    )
  }
}

// ========== Shared Authentication Logic ==========
async function processAuthentication(code: string, state: string, codeVerifier: string) {
  let client = null
  
  try {
    // Exchange OAuth Token
    const redirectUri = `${BASE_URL}/api/auth/callback`
    const tokenEndpoint = getTokenEndpoint()
    
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
      scope: 'openid profile email offline_access',
    })

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params,
    })

    if (!tokenResponse.ok) {
      const responseText = await tokenResponse.text()
      console.error('Token exchange failed:', { status: tokenResponse.status, response: responseText })
      return { success: false, error: 'token_exchange_failed' }
    }

    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      return { success: false, error: 'no_access_token' }
    }

    // Extract user info from id_token
    let profile: {
      id: string
      email?: string
      name?: string
      preferred_username?: string
      given_name?: string
      family_name?: string
    }

    if (tokenData.id_token) {
      try {
        const payload = JSON.parse(base64UrlDecode(tokenData.id_token.split('.')[1]))
        profile = {
          id: payload.oid || payload.sub,
          email: payload.email,
          name: payload.name,
          preferred_username: payload.preferred_username,
          given_name: payload.given_name,
          family_name: payload.family_name,
        }
      } catch (error) {
        console.error('Failed to decode id_token, falling back to Graph API')
        profile = await fetchGraphProfile(tokenData.access_token)
      }
    } else {
      profile = await fetchGraphProfile(tokenData.access_token)
    }

    if (!profile.id) {
      return { success: false, error: 'invalid_profile' }
    }

    // Extract and validate email
    let email = (profile.email || profile.preferred_username || '').trim().toLowerCase()
    
    if (!email || !isValidEmail(email)) {
      return { success: false, error: 'invalid_email' }
    }

    // Get user name
    const name = (profile.name || profile.given_name || email.split('@')[0] || 'User').trim().substring(0, 255)
    const avatarUrl = (profile.preferred_username || profile.given_name || name).trim().substring(0, 255)

    // Get default Manus project ID
    const [defaultManusProjectId] = await Promise.all([getManusProjectId()])

    // Database operation
    client = await pool.connect()
    
    try {
      // Check if user exists
      const existingUserResult = await client.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      )

      const isNewUser = existingUserResult.rows.length === 0

      // UPSERT user
      const userResult = await client.query(
        `INSERT INTO users (
          email, 
          name, 
          provider, 
          provider_id, 
          avatar_url,
          created_at,
          updated_at,
          last_login_at
        )
        VALUES ($1, $2, 'microsoft', $3, $4, NOW(), NOW(), NOW())
        ON CONFLICT (email) 
        DO UPDATE SET
          provider = 'microsoft',
          provider_id = EXCLUDED.provider_id,
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = NOW(),
          last_login_at = NOW()
        RETURNING 
          id, 
          email, 
          name, 
          is_admin`,
        [email, name, profile.id, avatarUrl]
      )

      const user = userResult.rows[0]
      const manusProjectId = defaultManusProjectId

      // Generate JWT
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.is_admin || false,
        manusProjectId: manusProjectId || null,
        provider: 'microsoft',
        iat: Math.floor(Date.now() / 1000),
      }

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })

      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.is_admin || false,
        avatar_url: avatarUrl,
        manusProjectId: manusProjectId,
        isNewUser: isNewUser
      }

      return {
        success: true,
        user: userResponse,
        token: token
      }

    } finally {
      if (client) {
        client.release()
      }
    }

  } catch (error) {
    if (client) {
      try { client.release() } catch (e) {}
    }
    console.error('Authentication processing error:', error)
    return { success: false, error: 'processing_failed' }
  }
}

// ========== Helper: Fetch Graph Profile ==========
async function fetchGraphProfile(accessToken: string) {
  const graphResponse = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,givenName,surname',
    {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
    }
  )

  if (!graphResponse.ok) {
    throw new Error('Graph API failed')
  }

  const data = await graphResponse.json()
  return {
    id: data.id,
    email: data.mail || data.userPrincipalName,
    name: data.displayName,
    preferred_username: data.userPrincipalName,
    given_name: data.givenName,
    family_name: data.surname,
  }
}