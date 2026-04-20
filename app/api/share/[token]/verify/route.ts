import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import pool from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  let client;
  
  try {
    const { token } = await params
    const body = await request.json()
    const { password } = body

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

     client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN')
    
    // Find the shared chat
    const shareResult = await client.query(
      `SELECT id, chat_id, expires_at, requires_password, password_hash, view_count
       FROM shared_chats
       WHERE share_token = $1`,
      [token]
    )

    if (shareResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    const shareData = shareResult.rows[0]

    // Check if expired
    if (new Date(shareData.expires_at) < new Date()) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Share link expired' }, { status: 401 })
    }

    // Check max views if set
    if (shareData.max_views && shareData.view_count >= shareData.max_views) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Share link has reached maximum views' }, { status: 401 })
    }

    // Verify password
    if (shareData.requires_password) {
      if (!password) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Password required' }, { status: 401 })
      }
      
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
      if (passwordHash !== shareData.password_hash) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
      }
    }

    // Get messages with attachments
    const messagesResult = await client.query(
      `SELECT 
        m.id,
        m.content,
        m.role,
        m.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'filename', a.filename,
              'file_url', a.file_url
            )
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as attachments
      FROM messages m
      LEFT JOIN attachments a ON m.id = a.message_id
      WHERE m.chat_id = $1
      GROUP BY m.id, m.content, m.role, m.created_at
      ORDER BY m.created_at ASC`,
      [shareData.chat_id]
    )

    const messages = messagesResult.rows

    // Increment view count
    await client.query(
      `UPDATE shared_chats 
       SET view_count = view_count + 1,
           last_accessed_at = NOW()
       WHERE id = $1`,
      [shareData.id]
    )

    // Log access
    await client.query(
      `INSERT INTO share_access_logs (shared_chat_id, accessed_at, ip_address, user_agent)
       VALUES ($1, NOW(), $2, $3)`,
      [
        shareData.id,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      ]
    )

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      messages: messages || [],
      viewCount: shareData.view_count + 1,
      expiresAt: shareData.expires_at,
    })
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK')
    }
    console.error('Error accessing shared chat:', error)
    return NextResponse.json(
      { error: 'Failed to access shared chat' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}