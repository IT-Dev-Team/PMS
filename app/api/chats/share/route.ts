// app/api/chats/share/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

export async function POST(request: NextRequest) {
  let client;
  
  try {
    // Get authenticated user ID
    const userId = await getAuthenticatedUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      chatId,
      expiresIn = 7,
      requirePassword = false,
      password = null,
    } = body

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
    }

    if (expiresIn < 1 || expiresIn > 90) {
      return NextResponse.json({ error: 'Expiration must be between 1 and 90 days' }, { status: 400 })
    }

    if (requirePassword && (!password || password.length < 4)) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 })
    }

    client = await pool.connect();
    
    await client.query('BEGIN')
    
    // Verify user owns the chat
    const chatResult = await client.query(
      'SELECT id, title FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )

    if (chatResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Generate unique share token
    const shareToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresIn)

    let passwordHash = null
    if (requirePassword && password) {
      passwordHash = crypto.createHash('sha256').update(password).digest('hex')
    }

    // Check for existing active share link
    const existingShare = await client.query(
      `SELECT id, share_token, expires_at 
       FROM shared_chats 
       WHERE chat_id = $1 AND user_id = $2 AND expires_at > NOW() AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
      [chatId, userId]
    )

    let shareLink;
    if (existingShare.rows.length > 0) {
      shareLink = existingShare.rows[0]
      await client.query('COMMIT')
      
      const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/share/${shareLink.share_token}`
      
      return NextResponse.json({
        success: true,
        shareUrl,
        shareToken: shareLink.share_token,
        expiresAt: shareLink.expires_at,
        requiresPassword: requirePassword,
        isExisting: true
      })
    }

    // Create new share link
    const shareResult = await client.query(
      `INSERT INTO shared_chats 
       (chat_id, user_id, share_token, expires_at, requires_password, password_hash, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING id, share_token, expires_at, requires_password`,
      [chatId, userId, shareToken, expiresAt.toISOString(), requirePassword, passwordHash]
    )

    await client.query('COMMIT')
    
    shareLink = shareResult.rows[0]
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/share/${shareToken}`

    return NextResponse.json({
      success: true,
      shareUrl,
      shareToken: shareLink.share_token,
      expiresAt: shareLink.expires_at,
      requiresPassword: shareLink.requires_password,
      isExisting: false
    })
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK')
    }
    console.error('Error creating share link:', error)
    return NextResponse.json(
      { error: 'Failed to create share link: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}

export async function GET(request: NextRequest) {
  let client;
  
  try {
    const userId = await getAuthenticatedUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const chatId = searchParams.get('chatId')

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID required' }, { status: 400 })
    }

    client = await pool.connect();
    
    const chatCheck = await client.query(
      'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )

    if (chatCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }
    
    const result = await client.query(
      `SELECT 
        id, 
        share_token, 
        expires_at, 
        requires_password,
        created_at, 
        view_count,
        is_active,
        CASE WHEN expires_at > NOW() THEN true ELSE false END as is_valid
       FROM shared_chats
       WHERE chat_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [chatId, userId]
    )

    return NextResponse.json({ shareLinks: result.rows })
  } catch (error) {
    console.error('Error fetching share links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch share links' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}

export async function DELETE(request: NextRequest) {
  let client;
  
  try {
    const userId = await getAuthenticatedUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const shareId = searchParams.get('shareId')

    if (!shareId) {
      return NextResponse.json({ error: 'Share ID required' }, { status: 400 })
    }

    client = await pool.connect();
    
    const result = await client.query(
      `UPDATE shared_chats 
       SET is_active = false, deleted_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [shareId, userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Share link revoked' })
  } catch (error) {
    console.error('Error deleting share link:', error)
    return NextResponse.json(
      { error: 'Failed to delete share link' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}

// Helper function to get authenticated user ID
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  try {
    // Try to get token from cookies
    const cookieStore = await cookies()
    let token = cookieStore.get('token')?.value
    
    // If not in cookies, try Authorization header
    if (!token) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }
    
    if (!token) {
      console.log('No token found')
      return null
    }
    
    // Verify JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any
      
      // Log the decoded token to see what fields are available
      console.log('Decoded token fields:', Object.keys(decoded))
      console.log('Decoded token:', { ...decoded, password: undefined, hash: undefined })
      
      // Try different possible field names for user ID
      const userId = decoded.userId || decoded.id || decoded.user_id || decoded.sub || decoded.userIdFromDb
      
      if (!userId) {
        console.error('No user ID found in token. Available fields:', Object.keys(decoded))
        return null
      }
      
      console.log('Found user ID:', userId)
      return userId.toString()
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError)
      return null
    }
  } catch (error) {
    console.error('Error getting authenticated user:', error)
    return null
  }
}