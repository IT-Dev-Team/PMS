// app/api/procurement/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/user';
import { executeQuery } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const body = await request.json();
    const { type, rows, userId } = body;

    if (!type || !rows || !rows.length) {
      return NextResponse.json(
        { error: 'Invalid import data' },
        { status: 400 }
      );
    }

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    if (type === 'package') {
      for (const row of rows) {
        try {
          // Insert package
          const packageResult = await executeQuery(
            `INSERT INTO procurement_packages (
              title, code, category, description, project_id, vendor_id,
              contract_value, currency, start_date, end_date, delivery_date,
              payment_schedule, terms, status, created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DRAFT', $14, NOW(), NOW())
            RETURNING id`,
            [
              row.title,
              row.code,
              row.category,
              row.description || null,
              row.projectId,
              row.vendorId || null,
              row.contractValue,
              row.currency || 'USD',
              row.startDate || null,
              row.endDate || null,
              row.deliveryDate || null,
              row.paymentSchedule || null,
              row.terms || null,
              userId
            ]
          );

          const packageId = packageResult[0].id;

          // Insert milestones
          for (const milestone of row.milestones || []) {
            if (milestone.title && milestone.dueDate) {
              await executeQuery(
                `INSERT INTO procurement_milestones (
                  package_id, title, due_date, percentage, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, NOW(), NOW())`,
                [packageId, milestone.title, milestone.dueDate, milestone.percentage || 0]
              );
            }
          }

          created++;
        } catch (error) {
          failed++;
          errors.push(`Row ${row.rowNumber || '?'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } else if (type === 'vendor') {
      for (const row of rows) {
        try {
          await executeQuery(
            `INSERT INTO procurement_vendors (
              name, code, category, type, description, contact_name, email,
              phone, website, address, city, state, country, zip_code,
              tax_id, registration_number, established_year, employee_count,
              annual_revenue, currency, certifications, expertise, rating,
              status, created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
              $15, $16, $17, $18, $19, $20, $21, $22, $23, 'ACTIVE', $24, NOW(), NOW())`,
            [
              row.name,
              row.code,
              row.category || 'OTHER',
              row.type || 'COMPANY',
              row.description || null,
              row.contactName,
              row.email,
              row.phone,
              row.website || null,
              row.address || null,
              row.city || null,
              row.state || null,
              row.country || 'USA',
              row.zipCode || null,
              row.taxId || null,
              row.registrationNumber || null,
              row.establishedYear || null,
              row.employeeCount || null,
              row.annualRevenue || null,
              row.currency || 'USD',
              row.certifications || [],
              row.expertise || [],
              row.rating || 3,
              userId
            ]
          );
          created++;
        } catch (error) {
          failed++;
          errors.push(`Row ${row.rowNumber || '?'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return NextResponse.json({
      created,
      failed,
      errors
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}