import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET
const REDIRECT_URI = process.env.NEXTAUTH_URL || 'http://localhost:3000'
import { createProject } from '@/lib/manus-service'
export async function GET(request: NextRequest) {
  let client
  
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code received' },
        { status: 400 }
      )
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID!,
        client_secret: MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: `${REDIRECT_URI}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 400 }
      )
    }

    // Get user profile from Microsoft Graph API
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const profile = await graphResponse.json()

    if (!profile.id || !profile.userPrincipalName) {
      return NextResponse.json(
        { error: 'Failed to get user profile' },
        { status: 400 }
      )
    }

    client = await pool.connect()

    // Check if user exists by OAuth ID
    const existingUserResult = await client.query(
      `SELECT id, email, name FROM users 
       WHERE provider = 'microsoft' AND provider_id = $1`,
      [profile.id]
    )

    let user
    let isNewUser = false

    if (existingUserResult.rows.length > 0) {
      // Update existing user
      user = existingUserResult.rows[0]
      await client.query(
        `UPDATE users 
         SET email = $1, avatar_url = $2, updated_at = NOW()
         WHERE id = $3`,
        [profile.userPrincipalName, profile.mailNickname, user.id]
      )
    } else {
      // Check if email already exists
      const emailCheckResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [profile.userPrincipalName]
      )

      if (emailCheckResult.rows.length > 0) {
        // User exists with same email, link OAuth
        user = emailCheckResult.rows[0]
        await client.query(
          `UPDATE users 
           SET provider = 'microsoft', provider_id = $1, avatar_url = $2, updated_at = NOW()
           WHERE id = $3`,
          [profile.id, profile.mailNickname, user.id]
        )
      } else {
        // Create new user
        const createUserResult = await client.query(
          `INSERT INTO users (email, name, provider, provider_id, manus_project_id, avatar_url, created_at, updated_at)
           VALUES ($1, $2, 'microsoft', $3, $4, $5, NOW(), NOW())
           RETURNING id, email, name`,
          [
            profile.userPrincipalName,
            profile.displayName || profile.givenName || profile.userPrincipalName.split('@')[0],
            profile.id,
            profile.userPrincipalName,
            profile.mailNickname
          ]
        )
        user = createUserResult.rows[0]
        isNewUser = true
      }
    }
let manusProjectId = user.manus_project_id;
    
    if (!manusProjectId) {
      console.log(`Creating Manus project for user: ${user.email}`);
      
      const projectName = `${user.name || user.email?.split('@')[0] || 'User'}'s Investment Assistant`;
      const projectInstructions = `You are an AI investment assistant for Ethiopian Investment Holdings (EIH). 
Your role is to help users with:
- Investment analysis and portfolio management
- Business license applications
- Market research and financial guidance
- Document analysis and summarization
- Regulatory compliance information

Always provide accurate, professional, and helpful responses tailored to the Ethiopian investment context.`;
      
      try {
        const project = await createProject(projectName, projectInstructions);
        manusProjectId = project.projectId;
        
        // Save project ID to user record
        await client.query(
          `UPDATE users SET manus_project_id = $1 WHERE id = $2`,
          [manusProjectId, user.id]
        );
        
        console.log(`✅ Manus project created for user ${user.id}: ${manusProjectId}`);
      } catch (manusError) {
        console.error('Failed to create Manus project:', manusError);
        // Don't block login if Manus project creation fails
        // User can still login, project will be created on next request
      }
    } else {
      console.log(`✅ User ${user.id} already has Manus project: ${manusProjectId}`);
    }
    // Create JWT token
    const token = jwt.sign(
         { 
           userId: user.id,
           email: user.email,
           name: user.name,
           manusProjectId: manusProjectId
         },
         JWT_SECRET,
         { expiresIn: '7d' }
       )

    client.release()

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      manusProjectId: manusProjectId
    }

    // Redirect to dashboard with token
      // Set cookie
    const response = NextResponse.json({ 
      success: true, 
      user: userResponse,
      hasManusProject: !!manusProjectId
    })

    // Set secure HTTP-only cookie
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return response

  } catch (error) {
    console.error('Error in Microsoft OAuth callback:', error)
    if (client) client.release()
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent('Authentication failed')}`,
        REDIRECT_URI
      )
    )
  }
}
