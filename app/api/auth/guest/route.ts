import { NextRequest, NextResponse } from 'next/server'
import { createToken } from '@/lib/jwt'
import pool from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  let client;
  
  try {
    client = await pool.connect()
    
    // Create a guest user
    const guestId = `guest_${crypto.randomBytes(8).toString('hex')}`
    const guestEmail = `${guestId}@guest.local`
    
    // Check if guest user already exists (clean up old guests)
    await client.query(
      `DELETE FROM users WHERE email LIKE '%@guest.local' AND created_at < NOW() - INTERVAL '7 days'`
    )
    
    // Create new guest user
    const result = await client.query(
      `INSERT INTO users (email, name, email_verified, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, email, name, avatar_url`,
      [guestEmail, 'Guest User', false]
    )
    
    const user = result.rows[0]
    
    // Create JWT token (expires in 1 day for guests)
    const token = createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    }, '1d')
    
    // Set cookie
    const response = NextResponse.json({
      success: true,
      user,
    })
    
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 1 day
      path: '/',
    })
    
    return response
  } catch (error) {
    console.error('Guest login error:', error)
    return NextResponse.json(
      { error: 'Guest login failed' },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}