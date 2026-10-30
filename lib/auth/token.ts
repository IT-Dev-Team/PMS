// lib/auth/token.ts
export interface TokenPayload {
  userId?: string;
  id?: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  role?: string;
  provider?: string;
  manusProjectId?: string | null;
  iat?: number;
  exp?: number;
}
