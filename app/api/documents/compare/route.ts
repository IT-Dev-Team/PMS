import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import pool from '@/lib/db'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

export async function POST(request: NextRequest) {
  let client;
  
  try {
    // Get authenticated user ID
    const userId = await getAuthenticatedUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { documentIds, documentTexts, focusAreas = [] } = body

    // Validate input
    if (!documentTexts || !Array.isArray(documentTexts) || documentTexts.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 documents required for comparison' },
        { status: 400 }
      )
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length !== documentTexts.length) {
      return NextResponse.json(
        { error: 'Document IDs must match document texts count' },
        { status: 400 }
      )
    }

     client = await pool.connect();
    
    // Verify user has access to all documents
    const documentCheck = await client.query(
      `SELECT id FROM documents 
       WHERE id = ANY($1::uuid[]) AND user_id = $2`,
      [documentIds, userId]
    )
    
    if (documentCheck.rows.length !== documentIds.length) {
      return NextResponse.json(
        { error: 'One or more documents not found or access denied' },
        { status: 404 }
      )
    }

    // Generate comparison using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const focusPrompt = focusAreas.length > 0
      ? `Focus on comparing these areas: ${focusAreas.join(', ')}\n\n`
      : ''

    let documentsText = ''
    documentTexts.forEach((text: string, index: number) => {
      documentsText += `Document ${index + 1}:\n${text}\n\n`
    })

    const prompt = `Compare the following ${documentTexts.length} documents:\n\n${documentsText}\n${focusPrompt}Provide:\n1. Key similarities\n2. Key differences\n3. Notable patterns\n4. Recommendations based on comparison`

    const result = await model.generateContent(prompt)
    const comparison = result.response.text()

    // Store comparison in database
    const comparisonResult = await client.query(
      `INSERT INTO document_comparisons 
       (user_id, document_ids, comparison_text, focus_areas)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [userId, documentIds, comparison, focusAreas]
    )
    
    const comparisonRecord = comparisonResult.rows[0]

    return NextResponse.json({
      success: true,
      comparison,
      comparisonId: comparisonRecord.id,
      createdAt: comparisonRecord.created_at,
    })
  } catch (error) {
    console.error('Error comparing documents:', error)
    return NextResponse.json(
      { error: 'Failed to compare documents' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}

// Helper function to get authenticated user ID
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  // Option 1: JWT token from Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1]
      // Verify JWT token
      // const jwt = require('jsonwebtoken')
      // const decoded = jwt.verify(token, process.env.JWT_SECRET!)
      // return decoded.userId
      
      // For development - replace with actual auth logic
      return 'test-user-id'
    } catch (error) {
      return null
    }
  }
  
  // Option 2: Session cookie
  const sessionCookie = request.cookies.get('session')
  if (sessionCookie) {
    // Verify session
    // For development - replace with actual auth logic
    return 'test-user-id'
  }
  
  return null
}