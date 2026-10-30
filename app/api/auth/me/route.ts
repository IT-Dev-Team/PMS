// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET

// Validate environment variable
if (!JWT_SECRET) {
  console.error('❌ Missing JWT_SECRET in /api/auth/me')
}

// ========== Types ==========
interface TokenPayload {
  userId: string
  email: string
  name: string
  isAdmin: boolean
  manusProjectId: string | null
  provider: string
  iat: number
  exp: number
}

// ========== Cache for user data ==========
interface UserCacheEntry {
  user: any
  timestamp: number
}

const userCache = new Map<string, UserCacheEntry>()
const USER_CACHE_TTL = 60 * 1000 // 1 minute

// ========== Optimized GET Handler ==========
export async function GET(request: NextRequest) {
  let client = null
  
  try {
    // Get token from cookies
    const token = request.cookies.get('token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Verify and decode token
    let decoded: TokenPayload
    try {
      decoded = jwt.verify(token, JWT_SECRET!) as TokenPayload
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    const userId = decoded.userId || decoded.id
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token payload' },
        { status: 401 }
      )
    }

    // ✅ Option 1: Return user info directly from token (fastest)
    // This avoids a database query entirely
    const userFromToken = {
      id: userId,
      email: decoded.email,
      name: decoded.name,
      isAdmin: decoded.isAdmin || false,
      provider: decoded.provider || 'microsoft',
    }

    // If you only need basic user info, return from token
    // This is the fastest approach - no database query needed
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(userFromToken)
    }

    // ✅ Option 2: Get fresh user data from database (with caching)
    // Use this if you need up-to-date data like avatar_url, created_at
    // Check cache first
    const cacheKey = `user:${userId}`
    const cached = userCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < USER_CACHE_TTL) {
      return NextResponse.json(cached.user)
    }

    // Get user from database
    client = await pool.connect()
    
    const result = await client.query(
      `SELECT id, email, name, avatar_url, created_at, is_admin
       FROM users
       WHERE id = $1`,
      [userId]
    )
    
    client.release()
    client = null
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    const user = result.rows[0]
    
    // Cache the result
    userCache.set(cacheKey, {
      user,
      timestamp: Date.now()
    })
    
    // Clean up old cache entries
    if (userCache.size > 100) {
      const now = Date.now()
      for (const [key, value] of userCache.entries()) {
        if (now - value.timestamp > USER_CACHE_TTL) {
          userCache.delete(key)
        }
      }
    }
    
    return NextResponse.json(user)
    
  } catch (error) {
    console.error('[Auth/Me] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}

// ========== OPTIONAL: Enhanced version with conditional DB query ==========
// Use this if you want to decide based on request headers
export async function GET_Enhanced(request: NextRequest) {
  let client = null
  
  try {
    const token = request.cookies.get('token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    let decoded: TokenPayload
    try {
      decoded = jwt.verify(token, JWT_SECRET!) as TokenPayload
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    const userId = decoded.userId || decoded.id
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token payload' },
        { status: 401 }
      )
    }

    // Check if client wants fresh data
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true'
    const cacheKey = `user:${userId}`
    
    // Check cache unless refresh is requested
    if (!refresh) {
      const cached = userCache.get(cacheKey)
      if (cached && (Date.now() - cached.timestamp) < USER_CACHE_TTL) {
        return NextResponse.json({
          ...cached.user,
          fromCache: true
        })
      }
    }

    // Only query database if needed
    client = await pool.connect()
    
    const result = await client.query(
      `SELECT id, email, name, avatar_url, created_at, is_admin
       FROM users
       WHERE id = $1`,
      [userId]
    )
    
    client.release()
    client = null
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    const user = result.rows[0]
    
    // Cache the result
    userCache.set(cacheKey, {
      user,
      timestamp: Date.now()
    })
    
    return NextResponse.json({
      ...user,
      fromCache: false
    })
    
  } catch (error) {
    console.error('[Auth/Me] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}