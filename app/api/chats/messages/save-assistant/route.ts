// app/api/chats/messages/save-assistant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters';

export async function POST(request: NextRequest) {
  let client;
  
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get('token')?.value;
    
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const userId = decoded.userId || decoded.id;
    
    const { chatId, taskId, content, attachments } = await request.json();
    
    if (!chatId || !content) {
      return NextResponse.json(
        { error: 'Chat ID and content are required' },
        { status: 400 }
      );
    }
    
    client = await pool.connect();
    
    // Verify user owns the chat
    const chatCheck = await client.query(
      'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    );
    
    if (chatCheck.rows.length === 0) {
      client.release();
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    
    // Save assistant message
    const result = await client.query(
      `INSERT INTO messages (chat_id, content, role, created_at, attachments, manus_task_id)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       RETURNING id, content, role, created_at, attachments`,
      [chatId, content, 'assistant', JSON.stringify(attachments || []), taskId]
    );
    
    // Update chat timestamp
    await client.query(
      `UPDATE chats SET updated_at = NOW() WHERE id = $1`,
      [chatId]
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error saving assistant message:', error);
    if (client) client.release();
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    );
  }
}