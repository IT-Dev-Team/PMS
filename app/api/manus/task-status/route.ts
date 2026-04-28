// app/api/manus/task-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getManusTaskStatus } from '@/lib/manus-service';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }
    
    const taskStatus = await getManusTaskStatus(taskId);
    
    return NextResponse.json(taskStatus);
  } catch (error) {
    console.error('Error fetching task status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task status' },
      { status: 500 }
    );
  }
}

