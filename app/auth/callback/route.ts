import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import pool from '@/lib/db'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const error = requestUrl.searchParams.get('error')

  // Handle OAuth error
  if (error) {
    console.error('OAuth error:', error)
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error)}`, requestUrl.origin)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/auth/login?error=No authorization code provided', requestUrl.origin)
    )
  }

  let client;
  
  try {
    // Verify state parameter to prevent CSRF attacks
    const cookieStore = await cookies()
    const storedState = cookieStore.get('oauth_state')?.value
    
    if (!storedState || storedState !== state) {
      console.error('OAuth state mismatch - possible CSRF attack')
      return NextResponse.redirect(
        new URL('/auth/login?error=Invalid state parameter', requestUrl.origin)
      )
    }

    // Clear the state cookie
    cookieStore.delete('oauth_state')

    // Exchange the code for user information
    // This depends on your OAuth provider (Google, GitHub, etc.)
    const userInfo = await exchangeCodeForUser(code, requestUrl.origin)
    
    if (!userInfo || !userInfo.email) {
      throw new Error('Failed to get user information')
    }

     client = await pool.connect();
    
    // Check if user exists in database
    const userResult = await client.query(
      `SELECT id, email, name, avatar_url, email_verified, created_at
       FROM users
       WHERE email = $1`,
      [userInfo.email]
    )
    
    let user
    let isNewUser = false
    
    if (userResult.rows.length === 0) {
      // Create new user
      isNewUser = true
      const insertResult = await client.query(
        `INSERT INTO users (email, name, avatar_url, email_verified, provider, provider_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, name, avatar_url, email_verified, created_at`,
        [
          userInfo.email,
          userInfo.name || userInfo.email.split('@')[0],
          userInfo.avatar_url || null,
          userInfo.email_verified || false,
          userInfo.provider || 'oauth',
          userInfo.provider_id || null
        ]
      )
      user = insertResult.rows[0]
    } else {
      // Update existing user's last login
      user = userResult.rows[0]
      await client.query(
        `UPDATE users 
         SET last_login_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [user.id]
      )
      
      // Update avatar if provided and different
      if (userInfo.avatar_url && user.avatar_url !== userInfo.avatar_url) {
        await client.query(
          `UPDATE users SET avatar_url = $1 WHERE id = $2`,
          [userInfo.avatar_url, user.id]
        )
      }
    }
    
    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiration
    
    await client.query(
      `INSERT INTO sessions (user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [user.id, sessionToken, expiresAt]
    )
    
    // Set session cookie
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })
    
    // Set user info cookie (non-sensitive data)
    cookieStore.set('user', JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })
    
    // Redirect to appropriate page
    const redirectUrl = new URL('/chat', requestUrl.origin)
    if (isNewUser) {
      redirectUrl.searchParams.set('welcome', 'true')
    }
    
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Error in OAuth callback:', error)
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent('Authentication failed')}`, requestUrl.origin)
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}

// Helper function to exchange OAuth code for user information
// This depends on your OAuth provider
async function exchangeCodeForUser(code: string, redirectUri: string): Promise<{
  email: string
  name?: string
  avatar_url?: string
  email_verified?: boolean
  provider?: string
  provider_id?: string
} | null> {
  // Example for Google OAuth
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    throw new Error('OAuth credentials not configured')
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens')
    }
    
    const tokens = await tokenResponse.json()
    
    // Get user info with access token
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })
    
    if (!userResponse.ok) {
      throw new Error('Failed to get user info')
    }
    
    const userInfo = await userResponse.json()
    
    return {
      email: userInfo.email,
      name: userInfo.name,
      avatar_url: userInfo.picture,
      email_verified: userInfo.verified_email,
      provider: 'google',
      provider_id: userInfo.id,
    }
  } catch (error) {
    console.error('Error exchanging code for user:', error)
    return null
  }
}