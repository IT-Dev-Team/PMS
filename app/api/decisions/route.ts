// app/api/decisions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { require2Auth, requireAuth } from '@/lib/auth/user'
import { executeQuery } from '@/lib/db'

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------
type DecisionRow = {
  id: string
  project_id: string
  title: string
  description: string | null
  amount: string | number | null
  priority: string
  justification: string | null
  requester_id: string
  requester_name?: string | null
  status: string
  ceo_comments: string | null
  board_resolution: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Map DB row -> API JSON shape expected by ProjectDetail.tsx
// ---------------------------------------------------------------------------
const toApiDecision = (row: DecisionRow) => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  description: row.description,
  amount: row.amount != null ? Number(row.amount) : null,
  status: row.status,
  category: row.priority || null,          // priority is stored here
  owner: row.requester_name || null,       // joined user name
  boardReference: row.board_resolution || null,
  decisionDate: row.created_at,            // fallback: creation date
  dueDate: null,                           // not in schema
  attachmentUrl: null,                     // not in schema
  attachmentName: null,                    // not in schema
  ceoComments: row.ceo_comments,
  justification: row.justification,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// ---------------------------------------------------------------------------
// GET /api/decisions?projectId=xxx
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    await require2Auth('PROJECT_MANAGER', 'CEO', 'TEAM_MEMBER')

    const projectId = request.nextUrl.searchParams.get('projectId')

    const params: any[] = []
    let where = `WHERE 1=1`
    if (projectId) {
      params.push(projectId)
      where += ` AND d.project_id = $${params.length}::uuid`
    }

    const rows = await executeQuery<DecisionRow>(
      `SELECT
         d.id,
         d.project_id,
         d.title,
         d.description,
         d.amount,
         d.priority,
         d.justification,
         d.requester_id,
         u.name AS requester_name,
         d.status,
         d.ceo_comments,
         d.board_resolution,
         d.created_at,
         d.updated_at
       FROM decisions d
       LEFT JOIN users u ON u.id = d.requester_id
       ${where}
       ORDER BY d.created_at DESC`,
      params
    )

    return NextResponse.json({
      success: true,
      data: rows.map(toApiDecision),
    })
  } catch (error) {
    console.error('decisions GET:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to fetch decisions' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/decisions
// Body: { projectId, title, description, decisionDate, status, category,
//         owner, dueDate, boardReference, attachmentUrl?, attachmentName? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER')
    const body = await request.json()

    const {
      projectId,
      title,
      description,
      status,
      category,          // -> priority
      boardReference,    // -> board_resolution
      justification,
      amount,
    } = body

    if (!projectId || !title) {
      return NextResponse.json(
        { error: 'projectId and title are required' },
        { status: 400 }
      )
    }

    // Normalise
    const cleanTitle = String(title).trim().slice(0, 255)
    const cleanStatus = String(status || 'PROPOSED').trim().slice(0, 50)
    // priority is NOT NULL -> default MEDIUM
    const cleanPriority = String(category || 'MEDIUM').trim().slice(0, 50)
    const cleanDescription = description ? String(description) : null
    const cleanJustification = justification ? String(justification) : null
    const cleanBoardResolution = boardReference ? String(boardReference).slice(0, 1000) : null
    const cleanAmount =
      amount !== undefined && amount !== null && amount !== ''
        ? Number(amount)
        : null

    const [row] = await executeQuery<DecisionRow>(
      `INSERT INTO decisions (
         project_id,
         title,
         description,
         amount,
         priority,
         justification,
         requester_id,
         status,
         board_resolution,
         created_at,
         updated_at
       ) VALUES (
         $1::uuid,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7::uuid,
         $8,
         $9,
         NOW(),
         NOW()
       )
       RETURNING
         id,
         project_id,
         title,
         description,
         amount,
         priority,
         justification,
         requester_id,
         status,
         ceo_comments,
         board_resolution,
         created_at,
         updated_at`,
      [
        projectId,
        cleanTitle,
        cleanDescription,
        cleanAmount,
        cleanPriority,
        cleanJustification,
        user.id,
        cleanStatus,
        cleanBoardResolution,
      ]
    )

    // Best-effort audit (don't fail the create if this errors)
    try {
      await executeQuery(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
         VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6)`,
        [
          user.id,
          'CREATE_DECISION',
          'DECISION',
          row.id,
          JSON.stringify(body),
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ]
      )
    } catch (auditErr) {
      console.warn('audit log failed (non-fatal):', auditErr)
    }

    return NextResponse.json({ success: true, data: toApiDecision(row) })
  } catch (error) {
    console.error('decisions POST:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to create decision' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/decisions?id=xxx
// Accepts any subset of the frontend fields; unknown fields are ignored.
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER')
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const body = await request.json()

    // Field map: frontend key -> { column, transform? }
    const map: Record<string, { column: string; transform?: (v: any) => any }> = {
      title:         { column: 'title',         transform: (v) => String(v).trim().slice(0, 255) },
      description:   { column: 'description',   transform: (v) => (v ? String(v) : null) },
      status:        { column: 'status',        transform: (v) => String(v).trim().slice(0, 50) },
      category:      { column: 'priority',      transform: (v) => String(v || 'MEDIUM').trim().slice(0, 50) },
      boardReference:{ column: 'board_resolution', transform: (v) => (v ? String(v).slice(0, 1000) : null) },
      justification: { column: 'justification', transform: (v) => (v ? String(v) : null) },
      ceoComments:   { column: 'ceo_comments',  transform: (v) => (v ? String(v) : null) },
      amount:        { column: 'amount',        transform: (v) =>
                        v === '' || v == null ? null : Number(v) },
    }

    const fields: string[] = []
    const values: any[] = []
    let i = 1

    for (const [key, def] of Object.entries(map)) {
      if (body[key] !== undefined) {
        fields.push(`${def.column} = $${i++}`)
        values.push(def.transform ? def.transform(body[key]) : body[key])
      }
    }

    if (!fields.length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    values.push(id)
    const [row] = await executeQuery<DecisionRow>(
      `UPDATE decisions
         SET ${fields.join(', ')},
             updated_at = NOW()
       WHERE id = $${i}::uuid
       RETURNING
         id, project_id, title, description, amount, priority, justification,
         requester_id, status, ceo_comments, board_resolution,
         created_at, updated_at`,
      values
    )

    if (!row) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 })
    }

    // Best-effort audit
    try {
      await executeQuery(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
         VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6)`,
        [
          user.id,
          'UPDATE_DECISION',
          'DECISION',
          id,
          JSON.stringify(body),
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ]
      )
    } catch (auditErr) {
      console.warn('audit log failed (non-fatal):', auditErr)
    }

    return NextResponse.json({ success: true, data: toApiDecision(row) })
  } catch (error) {
    console.error('decisions PATCH:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to update decision' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/decisions?id=xxx
// Hard delete — the schema has no is_deleted flag.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER')
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const rows = await executeQuery<{ id: string }>(
      `DELETE FROM decisions WHERE id = $1::uuid RETURNING id`,
      [id]
    )

    if (!rows.length) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 })
    }

    // Best-effort audit
    try {
      await executeQuery(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
         VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6)`,
        [
          user.id,
          'DELETE_DECISION',
          'DECISION',
          id,
          JSON.stringify({}),
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ]
      )
    } catch (auditErr) {
      console.warn('audit log failed (non-fatal):', auditErr)
    }

    return NextResponse.json({ success: true, message: 'Decision deleted' })
  } catch (error) {
    console.error('decisions DELETE:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to delete decision' }, { status: 500 })
  }
}