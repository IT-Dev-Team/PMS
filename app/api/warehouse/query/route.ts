import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

// Snowflake query executor - replace with real Snowflake connector
interface QueryResult {
  success: boolean
  data: any[]
  rowCount: number
  executionTime: number
  error?: string
}

async function executeWarehouseQuery(sqlQuery: string): Promise<QueryResult> {
  // Mock data for demonstration
  const mockDatasets: { [key: string]: any[] } = {
    sales: [
      { date: '2024-01-01', amount: 45000, region: 'North', product: 'Product A' },
      { date: '2024-01-02', amount: 52000, region: 'South', product: 'Product B' },
      { date: '2024-01-03', amount: 38000, region: 'East', product: 'Product C' },
    ],
    customers: [
      { id: 1, name: 'Acme Corp', industry: 'Technology', status: 'Active' },
      { id: 2, name: 'Global Industries', industry: 'Manufacturing', status: 'Active' },
      { id: 3, name: 'Tech Innovations', industry: 'Software', status: 'Inactive' },
    ],
    inventory: [
      { product: 'Product A', stock: 1200, warehouse: 'Main', lastUpdate: '2024-03-01' },
      { product: 'Product B', stock: 856, warehouse: 'Secondary', lastUpdate: '2024-03-01' },
      { product: 'Product C', stock: 2100, warehouse: 'Main', lastUpdate: '2024-03-01' },
    ],
    products: [
      { id: 1, name: 'Product A', category: 'Electronics', price: 99.99 },
      { id: 2, name: 'Product B', category: 'Clothing', price: 49.99 },
      { id: 3, name: 'Product C', category: 'Home', price: 149.99 },
    ],
    orders: [
      { id: 1001, customer_id: 1, total: 299.99, status: 'Completed', date: '2024-03-01' },
      { id: 1002, customer_id: 2, total: 149.99, status: 'Pending', date: '2024-03-02' },
      { id: 1003, customer_id: 1, total: 499.99, status: 'Completed', date: '2024-03-03' },
    ],
  }

  // Simulate query execution
  const startTime = Date.now()

  // Simple pattern matching for mock queries
  let resultData: any[] = []
  const lowerQuery = sqlQuery.toLowerCase()

  if (lowerQuery.includes('sales')) {
    resultData = mockDatasets.sales
  } else if (lowerQuery.includes('customer')) {
    resultData = mockDatasets.customers
  } else if (lowerQuery.includes('inventory')) {
    resultData = mockDatasets.inventory
  } else if (lowerQuery.includes('product')) {
    resultData = mockDatasets.products
  } else if (lowerQuery.includes('order')) {
    resultData = mockDatasets.orders
  } else {
    // Return sample data if no match
    resultData = mockDatasets.sales.slice(0, 1)
  }

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100))

  const executionTime = Date.now() - startTime

  return {
    success: true,
    data: resultData,
    rowCount: resultData.length,
    executionTime,
  }
}

// Real Snowflake integration example (commented out)
/*
import snowflake from 'snowflake-sdk'

async function executeRealSnowflakeQuery(sqlQuery: string): Promise<QueryResult> {
  const connection = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    password: process.env.SNOWFLAKE_PASSWORD!,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
    database: process.env.SNOWFLAKE_DATABASE!,
    schema: process.env.SNOWFLAKE_SCHEMA!,
  })

  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => {
      if (err) {
        reject({ success: false, error: err.message })
        return
      }

      conn.execute({
        sqlText: sqlQuery,
        complete: (err, stmt, rows) => {
          if (err) {
            reject({ success: false, error: err.message })
            return
          }
          resolve({
            success: true,
            data: rows,
            rowCount: rows.length,
            executionTime: stmt.getQueryResultsTime(),
          })
          conn.destroy()
        },
      })
    })
  })
}
*/

export async function POST(request: NextRequest) {
  let client;
  
  try {
    // Get authenticated user ID
    const userId = await getAuthenticatedUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { query, chatId } = body

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query cannot be empty' },
        { status: 400 }
      )
    }

    // Validate query for basic SQL injection prevention
    const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE']
    const upperQuery = query.toUpperCase()
    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        return NextResponse.json(
          { error: `Query contains forbidden keyword: ${keyword}. Only SELECT queries are allowed.` },
          { status: 403 }
        )
      }
    }

    // Execute warehouse query
    const result = await executeWarehouseQuery(query)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Query execution failed' },
        { status: 500 }
      )
    }

    // Store query in database for audit trail
    if (chatId) {
       client = await pool.connect();
      
      // Verify user owns the chat if chatId is provided
      if (chatId) {
        const chatResult = await client.query(
          'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
          [chatId, userId]
        )
        
        if (chatResult.rows.length === 0) {
          return NextResponse.json(
            { error: 'Chat not found or access denied' },
            { status: 404 }
          )
        }
      }
      
      await client.query(
        `INSERT INTO warehouse_queries 
         (user_id, chat_id, query_text, result_count, execution_time, success)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, chatId, query, result.rowCount, result.executionTime, result.success]
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      rowCount: result.rowCount,
      executionTime: result.executionTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error executing warehouse query:', error)
    return NextResponse.json(
      { error: 'Failed to execute query', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}

export async function GET(request: NextRequest) {
  let client;
  
  try {
    // Get authenticated user ID
    const userId = await getAuthenticatedUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const chatId = searchParams.get('chatId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    client = await pool.connect();
    
    let queries = []
    let totalCount = 0
    
    if (chatId) {
      // Get queries for specific chat
      const result = await client.query(
        `SELECT id, query_text, result_count, execution_time, success, created_at
         FROM warehouse_queries
         WHERE chat_id = $1 AND user_id = $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [chatId, userId, limit, offset]
      )
      
      queries = result.rows
      
      const countResult = await client.query(
        'SELECT COUNT(*) FROM warehouse_queries WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )
      totalCount = parseInt(countResult.rows[0].count)
    } else {
      // Get recent queries for user
      const result = await client.query(
        `SELECT id, chat_id, query_text, result_count, execution_time, success, created_at
         FROM warehouse_queries
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      )
      
      queries = result.rows
      
      const countResult = await client.query(
        'SELECT COUNT(*) FROM warehouse_queries WHERE user_id = $1',
        [userId]
      )
      totalCount = parseInt(countResult.rows[0].count)
    }

    return NextResponse.json({
      warehouse: 'Snowflake (Demo)',
      status: 'connected',
      availableTables: ['sales', 'customers', 'inventory', 'products', 'orders'],
      recentQueries: queries,
      pagination: {
        total: totalCount,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Error getting warehouse status:', error)
    return NextResponse.json(
      { error: 'Failed to get warehouse status' },
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