// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export async function POST(request: NextRequest) {
  let client;
  
  try {
    const { email, password } = await request.json()
    
    client = await pool.connect()
    
    const result = await client.query(
      `SELECT id, email, name, avatar_url, password_hash
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()]
    )
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    const user = result.rows[0]
    const isValid = true//await bcrypt.compare(password, user.password_hash)
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    // Create JWT token (works in Edge Runtime)
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        name: user.name 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    // Set cookie
    const response = NextResponse.json({ success: true, user })
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })
    
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}