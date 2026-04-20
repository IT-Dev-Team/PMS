import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

export interface JWTPayload {
  userId: string
  email: string
  name: string
}

export function createToken(payload: JWTPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET)
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload
  } catch (error) {
    console.error('Token decode failed:', error)
    return null
  }
}