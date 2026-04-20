import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import pool from '@/lib/db'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

interface AnalysisRule {
  name: string
  pattern: string
  description: string
}

const DEFAULT_RULES: AnalysisRule[] = [
  {
    name: 'Financial Data Extraction',
    pattern: 'Extract all monetary values, currency types, and financial figures',
    description: 'Identifies and extracts financial information from documents',
  },
  {
    name: 'Entity Recognition',
    pattern: 'Identify names of people, organizations, locations, and dates',
    description: 'Recognizes and lists important entities in the document',
  },
  {
    name: 'Key Points Summary',
    pattern: 'Extract the main topics, conclusions, and key findings',
    description: 'Summarizes important points and main ideas',
  },
  {
    name: 'Compliance Check',
    pattern: 'Check for compliance-related keywords and regulatory mentions',
    description: 'Identifies potential compliance and regulatory issues',
  },
]

export async function POST(request: NextRequest) {
  let client;
  
  try {
    // Get authenticated user ID
    const userId = await getAuthenticatedUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { documentId, documentText, customRules = [] } = body

    if (!documentId || !documentText) {
      return NextResponse.json(
        { error: 'Document ID and text are required' },
        { status: 400 }
      )
    }

    const rulesToApply = customRules.length > 0 ? customRules : DEFAULT_RULES

    // Generate analysis using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const rulesPrompt = rulesToApply
      .map((rule: any) => `- ${rule.name}: ${rule.pattern}`)
      .join('\n')

    const prompt = `Analyze the following document according to these rules:\n\n${rulesPrompt}\n\nDocument:\n${documentText}\n\nProvide a structured analysis for each rule.`

    const result = await model.generateContent(prompt)
    const analysis = result.response.text()

     client = await pool.connect();
    
    // Verify user has access to this document
    const docResult = await client.query(
      'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, userId]
    )
    
    if (docResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      )
    }
    
    // Store analysis in database
    const analysisResult = await client.query(
      `INSERT INTO document_analysis 
       (document_id, user_id, analysis_text, rules_applied)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [documentId, userId, analysis, JSON.stringify(rulesToApply)]
    )
    
    const analysisRecord = analysisResult.rows[0]

    return NextResponse.json({
      success: true,
      analysis,
      analysisId: analysisRecord.id,
      createdAt: analysisRecord.created_at,
    })
  } catch (error) {
    console.error('Error analyzing document:', error)
    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID (optional for rules)
    const userId = await getAuthenticatedUserId(request)
    
    // Get documentId from query params if provided
    const searchParams = request.nextUrl.searchParams
    const documentId = searchParams.get('documentId')
    
    // If documentId provided, fetch analysis for that document
    if (documentId && userId) {
      let client;
      try {
        client = await pool.connect();
        
        const result = await client.query(
          `SELECT id, analysis_text, rules_applied, created_at
           FROM document_analysis
           WHERE document_id = $1 AND user_id = $2
           ORDER BY created_at DESC`,
          [documentId, userId]
        )
        
        return NextResponse.json({
          analyses: result.rows,
          defaultRules: DEFAULT_RULES,
        })
      } finally {
        if (client) client.release()
      }
    }
    
    // Otherwise return just the default rules
    return NextResponse.json({
      defaultRules: DEFAULT_RULES,
    })
  } catch (error) {
    console.error('Error fetching rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 }
    )
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