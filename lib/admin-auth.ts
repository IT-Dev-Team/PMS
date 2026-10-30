import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Get auth token from request cookies
 */
export async function getAuthToken(request: NextRequest): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return null;
    }
    
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Verify JWT token and return decoded payload
 */
export async function verifyToken(request: NextRequest): Promise<any | null> {
  try {
    const token = await getAuthToken(request);
    
    if (!token) {
      return null;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Verify admin authentication token
 * This checks if the user is authenticated and has admin privileges
 */
export async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const decoded = await verifyToken(request);
    
    if (!decoded) {
      return false;
    }
    
    // Check if user has admin privileges
    // Assuming the token contains an isAdmin field or role field
    if (decoded.isAdmin === true || decoded.role === 'admin') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error verifying admin:', error);
    return false;
  }
}

/**
 * Verify regular user authentication (non-admin)
 */
export async function verifyAuth(request: NextRequest): Promise<boolean> {
  try {
    const decoded = await verifyToken(request);
    
    if (!decoded) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying auth:', error);
    return false;
  }
}

/**
 * Get current user from token
 */
export async function getCurrentUser(request: NextRequest): Promise<any | null> {
  try {
    const decoded = await verifyToken(request);
    return decoded;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Get user ID from token
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  try {
    const decoded = await verifyToken(request);
    return decoded?.userId || decoded?.id || null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}

/**
 * Create auth response with token
 */
export function createAuthResponse(data: any, token: string): NextResponse {
  const response = NextResponse.json({
    success: true,
    data,
  });
  
  // Set cookie with token
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
  
  return response;
}

/**
 * Clear auth cookie (logout)
 */
export function clearAuthResponse(): NextResponse {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });
  
  response.cookies.delete('token');
  
  return response;
}