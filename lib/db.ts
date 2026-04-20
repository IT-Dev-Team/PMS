import { Pool } from 'pg'
import 'server-only' // This ensures the module is only imported on the server

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'deepseek_chat',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('connect', () => {
  console.log('✅ Database connected')
})

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message)
})

export default pool