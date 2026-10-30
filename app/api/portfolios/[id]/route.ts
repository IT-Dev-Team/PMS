import { NextRequest, NextResponse } from "next/server";
import { require2Auth } from "@/lib/auth/user";
import { executeQuery } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await require2Auth("PROJECT_MANAGER", "CEO");
    const { id } = await params;
    const body = await request.json();
    const allowed: Record<string, string> = {
      name: "name",
      code: "code",
      description: "description",
      sector: "sector",
      industry: "industry",
      objective: "objective",
      status: "status",
    };
    const entries = Object.entries(body).filter(([key, value]) => allowed[key] && value !== undefined);
    if (!entries.length) return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => `${allowed[key]} = $${index + 1}`);
    values.push(id);
    const rows = await executeQuery(
      `UPDATE portfolios SET ${assignments.join(", ")}, updated_at = NOW() WHERE id = $${values.length}::uuid RETURNING *`,
      values,
    );
    if (!rows.length) return NextResponse.json({ error: "Sector or cluster not found" }, { status: 404 });
    await executeQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, "UPDATE_PORTFOLIO", "PORTFOLIO", id, JSON.stringify(body), JSON.stringify({ timestamp: new Date().toISOString() })],
    );
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    console.error("Error updating sector or cluster:", error);
    return NextResponse.json({ error: "Failed to update sector or cluster" }, { status: 500 });
  }
}
