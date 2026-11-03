import { NextRequest, NextResponse } from 'next/server';
import { require2Auth } from '@/lib/auth/user';
import { executeQuery } from '@/lib/db';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await require2Auth('PROJECT_MANAGER', 'CEO');
    const { id } = await params;
    const body = await request.json();
    const allowed = ['name', 'description', 'status', 'budget'];
    const entries = Object.entries(body).filter(([key, value]) => allowed.includes(key) && value !== undefined);
    if (!entries.length) return NextResponse.json({ error: 'No editable fields supplied.' }, { status: 400 });
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
    const rows = await executeQuery(`UPDATE projects SET ${assignments}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`, [...values, id]);
    if (!rows.length) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update project.' }, { status: 500 });
  }
}
