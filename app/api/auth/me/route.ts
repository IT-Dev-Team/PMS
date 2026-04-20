import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

export async function GET(request: NextRequest) {
  let client;
  
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    
    console.log('Auth check - Token exists:', !!token)
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated', user: null },
        { status: 401 }
      )
    }
    
    // Verify JWT token
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
      console.log('Decoded token:', decoded)
      console.log('User ID:', decoded.userId) // Make sure to extract userId
    } catch (error) {
      console.error('Token verification failed:', error.message)
      return NextResponse.json(
        { error: 'Invalid token', user: null },
        { status: 401 }
      )
    }
    
    // Extract userId from the decoded token - THIS IS THE KEY FIX
    const userId = decoded.userId
    
    if (!userId) {
      console.error('No userId in token')
      return NextResponse.json(
        { error: 'Invalid token payload', user: null },
        { status: 401 }
      )
    }
    
    console.log('Looking for user with ID:', userId)
    
    // Get fresh user data from database - pass ONLY the userId string
    client = await pool.connect()
    const result = await client.query(
      `SELECT id, email, name, avatar_url, created_at
       FROM users
       WHERE id = $1`,
      [userId] // Pass ONLY the userId string, not the entire decoded object
    )
    
    console.log('Query result rows:', result.rows.length)
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found', user: null },
        { status: 404 }
      )
    }
    
    const user = result.rows[0]
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
      }
    })
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json(
      { error: 'Internal server error', user: null },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}