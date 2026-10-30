// app/api/procurement/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { require2Auth } from '@/lib/auth/user'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await require2Auth('PROJECT_MANAGER', 'CEO', 'TEAM_MEMBER')

    const projectId = request.nextUrl.searchParams.get('projectId')

    // -----------------------------------------------------------------------
    // Packages
    // -----------------------------------------------------------------------
    const params: any[] = []
    let where = 'WHERE 1=1'
    if (projectId) {
      params.push(projectId)
      where += ` AND p.project_id = $${params.length}::uuid`
    }

    const packagesSql = `
      SELECT
        p.id,
        p.project_id,
        p.vendor_id,
        p.title,
        p.description,
        p.contract_value,
        p.payment_schedule,
        p.terms,
        p.status,
        p.created_at,
        p.updated_at,
        v.name AS vendor_name
      FROM procurement_packages p
      LEFT JOIN vendors v ON v.id = p.vendor_id
      ${where}
      ORDER BY p.created_at DESC
    `

    const packagesRaw = await executeQuery<any>(packagesSql, params)

    // Map DB shape -> API shape expected by ProjectDetail.tsx
    const packages = packagesRaw.map((p: any) => {
      const cv = p.contract_value != null ? Number(p.contract_value) : 0
      // Synthesise a short code from the UUID so the table's code column renders
      const shortCode = p.id ? `PKG-${String(p.id).slice(0, 8).toUpperCase()}` : 'PKG'

      return {
        id: p.id,
        title: p.title,
        code: shortCode,
        projectId: p.project_id,
        vendorId: p.vendor_id,
        vendorName: p.vendor_name || null,
        contractValue: cv,
        totalContractValue: cv,
        currency: 'USD',
        status: p.status || 'DRAFT',
        description: p.description,
        paymentSchedule: p.payment_schedule,
        terms: p.terms,
        // Synthesised fields the UI expects but the schema doesn't hold:
        category: 'GOODS',
        startDate: null,
        endDate: null,
        totalMilestones: 0,
        completedMilestones: 0,
        overdueMilestones: 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }
    })

    // -----------------------------------------------------------------------
    // Vendors (for the New Package dropdown)
    // -----------------------------------------------------------------------
      let vendors: any[] = []
    try {
      vendors = await executeQuery<any>(
        `SELECT * FROM vendors ORDER BY name ASC`
      )
    } catch (e) {
      console.warn('vendors fetch skipped:', e)
    }

    // -----------------------------------------------------------------------
    // Portfolios (used by the package modal's portfolio filter)
    // -----------------------------------------------------------------------
    let portfolios: any[] = []
    try {
      portfolios = await executeQuery<any>(
        `SELECT id, name, code FROM portfolios ORDER BY name ASC`
      )
    } catch (e) {
      console.warn('portfolios fetch skipped:', e)
    }

    // Response shape MUST be { packages, vendors, portfolios } at the TOP level
    // so that `useSWR<{ packages: ... }>(...).data?.packages` works.
    return NextResponse.json({ packages, vendors, portfolios })
  } catch (error) {
    console.error('procurement GET:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return NextResponse.json(
      { packages: [], vendors: [], portfolios: [], error: 'Failed to fetch procurement data' },
      { status: 500 }
    )
  }
}