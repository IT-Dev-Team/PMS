// lib/auth/user.ts
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import pool  from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'sk-ntp92AI18vkuMqHHoEmmRkT1Cwh5ekKkW8HZTrZOd2QmbhJfGKWgIjwaSC58hwenvR3l6x39uaagRyfjXq3606UCKVGS';

export interface TokenPayload {
  userId?: string;
  id?: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  role?: string;
  provider?: string;
  iat?: number;
  exp?: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  try {
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return null;
    }
    
    // Get fresh user data from database
    const client = await pool.connect();
    const result = await client.query(
      `SELECT id, email, name, role, is_admin 
       FROM users 
       WHERE id = $1`,
      [userId]
    );
    client.release();

    if (result.rows.length === 0) {
      // Fallback to token payload if db query is empty but user is signed in
      return {
        id: userId,
        email: decoded.email,
        name: decoded.name || 'EIH User',
        role: decoded.role || 'PROJECT_MANAGER',
        isAdmin: decoded.isAdmin || false
      };
    }

    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'PROJECT_MANAGER',
      isAdmin: user.is_admin || false
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function requireAuth(role?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    const { redirect } = await import('next/navigation');
    redirect('/auth/login');
    throw new Error('Unauthenticated');
  }
  
  if (role && user.role !== role) {
    const { redirect } = await import('next/navigation');
    redirect('/unauthorized');
    throw new Error('Unauthorized');
  }
  
  return user;
}

export async function require2Auth(role?: string, role2?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    const { redirect } = await import('next/navigation');
    redirect('/auth/login');
    throw new Error('Unauthenticated');
  }
  
  if (role && (user.role !== role && user.role !== role2)) {
    const { redirect } = await import('next/navigation');
    redirect('/unauthorized');
    throw new Error('Unauthorized');
  }
  
  return user;
}