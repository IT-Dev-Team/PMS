import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  let client;
  
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      )
    }

     client = await pool.connect();
    
    // Start transaction for reading data
    await client.query('BEGIN')
    
    // Find the shared chat with additional details
    const shareResult = await client.query(
      `SELECT 
        sc.id, 
        sc.chat_id, 
        sc.expires_at, 
        sc.requires_password, 
        sc.password_hash, 
        sc.view_count,
        sc.max_views,
        sc.created_at as shared_at,
        c.title as chat_title,
        c.created_at as chat_created_at,
        c.updated_at as chat_updated_at
      FROM shared_chats sc
      JOIN chats c ON sc.chat_id = c.id
      WHERE sc.share_token = $1`,
      [token]
    )

    if (shareResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'Share link not found or has been removed' },
        { status: 404 }
      )
    }

    const shareData = shareResult.rows[0]
    const now = new Date()
    const expiresAt = new Date(shareData.expires_at)

    // Check if expired
    if (expiresAt < now) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { 
          error: 'This share link has expired',
          expiresAt: shareData.expires_at 
        },
        { status: 410 } // 410 Gone
      )
    }

    // Calculate remaining time
    const remainingTime = expiresAt.getTime() - now.getTime()
    const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24))

    // Check max views if set
    if (shareData.max_views && shareData.view_count >= shareData.max_views) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { 
          error: 'This share link has reached its maximum view limit',
          maxViews: shareData.max_views,
          viewCount: shareData.view_count
        },
        { status: 403 }
      )
    }

    // Prepare chat object
    const chat = {
      id: shareData.chat_id,
      title: shareData.chat_title,
      createdAt: shareData.chat_created_at,
      updatedAt: shareData.chat_updated_at,
    }

    // Get messages if no password required
    let messages = []
    if (!shareData.requires_password) {
      const messagesResult = await client.query(
        `SELECT 
          m.id,
          m.content,
          m.role,
          m.created_at,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', a.id,
                  'filename', a.filename,
                  'file_url', a.file_url,
                  'file_size', a.file_size,
                  'mime_type', a.mime_type,
                  'created_at', a.created_at
                )
              )
              FROM attachments a
              WHERE a.message_id = m.id
            ),
            '[]'::json
          ) as attachments
        FROM messages m
        WHERE m.chat_id = $1
        ORDER BY m.created_at ASC`,
        [shareData.chat_id]
      )

      messages = messagesResult.rows
    }

    // Commit the read transaction
    await client.query('COMMIT')

    // Log access and update view count asynchronously (outside transaction)
    const logPromise = client.query(
      `INSERT INTO share_access_logs 
       (shared_chat_id, accessed_at, success, ip_address, user_agent, referer)
       VALUES ($1, NOW(), $2, $3, $4, $5)`,
      [
        shareData.id,
        true,
        request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown',
        request.headers.get('user-agent') || 'unknown',
        request.headers.get('referer') || null
      ]
    ).catch(err => console.error('Error logging access:', err))

    const updatePromise = client.query(
      `UPDATE shared_chats 
       SET view_count = view_count + 1,
           last_accessed_at = NOW()
       WHERE id = $1`,
      [shareData.id]
    ).catch(err => console.error('Error updating view count:', err))

    // Don't await - let them run in background
    Promise.all([logPromise, updatePromise])

    // Prepare response
    const response: any = {
      chat,
      messages,
      requiresPassword: shareData.requires_password,
      metadata: {
        viewCount: shareData.view_count + 1,
        maxViews: shareData.max_views,
        remainingViews: shareData.max_views ? shareData.max_views - (shareData.view_count + 1) : null,
        expiresAt: shareData.expires_at,
        remainingDays: remainingDays,
        sharedAt: shareData.shared_at,
      }
    }

    // Add message count if messages are loaded
    if (messages.length > 0) {
      response.messageCount = messages.length
      response.userMessageCount = messages.filter(m => m.role === 'user').length
      response.assistantMessageCount = messages.filter(m => m.role === 'assistant').length
    }

    return NextResponse.json(response)
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK')
    }
    console.error('Error accessing shared chat:', error)
    return NextResponse.json(
      { error: 'Failed to access shared chat. Please try again later.' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}