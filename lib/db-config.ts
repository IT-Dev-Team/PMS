/**
 * Database Configuration Utility
 * 
 * Supports both local PostgreSQL and Neon databases.
 * Configuration is determined by DATABASE_URL environment variable.
 */

export interface DatabaseConfig {
  type: 'local' | 'neon'
  connectionString: string
  host: string
  port: number
  database: string
  user: string
  pooled: boolean
  ssl: boolean
}

/**
 * Parse database URL and return configuration
 */
export function parseDbConfig(connectionString?: string): DatabaseConfig {
  const url = connectionString || process.env.DATABASE_URL || ''

  if (!url) {
    throw new Error(
      'DATABASE_URL not set. Configure your database in .env.local'
    )
  }

  try {
    const dbUrl = new URL(url)
    
    // Determine database type
    const type = dbUrl.hostname.includes('neon.tech') ? 'neon' : 'local'
    
    // Parse components
    const host = dbUrl.hostname
    const port = parseInt(dbUrl.port || '5432')
    const database = dbUrl.pathname.replace('/', '')
    const user = dbUrl.username
    const ssl = dbUrl.searchParams.has('sslmode') || type === 'neon'
    const pooled = dbUrl.searchParams.get('channel_binding') === 'require'
    
    return {
      type,
      connectionString: url,
      host,
      port,
      database,
      user,
      pooled,
      ssl,
    }
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${url}`)
  }
}

/**
 * Get database configuration info
 */
export function getDbInfo(): string {
  try {
    const config = parseDbConfig()
    
    return `
Database Configuration:
  Type: ${config.type === 'neon' ? 'Neon (Cloud)' : 'Local PostgreSQL'}
  Host: ${config.host}
  Port: ${config.port}
  Database: ${config.database}
  User: ${config.user}
  Pooled: ${config.pooled ? 'Yes' : 'No'}
  SSL: ${config.ssl ? 'Yes' : 'No'}
    `.trim()
  } catch (error) {
    return `Database Configuration Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Verify database connection
 */
export async function verifyDbConnection(): Promise<{
  connected: boolean
  error?: string
  config?: DatabaseConfig
}> {
  try {
    const config = parseDbConfig()
    
    // Import pool after config is parsed
    const { pool } = await import('./db')
    
    // Try to execute simple query
    const result = await pool.query('SELECT 1')
    
    return {
      connected: result.rows.length > 0,
      config,
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Database setup instructions
 */
export const SETUP_INSTRUCTIONS = {
  local: `
# Local PostgreSQL Setup

1. Install PostgreSQL 14+
   macOS: brew install postgresql
   Ubuntu: sudo apt-get install postgresql postgresql-contrib
   
2. Start PostgreSQL
   macOS: brew services start postgresql
   Ubuntu: sudo service postgresql start
   
3. Run setup script:
   ./scripts/setup-local-db.sh
   
4. Update .env.local:
   DATABASE_URL="postgresql://portfoliopulse_user:dev_password_secure_change_me@localhost:5432/portfoliopulse_db"
   DATABASE_URL_UNPOOLED="postgresql://portfoliopulse_user:dev_password_secure_change_me@localhost:5432/portfoliopulse_db"
   
5. Start application:
   npm run dev
  `,
  
  neon: `
# Neon Cloud Setup

1. Create account at https://neon.tech
2. Create a new project
3. Get connection string:
   - Go to Neon console
   - Select Project → Branches → main
   - Copy "Pooled Connection" string
   
4. Update .env.local:
   DATABASE_URL="postgresql://user:password@project.c-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require"
   DATABASE_URL_UNPOOLED="postgresql://user:password@project.c-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require"
   
5. Start application:
   npm run dev
  `,
}

/**
 * Migration helper - switch from one database to another
 */
export async function switchDatabase(
  newConnectionString: string
): Promise<boolean> {
  console.log('Switching database configuration...')
  
  try {
    // Verify the new connection works
    const testUrl = new URL(newConnectionString)
    console.log(
      `✓ Connection string format valid: ${testUrl.hostname}`
    )
    
    // Log what needs to be updated
    console.log('\nUpdate your .env.local:')
    console.log(`DATABASE_URL="${newConnectionString}"`)
    console.log(`DATABASE_URL_UNPOOLED="${newConnectionString}"`)
    
    console.log('\nThen restart the dev server:')
    console.log('npm run dev')
    
    return true
  } catch (error) {
    console.error(
      'Invalid connection string:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return false
  }
}
