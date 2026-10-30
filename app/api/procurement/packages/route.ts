// app/api/procurement/packages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/user'
import { executeQuery } from '@/lib/db'
import { ActualCostQueries } from '@/lib/db/queries/actualCosts'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER')
    const body = await request.json()

    const {
      projectId, title, description, vendorId,
      contractValue, paymentSchedule, terms,
    } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'Package title is required' }, { status: 400 })
    }
    const cv = Number(contractValue)
    if (!Number.isFinite(cv) || cv <= 0) {
      return NextResponse.json({ error: 'Contract value must be greater than 0' }, { status: 400 })
    }

    const insertSql = `
      INSERT INTO procurement_packages (
        project_id, vendor_id, title, description, contract_value,
        payment_schedule, terms, status, created_at, updated_at
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4, $5,
        $6, $7, $8, NOW(), NOW()
      )
      RETURNING id, project_id, vendor_id, title, contract_value, status, created_at
    `

    const [pkg] = await executeQuery<any>(insertSql, [
      projectId,
      vendorId && String(vendorId).trim() ? vendorId : null,
      String(title).trim().slice(0, 255),
      description ? String(description) : null,
      cv,
      paymentSchedule ? String(paymentSchedule) : null,
      terms ? String(terms) : null,
      'DRAFT',
    ])

    try {
      await executeQuery(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
         VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6)`,
        [
          user.id,
          'CREATE_PACKAGE',
          'PROCUREMENT_PACKAGE',
          pkg.id,
          JSON.stringify(body),
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ]
      )
    } catch (auditErr) {
      console.warn('audit log failed (non-fatal):', auditErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: pkg.id,
        projectId: pkg.project_id,
        vendorId: pkg.vendor_id,
        title: pkg.title,
        contractValue: Number(pkg.contract_value),
        status: pkg.status,
        createdAt: pkg.created_at,
      },
    })
  } catch (error) {
    console.error('procurement packages POST:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to register package' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/procurement/packages?id=xxx
// Body can include any subset: { status, title, description, contractValue,
//                                  vendorId, paymentSchedule, terms }
// ---------------------------------------------------------------------------
const ALLOWED_STATUSES = [
  'DRAFT', 'RELEASED', 'AWARDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
]

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER')
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const body = await request.json()
    const [before] = await executeQuery<any>('SELECT status FROM procurement_packages WHERE id = $1::uuid', [id])

    const fields: string[] = []
    const values: any[] = []
    let i = 1

    if (body.status !== undefined) {
      const next = String(body.status).trim().toUpperCase()
      if (!ALLOWED_STATUSES.includes(next)) {
        return NextResponse.json(
          { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      fields.push(`status = $${i++}`)
      values.push(next)
    }

    if (body.title !== undefined) {
      fields.push(`title = $${i++}`)
      values.push(String(body.title).trim().slice(0, 255))
    }
    if (body.description !== undefined) {
      fields.push(`description = $${i++}`)
      values.push(body.description ? String(body.description) : null)
    }
    if (body.contractValue !== undefined) {
      const cv = Number(body.contractValue)
      if (!Number.isFinite(cv) || cv < 0) {
        return NextResponse.json({ error: 'Invalid contract value' }, { status: 400 })
      }
      fields.push(`contract_value = $${i++}`)
      values.push(cv)
    }
    if (body.vendorId !== undefined) {
      fields.push(`vendor_id = $${i++}::uuid`)
      values.push(body.vendorId && String(body.vendorId).trim() ? body.vendorId : null)
    }
    if (body.paymentSchedule !== undefined) {
      fields.push(`payment_schedule = $${i++}`)
      values.push(body.paymentSchedule ? String(body.paymentSchedule) : null)
    }
    if (body.terms !== undefined) {
      fields.push(`terms = $${i++}`)
      values.push(body.terms ? String(body.terms) : null)
    }

    if (!fields.length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    values.push(id)
    const sql = `
      UPDATE procurement_packages
         SET ${fields.join(', ')},
             updated_at = NOW()
       WHERE id = $${i}::uuid
       RETURNING id, project_id, vendor_id, title, description,
                 contract_value, payment_schedule, terms, status,
                 created_at, updated_at
    `

    const [row] = await executeQuery<any>(sql, values)

    if (!row) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    // A completed package becomes an actual cost exactly once. The reference marker
    // makes repeated edits and retries idempotent.
    if (String(row.status).toUpperCase() === 'COMPLETED' && String(before?.status).toUpperCase() !== 'COMPLETED') {
      const referenceNumber = `PROCUREMENT_PACKAGE:${id}`
      const [existingCost] = await executeQuery<any>('SELECT id FROM actual_costs WHERE reference_number = $1 LIMIT 1', [referenceNumber])
      if (!existingCost) {
        await ActualCostQueries.create({
          projectId: row.project_id,
          amount: Number(row.contract_value) || 0,
          period: new Date().toISOString().slice(0, 10),
          costType: 'PROCUREMENT',
          description: `Completed procurement package: ${row.title}`,
          referenceNumber,
          vendorId: row.vendor_id || undefined,
          approvedBy: user.id,
          status: 'APPROVED',
          currency: 'USD',
          exchangeRate: 1,
        })
      }
    }

    // Best-effort audit
    try {
      await executeQuery(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
         VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6)`,
        [
          user.id,
          'UPDATE_PACKAGE',
          'PROCUREMENT_PACKAGE',
          id,
          JSON.stringify(body),
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ]
      )
    } catch (auditErr) {
      console.warn('audit log failed (non-fatal):', auditErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        projectId: row.project_id,
        vendorId: row.vendor_id,
        title: row.title,
        description: row.description,
        contractValue: row.contract_value != null ? Number(row.contract_value) : 0,
        paymentSchedule: row.payment_schedule,
        terms: row.terms,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    })
  } catch (error) {
    console.error('procurement packages PATCH:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 })
  }
}
