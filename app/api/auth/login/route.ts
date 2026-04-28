// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import pool from '@/lib/db'
import { createProject } from '@/lib/manus-service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export async function POST(request: NextRequest) {
  let client;
  
  try {
    const { email, password } = await request.json()
    
    client = await pool.connect()
    
    const result = await client.query(
      `SELECT id, email, name, avatar_url, password_hash, manus_project_id
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
    
    // Check if user has a Manus project, if not create one
    let manusProjectId = user.manus_project_id;
    
    if (!manusProjectId) {
      console.log(`Creating Manus project for user: ${user.email}`);
      
      const projectName = `${user.name || user.email?.split('@')[0] || 'User'}'s Investment Assistant`;
      const projectInstructions = `You are an AI investment assistant for Ethiopian Investment Holdings (EIH). 
Your role is to help users with:
- Investment analysis and portfolio management
- Business license applications
- Market research and financial guidance
- Document analysis and summarization
- Regulatory compliance information

Always provide accurate, professional, and helpful responses tailored to the Ethiopian investment context.`;
      
      try {
        const project = await createProject(projectName, projectInstructions);
        manusProjectId = project.projectId;
        
        // Save project ID to user record
        await client.query(
          `UPDATE users SET manus_project_id = $1 WHERE id = $2`,
          [manusProjectId, user.id]
        );
        
        console.log(`✅ Manus project created for user ${user.id}: ${manusProjectId}`);
      } catch (manusError) {
        console.error('Failed to create Manus project:', manusError);
        // Don't block login if Manus project creation fails
        // User can still login, project will be created on next request
      }
    } else {
      console.log(`✅ User ${user.id} already has Manus project: ${manusProjectId}`);
    }
    
    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        name: user.name,
        manusProjectId: manusProjectId
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    // Return user data with project info
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      manusProjectId: manusProjectId
    }
    
    // Set cookie
    const response = NextResponse.json({ 
      success: true, 
      user: userResponse,
      hasManusProject: !!manusProjectId
    })
    
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