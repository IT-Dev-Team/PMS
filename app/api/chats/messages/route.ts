// app/api/chats/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

export async function GET(request: NextRequest) {
  let client;
  
  try {
    const url = new URL(request.url)
    const chatId = url.searchParams.get('chatId')
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      )
    }
    
    const cookieStore = await cookies()
    let token = cookieStore.get('token')?.value
    
    if (!token) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    const userId = decoded.userId || decoded.id
    
    client = await pool.connect()
    
    // Check if chat exists and user owns it
    const chatResult = await client.query(
      'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )
    
    // If chat doesn't exist, return empty array
    if (chatResult.rows.length === 0) {
      console.log('Chat not found, returning empty messages array')
      return NextResponse.json([])
    }
    
    // Get messages
    const messagesResult = await client.query(
      `SELECT 
        id, 
        content, 
        role, 
        created_at,
        use_case,
        attachments
      FROM messages
      WHERE chat_id = $1
      ORDER BY created_at ASC`,
      [chatId]
    )
    
    // Parse attachments JSON for each message
    const messages = messagesResult.rows.map((msg: any) => ({
      ...msg,
      attachments: msg.attachments ? (typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments) : []
    }))
    
    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}

export async function POST(request: NextRequest) {
  let client;
  
  try {
    console.log('=== POST /api/chats/messages ===')
    
    const cookieStore = await cookies()
    let token = cookieStore.get('token')?.value
    
    if (!token) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token' },
        { status: 401 }
      )
    }
    
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    const userId = decoded.userId || decoded.id
    
    let body
    try {
      const text = await request.text()
      if (!text) {
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        )
      }
      body = JSON.parse(text)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const { chatId, content, useCase, attachments = [] } = body
    
    if (!chatId || !content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Chat ID and message content are required' },
        { status: 400 }
      )
    }
    
    client = await pool.connect()
    
    // Check if chat exists, if not create it
    const chatResult = await client.query(
      'SELECT id, title FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )
    
    let isNewChat = false
    if (chatResult.rows.length === 0) {
      isNewChat = true
      console.log('Chat not found, creating new chat:', chatId)
      
      // Generate a meaningful title from the first message
      let chatTitle = content.trim()
      // Remove any markdown or special characters for title
      chatTitle = chatTitle.replace(/[#*`_]/g, '').trim()
      // Truncate to 50 characters for full title
      if (chatTitle.length > 50) {
        chatTitle = chatTitle.substring(0, 47) + '...'
      }
      
      // Generate a shorter summarized title (30 chars for sidebar)
      let summarizedTitle = content.trim()
      summarizedTitle = summarizedTitle.replace(/[#*`_]/g, '').trim()
      if (summarizedTitle.length > 30) {
        summarizedTitle = summarizedTitle.substring(0, 27) + '...'
      }
      
      // If the message is too short, use a default
      if (chatTitle.length < 3) {
        chatTitle = 'New Conversation'
        summarizedTitle = 'New Chat'
      }
      
      await client.query(
        `INSERT INTO chats (id, user_id, title, summarized_title, created_at, updated_at, is_starred, is_archived)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), false, false)`,
        [chatId, userId, chatTitle, summarizedTitle]
      )
      console.log('New chat created with title:', chatTitle)
    }
    
    // Insert user message
    const userMessageResult = await client.query(
      `INSERT INTO messages (chat_id, content, role, created_at, use_case, attachments)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       RETURNING id, content, role, created_at, use_case`,
      [chatId, content.trim(), 'user', useCase || 'general', JSON.stringify(attachments)]
    )
    
    const userMessage = userMessageResult.rows[0]
    console.log('User message created:', userMessage.id)
    
    // Generate AI response based on use case
    const aiResponseText = generateAIResponse(content.trim(), useCase, attachments)
    
    // Insert AI response
    const aiMessageResult = await client.query(
      `INSERT INTO messages (chat_id, content, role, created_at, use_case)
       VALUES ($1, $2, $3, NOW(), $4)
       RETURNING id, content, role, created_at, use_case`,
      [chatId, aiResponseText, 'assistant', useCase || 'general']
    )
    
    const aiMessage = aiMessageResult.rows[0]
    console.log('AI message created:', aiMessage.id)
    
    // Update chat's updated_at timestamp
    await client.query(
      `UPDATE chats SET updated_at = NOW() WHERE id = $1`,
      [chatId]
    )
    
    return NextResponse.json({
      success: true,
      isNewChat,
      userMessage: userMessage,
      assistantMessage: aiMessage
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}

// AI response generator
function generateAIResponse(userMessage: string, useCase?: string, attachments?: any[]): string {
  const useCaseResponses: Record<string, string> = {
    general: `I understand you're asking about "${userMessage}". How can I help you further with this topic?`,
    summarization: `📝 **Summary**\n\nBased on your text: "${userMessage.substring(0, 100)}..."\n\nHere are the key points:\n1. Main topic identified\n2. Important details extracted\n3. Actionable insights\n\nWould you like me to elaborate on any of these points?`,
    analysis: `📊 **Data Analysis Results**\n\nAnalyzing: "${userMessage.substring(0, 50)}..."\n\nKey insights:\n• Pattern detected in the data\n• Trends identified\n• Recommendations available\n\nWhat specific aspect would you like me to dive deeper into?`,
    presentation: `📽️ **Presentation Outline**\n\nTopic: "${userMessage.substring(0, 50)}..."\n\nSuggested structure:\n1. Introduction & Context\n2. Key Findings\n3. Data Visualization\n4. Recommendations\n5. Q&A\n\nShall I create the first slide for you?`,
    database: `🔍 **Database Query Assistant**\n\nRegarding: "${userMessage.substring(0, 50)}..."\n\nI can help you with:\n• Writing SQL queries\n• Analyzing data patterns\n• Generating reports\n• Visualizing results\n\nWhat specific information would you like to retrieve?`
  }
  
  return useCaseResponses[useCase || 'general'] || useCaseResponses.general
}