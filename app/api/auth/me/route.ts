// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

export async function GET(request: NextRequest) {
  let client;
  
  try {
    // Get token from cookies
    const token = request.cookies.get('token')?.value
    
    console.log('Token from cookie:', token ? 'Present' : 'Missing')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }
    
    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
      console.log('Decoded token:', decoded)
    } catch (error) {
      console.error('Token verification failed:', error)
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }
    
    const userId = decoded.userId || decoded.id
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token payload' },
        { status: 401 }
      )
    }
    
    client = await pool.connect()
    
    // Get user from database
    const result = await client.query(
      `SELECT id, email, name, avatar_url, created_at, manus_project_id
       FROM users
       WHERE id = $1`,
      [userId]
    )
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    const user = result.rows[0]
    
    console.log('User found:', { id: user.id, email: user.email, name: user.name })
    
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      manusProjectId: user.manus_project_id
    })
    
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}