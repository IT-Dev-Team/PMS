// app/api/risks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters';

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { id: decoded.userId || decoded.id, role: decoded.role };
  } catch { return null; }
}

// GET /api/risks?projectId=xxx
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT id, project_id, title, description, probability, impact, risk_score, risk_level,
              mitigation_plan, contingency_plan, status, category, owner_id, created_at, updated_at
       FROM risks WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );
    client.release();
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[GET /api/risks] Error:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/risks
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


  let client;
  try {
    const body = await req.json();
    const { projectId, title, description, probability, impact, risk_level, category, mitigation_plan, contingency_plan, status, owner_id } = body;

    if (!projectId || !title || !category) {
      return NextResponse.json({ error: 'projectId, title, category required' }, { status: 400 });
    }

    // Validate probability/impact ranges (1-5)
    const prob = probability != null ? parseInt(probability) : null;
    const imp = impact != null ? parseInt(impact) : null;
    if (prob !== null && (prob < 1 || prob > 5)) {
      return NextResponse.json({ error: 'Probability must be between 1 and 5' }, { status: 400 });
    }
    if (imp !== null && (imp < 1 || imp > 5)) {
      return NextResponse.json({ error: 'Impact must be between 1 and 5' }, { status: 400 });
    }

    // Calculate risk_score = probability * impact (if both provided)
    const risk_score = (prob !== null && imp !== null) ? prob * imp : null;

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO risks 
         (project_id, title, description, probability, impact, risk_score, risk_level,
          mitigation_plan, contingency_plan, status, category, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        projectId,
        title,
        description || null,
        prob,
        imp,
        risk_score,
        risk_level || null,
        mitigation_plan || null,
        contingency_plan || null,
        status || 'IDENTIFIED',
        category,
        owner_id || null,
      ]
    );
    client.release();
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('[POST /api/risks] Error:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/risks?id=xxx
export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  let client;
  try {
    const body = await req.json();
    const { title, description, probability, impact, risk_level, mitigation_plan, contingency_plan, status, category, owner_id } = body;

    // Build dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) { updates.push(`title = $${paramIndex++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
    if (probability !== undefined) { 
      const prob = parseInt(probability);
      if (prob < 1 || prob > 5) return NextResponse.json({ error: 'Probability must be 1-5' }, { status: 400 });
      updates.push(`probability = $${paramIndex++}`); values.push(prob);
    }
    if (impact !== undefined) {
      const imp = parseInt(impact);
      if (imp < 1 || imp > 5) return NextResponse.json({ error: 'Impact must be 1-5' }, { status: 400 });
      updates.push(`impact = $${paramIndex++}`); values.push(imp);
    }
    if (mitigation_plan !== undefined) { updates.push(`mitigation_plan = $${paramIndex++}`); values.push(mitigation_plan); }
    if (contingency_plan !== undefined) { updates.push(`contingency_plan = $${paramIndex++}`); values.push(contingency_plan); }
    if (status !== undefined) { updates.push(`status = $${paramIndex++}`); values.push(status); }
    if (category !== undefined) { updates.push(`category = $${paramIndex++}`); values.push(category); }
    if (owner_id !== undefined) { updates.push(`owner_id = $${paramIndex++}`); values.push(owner_id); }
    if (risk_level !== undefined) { updates.push(`risk_level = $${paramIndex++}`); values.push(risk_level); }

    // Recalculate risk_score if probability or impact changed
    let recalcRiskScore = false;
    let probVal: number | null = null;
    let impVal: number | null = null;
    if (probability !== undefined) {
      probVal = parseInt(probability);
      recalcRiskScore = true;
    }
    if (impact !== undefined) {
      impVal = parseInt(impact);
      recalcRiskScore = true;
    }
    // If both are provided, compute; if one is missing, we'd need to fetch current values to compute? 
    // Better: we can compute if both are present; if not, we leave as is.
    // We'll handle by updating risk_score only if both probability and impact are provided in the update.
    if (probability !== undefined && impact !== undefined) {
      const newScore = (probVal !== null && impVal !== null) ? probVal * impVal : null;
      updates.push(`risk_score = $${paramIndex++}`);
      values.push(newScore);
    } else if (recalcRiskScore && (probability !== undefined || impact !== undefined)) {
      // If only one changed, we need to fetch the other from DB.
      // We'll do a separate query to get current values and recalc.
      // To keep it simple, we'll just update and recalc in a separate step.
      // Let's handle by fetching current risk first.
      const current = await client.query('SELECT probability, impact FROM risks WHERE id = $1', [id]);
      if (current.rows.length === 0) return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
      const curProb = current.rows[0].probability;
      const curImp = current.rows[0].impact;
      const newProb = probability !== undefined ? parseInt(probability) : curProb;
      const newImp = impact !== undefined ? parseInt(impact) : curImp;
      if (newProb !== null && newImp !== null) {
        const newScore = newProb * newImp;
        updates.push(`risk_score = $${paramIndex++}`);
        values.push(newScore);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE risks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    client = await pool.connect();
    const result = await client.query(query, values);
    client.release();

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('[PATCH /api/risks] Error:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/risks?id=xxx
export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  let client;
  try {
    client = await pool.connect();
    const result = await client.query('DELETE FROM risks WHERE id = $1 RETURNING id', [id]);
    client.release();
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Risk deleted' });
  } catch (error) {
    console.error('[DELETE /api/risks] Error:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}