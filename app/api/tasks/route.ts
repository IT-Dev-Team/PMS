import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { listTasks } from '@/lib/manus-service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = url.searchParams.get('limit') || '50'
    const offset = url.searchParams.get('offset') || '0'
    const status = url.searchParams.get('status')

    // Fetch tasks from Manus API
    const tasks = await listTasks({
      limit: parseInt(limit),
      offset: parseInt(offset),
      status: status || undefined
    })

    return NextResponse.json(tasks)

  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}
