import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { executeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

const number = (value: unknown) => Number(value || 0);

function ragFor(project: any, financial: any, risks: any[], issues: any[], tasks: any[]) {
  const cpi = number(financial?.cpi);
  const spi = number(financial?.spi);
  const criticalRisks = risks.filter((item) => ["CRITICAL", "HIGH"].includes(String(item.risk_level || item.riskLevel).toUpperCase()) && String(item.status).toUpperCase() !== "CLOSED").length;
  const criticalIssues = issues.filter((item) => ["CRITICAL", "HIGH"].includes(String(item.severity).toUpperCase()) && !["RESOLVED", "CLOSED"].includes(String(item.status).toUpperCase())).length;
  const blocked = tasks.filter((item) => String(item.status).toUpperCase() === "BLOCKED").length;
  if (criticalRisks > 0 || criticalIssues > 0 || cpi < 0.95 || spi < 0.95) return "RED";
  if (blocked > 0 || cpi < 1 || spi < 1 || String(project.status).toUpperCase() === "ON_HOLD") return "AMBER";
  return "GREEN";
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const role = String(user.role || "").toUpperCase();
    if (!user.isAdmin && !role.includes("CEO") && !role.includes("PROJECT_MANAGER") && !role.includes("PORTFOLIO_MANAGER")) {
      return NextResponse.json({ error: "You do not have access to project context." }, { status: 403 });
    }
    const canSeeAll = Boolean(user?.isAdmin) || role.includes("CEO") || role.includes("ADMIN") || role.includes("PORTFOLIO_MANAGER");
    const projects = await executeQuery(
      `SELECT p.*, u.name as manager_name
       FROM projects p LEFT JOIN users u ON u.id::text = p.manager_id::text
       WHERE p.status != 'CANCELLED' ${canSeeAll ? "" : "AND p.manager_id::text = $1::text"}
       ORDER BY p.name ASC`,
      canSeeAll ? [] : [user.id]
    );

    const data = await Promise.all(projects.map(async (project: any) => {
      const id = project.id;
      const [plans, tasks, actualCosts, evm, risks, issues, packages, reports] = await Promise.all([
        executeQuery(`SELECT * FROM plans WHERE project_id::text = $1::text ORDER BY parent_id NULLS FIRST, created_at ASC`, [id]),
        executeQuery(`SELECT * FROM tasks WHERE project_id::text = $1::text ORDER BY created_at ASC`, [id]),
        executeQuery(`SELECT * FROM actual_costs WHERE project_id::text = $1::text ORDER BY created_at DESC`, [id]),
        executeQuery(`SELECT * FROM evm_data WHERE project_id::text = $1::text ORDER BY period DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1`, [id]),
        executeQuery(`SELECT * FROM risks WHERE project_id::text = $1::text ORDER BY created_at DESC`, [id]),
        executeQuery(`SELECT * FROM issues WHERE project_id::text = $1::text ORDER BY created_at DESC`, [id]),
        executeQuery(`SELECT p.*, v.name as vendor_name FROM procurement_packages p LEFT JOIN vendors v ON v.id::text = p.vendor_id::text WHERE p.project_id::text = $1::text ORDER BY p.created_at DESC`, [id]),
        executeQuery(`SELECT * FROM reports WHERE project_id::text = $1::text ORDER BY report_date DESC, created_at DESC`, [id]),
      ]);

      const financial = evm[0] || {};
      const budget = number(project.budget);
      const actualCost = actualCosts.reduce((sum: number, item: any) => sum + number(item.amount), 0);
      const progress = number(project.progress ?? project.percent_complete);
      return {
        overview: {
          id, code: project.code, name: project.name, description: project.description,
          status: project.status, rag: ragFor(project, financial, risks, issues, tasks),
          progress, startDate: project.start_date, endDate: project.end_date,
          manager: project.manager_name, budget, actualCost,
          cpi: financial.cpi ?? null, spi: financial.spi ?? null,
          plannedValue: financial.planned_value ?? null, earnedValue: financial.earned_value ?? null,
          estimateAtCompletion: financial.eac ?? null, varianceAtCompletion: financial.vac ?? null,
        },
        planning: { plans, tasks, reports },
        financial: { budget, actualCost, costs: actualCosts, evm: financial },
        procurement: packages,
        risk: risks,
        issues,
      };
    }));

    return NextResponse.json({ generatedAt: new Date().toISOString(), source: "project-context-api", projectCount: data.length, projects: data });
  } catch (error) {
    console.error("[Project context API] failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build project context." }, { status: 500 });
  }
}
