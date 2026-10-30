// app/api/financial/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { require2Auth } from '@/lib/auth/user'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await require2Auth('PROJECT_MANAGER', 'CEO', 'TEAM_MEMBER')
    const projectId = request.nextUrl.searchParams.get('projectId')

    // Aggregate per-project financials
    const projectFinancials = await executeQuery(
      `SELECT
         p.id,
         p.name,
         p.budget,
         p.actual_cost AS "actualCost",
         COALESCE(p.budget, 0) - COALESCE(p.actual_cost, 0) AS "variance",
         e.planned_value AS "plannedValue",
         e.earned_value  AS "earnedValue",
         e.cpi, e.spi, e.eac, e.vac
       FROM projects p
       LEFT JOIN evm_data e ON e.project_id = p.id
       ${projectId ? 'WHERE p.id = $1::uuid' : ''}`,
      projectId ? [projectId] : []
    )

    // Recent cost entries (optionally scoped to a project)
    const recentCosts = await executeQuery(
      `SELECT
         ac.id,
         ac.project_id      AS "projectId",
         ac.plan_id         AS "planId",
         pl.title           AS "planName",
         ac.amount,
         ac.period,
         ac.cost_type       AS "costType",
         ac.description,
         ac.vendor_id       AS "vendorId",
         v.name             AS "vendorName",
         ac.po_number       AS "poNumber",
         ac.invoice_number  AS "invoiceNumber",
         ac.reference_number AS "referenceNumber",
         ac.exchange_rate   AS "exchangeRate",
         ac.status,
         ac.currency
       FROM actual_costs ac
       LEFT JOIN plans pl ON pl.id = ac.plan_id
       LEFT JOIN vendors v ON v.id = ac.vendor_id
       ${projectId ? 'WHERE ac.project_id = $1::uuid' : ''}
       ORDER BY ac.period DESC, ac.created_at DESC
       LIMIT 200`,
      projectId ? [projectId] : []
    )

    return NextResponse.json({
      success: true,
      projectFinancials,
      recentCosts,
    })
  } catch (error) {
    console.error('Error fetching financials:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json({ error: 'Failed to fetch financials' }, { status: 500 })
  }
}