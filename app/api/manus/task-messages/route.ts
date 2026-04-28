import { NextRequest, NextResponse } from 'next/server';
import { getTaskMessages } from '@/lib/manus-service';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }
    
    const messages = await getTaskMessages(taskId, limit);
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching task messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task messages' },
      { status: 500 }
    );
  }
}