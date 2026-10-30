// app/api/portfolios/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth,require2Auth } from '@/lib/auth/user';
import { executeQuery } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await require2Auth('PROJECT_MANAGER','CEO');
    const body = await request.json();

    const {
      name,
      code,
      description,
      type,
      industry,
      sector,
      objective,
      strategicAlignment,
      businessCase,
      expectedBenefits,
      investmentAmount,
      currency,
      startDate,
      endDate,
      resourceRequirements,
      keyStakeholders,
      sponsorName,
      sponsorEmail,
      governanceStructure,
      reportingRequirements,
      approvalProcess,
      createdBy
    } = body;

    // Validate required fields
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if portfolio code already exists
    const existing = await executeQuery(
      `SELECT id FROM portfolios WHERE code = $1`,
      [code]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Portfolio code already exists' },
        { status: 409 }
      );
    }

    // Insert portfolio
    const result = await executeQuery(
      `INSERT INTO portfolios (
        name, code, description, type, industry, sector,
        objective, strategic_alignment, business_case, expected_benefits,
        investment_amount, currency,
        start_date, end_date,
        resource_requirements, key_stakeholders,
        sponsor_name, sponsor_email,
        governance_structure, reporting_requirements, approval_process,
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'ACTIVE', $22)
      RETURNING 
        id, name, code, description, type, status,
        created_at as "createdAt"
      `,
      [
        name,
        code,
        description || null,
        type,
        industry || null,
        sector || null,
        objective,
        strategicAlignment || null,
        businessCase || null,
        JSON.stringify(expectedBenefits || []),
        investmentAmount,
        currency || 'USD',
        startDate,
        endDate,
        JSON.stringify(resourceRequirements || []),
        JSON.stringify(keyStakeholders || []),
        sponsorName || null,
        sponsorEmail || null,
        governanceStructure || null,
        reportingRequirements || null,
        approvalProcess || null,
        createdBy || user.id
      ]
    );

    // Create audit log
    await executeQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id,
        'CREATE_PORTFOLIO',
        'PORTFOLIO',
        result[0].id,
        JSON.stringify(body),
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    return NextResponse.json({ 
      success: true, 
      data: result[0],
      message: 'Portfolio registered successfully'
    });

  } catch (error) {
    console.error('Error creating portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to create portfolio' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const searchParams = request.nextUrl.searchParams;
    const portfolioId = searchParams.get('id');
    const status = searchParams.get('status') || 'ACTIVE';

    if (portfolioId) {
      // Get single portfolio
      const result = await executeQuery(
        `SELECT 
          p.*,
          u.name as created_by_name,
          (
            SELECT COUNT(*) FROM projects WHERE portfolio_id = p.id
          ) as project_count,
          (
            SELECT COALESCE(SUM(budget), 0) FROM projects WHERE portfolio_id = p.id
          ) as total_budget
        FROM portfolios p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = $1`,
        [portfolioId]
      );

      if (result.length === 0) {
        return NextResponse.json(
          { error: 'Portfolio not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: result[0] });
    } else {
      // Get all portfolios
      const result = await executeQuery(
        `SELECT 
          p.*,
          u.name as created_by_name,
          (
            SELECT COUNT(*) FROM projects WHERE portfolio_id = p.id
          ) as project_count,
          (
            SELECT COALESCE(SUM(budget), 0) FROM projects WHERE portfolio_id = p.id
          ) as total_budget
        FROM portfolios p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.status = $1
        ORDER BY p.created_at DESC`,
        [status]
      );

      return NextResponse.json({ success: true, data: result });
    }
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolios' },
      { status: 500 }
    );
  }
}