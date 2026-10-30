// lib/db.ts
import { Pool, PoolConfig } from 'pg';
import 'server-only';

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'eih_pms',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345678',
  max: 20,
  // ✅ Since server timeout is 1h, we can be more generous
  idleTimeoutMillis: 300000, // 5 minutes - much less than server's 1h
  connectionTimeoutMillis: 10000,
  maxUses: 7500,
  allowExitOnIdle: true,
  
  // ✅ Add keepalive to prevent connection drops
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

const pool = new Pool(dbConfig);

// ✅ Better error handling with specific codes
pool.on('error', (err: any, client) => {
  // Don't log connection termination errors as errors (they're expected)
  if (err?.code === '57P05') {
    console.debug('Connection terminated by server (idle timeout), will be recreated');
    return;
  }
  console.error('❌ Unexpected database pool error:', {
    message: err?.message,
    code: err?.code,
  });
});

// ✅ Periodic health check to keep connections alive
setInterval(async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
  } catch (error: any) {
    // Silent fail - connections will be recreated when needed
    if (error.code !== '57P05') {
      console.debug('Health check failed:', error.message);
    }
  }
}, 60000); // Check every minute

// ✅ Improved retry logic - specific to PostgreSQL error codes
export async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await queryFn();
    } catch (error: any) {
      lastError = error;
      
      // PostgreSQL error codes that are safe to retry
      const retryableCodes = [
        '57P05', // idle_session_timeout
        '57P01', // admin_shutdown
        '57P02', // crash_shutdown
        '57P03', // cannot_connect_now
        '08000', // connection_exception
        '08001', // sqlclient_unable_to_establish_sqlconnection
        '08003', // connection_does_not_exist
        '08006', // connection_failure
        '08007', // sqlclient_unable_to_establish_sqlconnection
        'ECONNRESET',
        'ECONNREFUSED',
        'EPIPE',
      ];
      
      const shouldRetry = retryableCodes.includes(error?.code);
      
      if (!shouldRetry || attempt === retries) {
        throw error;
      }
      
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`Query failed (${error.code}), retrying in ${waitTime}ms... (${retries - attempt} retries left)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}

// ✅ Smart connection getter with retry
async function getConnection() {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      const client = await pool.connect();
      // Test the connection
      await client.query('SELECT 1');
      return client;
    } catch (error: any) {
      attempts++;
      
      // If it's a termination error, wait and retry
      if (error.code === '57P05' && attempts < maxAttempts) {
        console.log(`Connection terminated, reconnecting (attempt ${attempts}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Failed to get database connection after multiple attempts');
}

// ✅ Enhanced executeQuery with better connection handling
export async function executeQuery<T = any>(
  text: string,
  params?: any[],
  options?: { retries?: number; timeout?: number }
): Promise<T[]> {
  const { retries = 3, timeout } = options || {};
  
  return queryWithRetry(async () => {
    const client = await getConnection();
    
    try {
      // Only set timeout if specified (since your server has statement_timeout = 0)
      if (timeout) {
        await client.query(`SET LOCAL statement_timeout = '${timeout}ms'`);
      }
      
      const result = await client.query(text, params);
      return result.rows as T[];
    } catch (error: any) {
      // If connection is dead, release it so pool creates a new one
      if (error.code === '57P05' || error.code === 'ECONNRESET') {
        client.release(true); // Force destroy the connection
        throw error;
      }
      throw error;
    } finally {
      // Only release if not already destroyed
      try {
        if (!(client as any)._destroyed) {
          client.release();
        }
      } catch (e) {
        // Connection already destroyed
      }
    }
  }, retries);
}

// Your existing queries stay the same, but use executeQuery
export const AdminSettingsQueries = {
  async getSettings() {
    const rows = await executeQuery<any>(
      'SELECT * FROM admin_settings WHERE id = 1 LIMIT 1'
    );
    return rows[0] || null;
  },

  async updateApiKey(apiKeyHash: string, manusProjectId: string) {
    console.log(`🔑 Updating API key in database with Manus Project ID: ${manusProjectId}`);
    const rows = await executeQuery<any>(
      `INSERT INTO admin_settings (id, api_key_hash, updated_at, manus_project_id) 
       VALUES (1, $1, NOW(), $2)
       ON CONFLICT (id) DO UPDATE 
       SET api_key_hash = EXCLUDED.api_key_hash, 
           updated_at = NOW(),
           manus_project_id = EXCLUDED.manus_project_id
       RETURNING *`,
      [apiKeyHash, manusProjectId]
    );
    return rows[0];
  },

  // ... (all other queries remain the same, just use executeQuery)
};

// ✅ Keep the rest of your queries identical but using executeQuery
// ... (UserCreditsQueries, CreditUsageQueries remain the same)

export { pool, pool as db };
export default pool;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database pool...');
  await pool.end();
  process.exit(0);
});