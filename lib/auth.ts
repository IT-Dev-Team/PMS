import { NextApiRequest } from 'next'
import pool from './db'

export async function getCurrentUser(req: NextApiRequest) {
  let client;

  try {
    const sessionToken = req.cookies.session;

    if (!sessionToken) {
      return null;
    }

    client = await pool.connect();

    const result = await client.query(
      `SELECT u.id, u.email, u.name, u.avatar_url
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return null;
    }

    await client.query(
      `UPDATE sessions SET last_activity_at = NOW() WHERE token = $1`,
      [sessionToken]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  } finally {
    if (client) client.release();
  }
}