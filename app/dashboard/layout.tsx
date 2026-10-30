import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import pool from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET!;

interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  role: string;
  provider: string;
  iat: number;
  exp: number;
}

async function getUserFromToken() {
  const cookieStore = await cookies();

  try {
    const token = cookieStore.get("token")?.value;
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    const client = await pool.connect();
    const result = await client.query(
      `SELECT id, email, name, role, is_admin
       FROM users
       WHERE id = $1`,
      [decoded.userId || (decoded as TokenPayload & { id?: string }).id],
    );
    client.release();

    if (result.rows.length === 0) return null;

    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "TEAM_MEMBER",
      isAdmin: user.is_admin || false,
    };
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserFromToken();

  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader user={user} />
      <div className="eih-page-shell">
        <main className="relative mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
