import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  let client;
  
  try {
    // Get authenticated user ID
    const userId = await getAuthenticatedUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { chatId, format = 'markdown' } = body // markdown, json, html, pdf

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
    }

    client = await pool.connect();
    
    // Get chat and verify ownership
    const chatResult = await client.query(
      `SELECT id, title, created_at, updated_at
       FROM chats
       WHERE id = $1 AND user_id = $2`,
      [chatId, userId]
    )

    if (chatResult.rows.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const chat = chatResult.rows[0]

    // Get messages for this chat
    const messagesResult = await client.query(
      `SELECT id, content, role, created_at
       FROM messages
       WHERE chat_id = $1
       ORDER BY created_at ASC`,
      [chatId]
    )

    const messages = messagesResult.rows

    // Generate content based on format
    let content = ''
    let contentType = ''
    let filename = ''

    switch (format) {
      case 'markdown':
        content = generateMarkdown(chat, messages)
        contentType = 'text/markdown'
        filename = `chat-${chatId}.md`
        break
      case 'json':
        content = JSON.stringify({ chat, messages }, null, 2)
        contentType = 'application/json'
        filename = `chat-${chatId}.json`
        break
      case 'html':
        content = generateHTML(chat, messages)
        contentType = 'text/html'
        filename = `chat-${chatId}.html`
        break
      case 'text':
        content = generateText(chat, messages)
        contentType = 'text/plain'
        filename = `chat-${chatId}.txt`
        break
      default:
        content = generateMarkdown(chat, messages)
        contentType = 'text/markdown'
        filename = `chat-${chatId}.md`
    }

    // Set appropriate headers
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }

    return new NextResponse(content, { headers })
  } catch (error) {
    console.error('Error exporting chat:', error)
    return NextResponse.json(
      { error: 'Failed to export chat' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}

function generateMarkdown(chat: any, messages: any[]): string {
  let md = `# ${escapeMarkdown(chat.title)}\n\n`
  md += `**Created:** ${new Date(chat.created_at).toLocaleString()}\n\n`
  md += `**Messages:** ${messages.length}\n\n`
  md += '---\n\n'

  for (const msg of messages) {
    const roleIcon = msg.role === 'user' ? '👤 User' : '🤖 Assistant'
    md += `## ${roleIcon}\n\n`
    md += `${escapeMarkdown(msg.content)}\n\n`
    md += '---\n\n'
  }

  md += `\n*Exported: ${new Date().toLocaleString()}*\n`
  return md
}

function generateText(chat: any, messages: any[]): string {
  let text = `${chat.title}\n`
  text += `${'='.repeat(chat.title.length)}\n\n`
  text += `Created: ${new Date(chat.created_at).toLocaleString()}\n`
  text += `Messages: ${messages.length}\n`
  text += `${'-'.repeat(50)}\n\n`

  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? 'USER' : 'ASSISTANT'
    text += `[${roleLabel}]\n`
    text += `${msg.content}\n`
    text += `${'-'.repeat(50)}\n\n`
  }

  text += `Exported: ${new Date().toLocaleString()}\n`
  return text
}

function generateHTML(chat: any, messages: any[]): string {
  const escapedTitle = escapeHtml(chat.title)
  const createdDate = new Date(chat.created_at).toLocaleString()
  const exportDate = new Date().toLocaleString()
  
  let messagesHtml = ''
  for (const msg of messages) {
    const roleClass = msg.role === 'user' ? 'user' : 'assistant'
    const roleLabel = msg.role === 'user' ? '👤 User' : '🤖 Assistant'
    const escapedContent = escapeHtml(msg.content)
    
    messagesHtml += `
    <div class="message ${roleClass}">
      <div class="role">${roleLabel}</div>
      <div class="content">${escapedContent.replace(/\n/g, '<br>')}</div>
    </div>
`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .meta {
      opacity: 0.9;
      font-size: 14px;
    }
    
    .stats {
      background: #f8f9fa;
      padding: 15px 30px;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      gap: 30px;
      font-size: 14px;
      color: #6c757d;
    }
    
    .messages {
      padding: 30px;
    }
    
    .message {
      margin: 20px 0;
      padding: 20px;
      border-radius: 12px;
      animation: fadeIn 0.5s ease-in;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .user {
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
    }
    
    .assistant {
      background: #f5f5f5;
      border-left: 4px solid #9e9e9e;
    }
    
    .role {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 12px;
      color: #495057;
    }
    
    .content {
      line-height: 1.6;
      color: #212529;
    }
    
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #6c757d;
      border-top: 1px solid #e9ecef;
    }
    
    hr {
      border: none;
      border-top: 2px solid #e9ecef;
      margin: 20px 0;
    }
    
    @media (max-width: 768px) {
      body {
        padding: 20px 10px;
      }
      
      .header {
        padding: 20px;
      }
      
      .messages {
        padding: 20px;
      }
      
      .message {
        padding: 15px;
      }
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
      }
      
      .stats {
        background: white;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapedTitle}</h1>
      <div class="meta">Created: ${createdDate}</div>
    </div>
    <div class="stats">
      <span>📝 ${messages.length} messages</span>
      <span>💬 ${messages.filter(m => m.role === 'user').length} user · ${messages.filter(m => m.role === 'assistant').length} assistant</span>
    </div>
    <div class="messages">
      ${messagesHtml}
    </div>
    <div class="footer">
      Exported: ${exportDate}
    </div>
  </div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char)
}

function escapeMarkdown(text: string): string {
  // Escape markdown special characters
  const markdownChars = ['*', '_', '`', '[', ']', '(', ')', '#', '-', '+', '=', '|', '{', '}', '.', '!']
  let escaped = text
  for (const char of markdownChars) {
    escaped = escaped.replace(new RegExp('\\' + char, 'g'), '\\' + char)
  }
  return escaped
}

// Helper function to get authenticated user ID
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  // Option 1: JWT token from Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1]
      // Verify JWT token
      // const jwt = require('jsonwebtoken')
      // const decoded = jwt.verify(token, process.env.JWT_SECRET!)
      // return decoded.userId
      
      // For development - replace with actual auth logic
      return 'test-user-id'
    } catch (error) {
      return null
    }
  }
  
  // Option 2: Session cookie
  const sessionCookie = request.cookies.get('session')
  if (sessionCookie) {
    // Verify session
    // For development - replace with actual auth logic
    return 'test-user-id'
  }
  
  return null
}