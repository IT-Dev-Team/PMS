// app/api/chats/messages/stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { getManusTaskStatus, getTaskMessages } from '@/lib/manus-service';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');
  
  if (!taskId) {
    return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
  }
  
  // Verify auth
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  const encoder = new TextEncoder();
  let lastMessageCount = 0;
  let seenMessageIds = new Set<string>();
  let isComplete = false;
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      };
      
      // Send initial connection
      sendEvent('connected', { message: 'Connected to stream' });
      
      const pollInterval = setInterval(async () => {
        if (isComplete) return;
        
        try {
          const taskStatus = await getManusTaskStatus(taskId);
          const taskMessages = await getTaskMessages(taskId, 50);
          
          // Check for new messages
          if (taskMessages.messages && taskMessages.messages.length > lastMessageCount) {
            const newMessages = taskMessages.messages.slice(lastMessageCount);
            
            for (const msg of newMessages) {
              if (seenMessageIds.has(msg.id)) continue;
              seenMessageIds.add(msg.id);
              
              if (msg.type === 'status_update' && msg.status_update) {
                sendEvent('status', {
                  status: msg.status_update.agent_status,
                  message: msg.status_update.description || msg.status_update.brief,
                  brief: msg.status_update.brief,
                  description: msg.status_update.description
                });
              } 
              else if (msg.type === 'assistant_message' && msg.assistant_message) {
                sendEvent('message', {
                  content: msg.assistant_message.content,
                  attachments: msg.assistant_message.attachments || [],
                  isFinal: taskStatus.status === 'completed'
                });
              }
            }
            
            lastMessageCount = taskMessages.messages.length;
          }
          
          // Check if complete
          if (taskStatus.status === 'completed' || taskStatus.status === 'stopped') {
            isComplete = true;
            sendEvent('complete', { message: 'Task completed' });
            clearInterval(pollInterval);
            controller.close();
          } else if (taskStatus.status === 'failed') {
            isComplete = true;
            sendEvent('error', { message: 'Task failed' });
            clearInterval(pollInterval);
            controller.close();
          }
        } catch (error) {
          console.error('Polling error:', error);
          sendEvent('error', { message: 'Polling error occurred' });
          clearInterval(pollInterval);
          controller.close();
        }
      }, 2000);
      
      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        controller.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}