// app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { require2Auth, requireAuth } from '@/lib/auth/user'
import { executeQuery } from '@/lib/db'

// ---------------------------------------------------------------------------
// Row shape coming back from Postgres (matches your actual schema)
// ---------------------------------------------------------------------------
type DocumentRow = {
  id: string
  project_id: string | null
  user_id: string
  file_name: string
  file_type: string
  file_size: number | null
  blob_url: string
  blob_size: number | null
  content_preview: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  uploaded_by: string | null
}

// ---------------------------------------------------------------------------
// Map DB row -> API JSON shape the frontend already expects
// ---------------------------------------------------------------------------
const toApiDoc = (row: DocumentRow) => ({
  id: row.id,
  projectId: row.project_id,
  name: row.file_name,
  type: row.file_type,
  size: row.file_size ?? row.blob_size ?? null,
  fileUrl: row.blob_url,
  version: '1.0',
  uploadedBy: row.uploaded_by ?? row.user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// ---------------------------------------------------------------------------
// GET /api/documents?projectId=xxx
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    await require2Auth('PROJECT_MANAGER', 'CEO', 'TEAM_MEMBER')

    const projectId = request.nextUrl.searchParams.get('projectId')

    const params: any[] = []
    let where = 'WHERE d.is_deleted = false'
    if (projectId) {
      params.push(projectId)
      where += ` AND d.project_id = $${params.length}::uuid`
    }

    const sql =
      'SELECT d.id, d.project_id, d.user_id, d.file_name, d.file_type, ' +
      'd.file_size, d.blob_url, d.blob_size, d.content_preview, ' +
      'd.created_at, d.updated_at, d.is_deleted, d.uploaded_by ' +
      'FROM documents d ' +
      where +
      ' ORDER BY d.created_at DESC'

    const rows = await executeQuery<DocumentRow>(sql, params)

    return NextResponse.json({
      success: true,
      data: rows.map(toApiDoc),
    })
  } catch (error) {
    console.error('documents GET:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/documents
// Body: { projectId, name, type, size, fileUrl, uploadedBy?, contentPreview? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER')

    const body = await request.json()
    const { projectId, name, type, size, fileUrl, uploadedBy, contentPreview } = body

    if (!name || !fileUrl) {
      return NextResponse.json(
        { error: 'name and fileUrl are required' },
        { status: 400 }
      )
    }

    const fileName = String(name).slice(0, 255)
    const fileType = String(type || fileName.split('.').pop() || 'FILE').slice(0, 50)
    const fileSize = Number.isFinite(Number(size)) ? Number(size) : null
    const userId = user?.id || uploadedBy || null

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user id' },
        { status: 400 }
      )
    }

    const uploadedByStr = String(user?.name || userId).slice(0, 255)

    const insertSql =
      'INSERT INTO documents (' +
      '  project_id, user_id, file_name, file_type, file_size, ' +
      '  blob_url, blob_size, content_preview, uploaded_by, ' +
      '  created_at, updated_at, is_deleted' +
      ') VALUES (' +
      '  $1::uuid, $2::uuid, $3, $4, $5, ' +
      '  $6, $7, $8, $9, ' +
      '  NOW(), NOW(), false' +
      ') RETURNING ' +
      '  id, project_id, user_id, file_name, file_type, file_size, ' +
      '  blob_url, blob_size, content_preview, created_at, updated_at, ' +
      '  is_deleted, uploaded_by'

    const [row] = await executeQuery<DocumentRow>(insertSql, [
      projectId || null,
      userId,
      fileName,
      fileType,
      fileSize,
      fileUrl,
      fileSize,
      contentPreview || null,
      uploadedByStr,
    ])

    try {
      await executeQuery(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata) ' +
        'VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6)',
        [
          userId,
          'UPLOAD_DOCUMENT',
          'DOCUMENT',
          row.id,
          JSON.stringify({ name: fileName, projectId }),
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ]
      )
    } catch (auditErr) {
      console.warn('audit log failed (non-fatal):', auditErr)
    }

    return NextResponse.json({ success: true, data: toApiDoc(row) })
  } catch (error) {
    console.error('documents POST:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/documents?id=xxx
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth('PROJECT_MANAGER')
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await request.json()
    const map: Record<string, string> = {
      name: 'file_name',
      type: 'file_type',
      size: 'file_size',
      fileUrl: 'blob_url',
      contentPreview: 'content_preview',
    }

    const fields: string[] = []
    const values: any[] = []
    let i = 1
    for (const [key, column] of Object.entries(map)) {
      if (body[key] !== undefined) {
        fields.push(`${column} = $${i++}`)
        values.push(body[key] === '' ? null : body[key])
      }
    }
    if (!fields.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    values.push(id)
    const sql =
      'UPDATE documents SET ' +
      fields.join(', ') +
      ', updated_at = NOW() WHERE id = $' + i + '::uuid AND is_deleted = false RETURNING ' +
      'id, project_id, user_id, file_name, file_type, file_size, ' +
      'blob_url, blob_size, content_preview, created_at, updated_at, ' +
      'is_deleted, uploaded_by'

    const [row] = await executeQuery<DocumentRow>(sql, values)
    if (!row) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: toApiDoc(row) })
  } catch (error) {
    console.error('documents PATCH:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/documents?id=xxx
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER')
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const rows = await executeQuery<{ id: string }>(
      'UPDATE documents SET is_deleted = true, updated_at = NOW() ' +
      'WHERE id = $1::uuid AND is_deleted = false RETURNING id',
      [id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    try {
      await executeQuery(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata) ' +
        'VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6)',
        [
          user.id,
          'DELETE_DOCUMENT',
          'DOCUMENT',
          id,
          JSON.stringify({}),
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ]
      )
    } catch (auditErr) {
      console.warn('audit log failed (non-fatal):', auditErr)
    }

    return NextResponse.json({ success: true, message: 'Document deleted' })
  } catch (error) {
    console.error('documents DELETE:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}