// app/api/issues/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters';

// Helper: get authenticated user from token
async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { id: decoded.userId || decoded.id, role: decoded.role };
  } catch {
    return null;
  }
}

// GET /api/issues?projectId=xxx
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  let client = null;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT 
         id, project_id, title, description, severity, status,
         reported_by, assigned_to, resolution, created_at, updated_at, resolved_at
       FROM issues
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );
    client.release();
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[GET /api/issues] Error:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/issues
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Minimum role check – adjust as needed (e.g., allow PM or TEAM_MEMBER)
/*  if (!['PROJECT_MANAGER', 'TEAM_MEMBER', 'CEO'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }*/

  let client = null;
  try {
    const body = await req.json();
    const { projectId, title, description, severity, assignedTo } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: 'projectId and title are required' }, { status: 400 });
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO issues 
         (project_id, title, description, severity, reported_by, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, project_id, title, description, severity, status,
                 reported_by, assigned_to, resolution, created_at, updated_at, resolved_at`,
      [
        projectId,
        title,
        description || null,
        severity || 'MEDIUM',
        user.id,
        assignedTo || null,
      ]
    );
    client.release();
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('[POST /api/issues] Error:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/issues?id=xxx
export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }



  const searchParams = req.nextUrl.searchParams;
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  let client = null;
  try {
    const body = await req.json();
    const { title, description, severity, status, assignedTo, resolution } = body;

    // Build dynamic SET clause
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (severity !== undefined) {
      updates.push(`severity = $${paramIndex++}`);
      values.push(severity);
    }
    if (status !== undefined) {
      // If status is being set to RESOLVED, automatically set resolved_at
      if (status === 'RESOLVED') {
        updates.push(`resolved_at = NOW()`);
      }
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      values.push(assignedTo);
    }
    if (resolution !== undefined) {
      updates.push(`resolution = $${paramIndex++}`);
      values.push(resolution);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    // Add id as last parameter
    values.push(id);

    const query = `
      UPDATE issues
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, project_id, title, description, severity, status,
                reported_by, assigned_to, resolution, created_at, updated_at, resolved_at
    `;

    client = await pool.connect();
    const result = await client.query(query, values);
    client.release();

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('[PATCH /api/issues] Error:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/issues?id=xxx (optional – only CEO or admin)
export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }



  const searchParams = req.nextUrl.searchParams;
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  let client = null;
  try {
    client = await pool.connect();
    const result = await client.query('DELETE FROM issues WHERE id = $1 RETURNING id', [id]);
    client.release();

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Issue deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/issues] Error:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}