// app/(dashboard)/projects/[id]/page.tsx
import { notFound } from "next/navigation";
import { require2Auth } from "@/lib/auth/user";
import { ProjectQueries } from "@/lib/db/queries/projects";
import { PlanningQueries } from "@/lib/db/queries/planning";
import { ActualCostQueries } from "@/lib/db/queries/actualCosts";
import { ProjectDetail } from "@/components/projects/ProjectDetail";

// Optional queries – use try/catch to avoid import errors
let RiskQueries: any,
  FinancialQueries: any,
  DecisionQueries: any,
  DocumentQueries: any;
try {
  RiskQueries = require("@/lib/db/queries/risks").RiskQueries;
} catch {
  /* not available */
}
try {
  FinancialQueries = require("@/lib/db/queries/financial").FinancialQueries;
} catch {
  /* not available */
}
try {
  DecisionQueries = require("@/lib/db/queries/governance").DecisionQueries;
} catch {
  /* not available */
}
try {
  DocumentQueries = require("@/lib/db/queries/document").DocumentQueries;
} catch {
  /* not available */
}

// ---- EVM computation ----
// app/(dashboard)/projects/[id]/page.tsx
// app/(dashboard)/projects/[id]/page.tsx
function computeEVM(planningItems: any[], actualCosts: any[]) {
  const today = new Date().toISOString().split("T")[0];

  // ✅ Ensure budgets are numbers and not NULL
  const bac = planningItems.reduce(
    (sum, i) => sum + (Number(i.budget) || 0),
    0,
  );
  const pv = planningItems
    .filter((i) => i.endDate && i.endDate <= today)
    .reduce((sum, i) => sum + (Number(i.budget) || 0), 0);
  const ev = planningItems
    .filter((i) => i.status === "COMPLETED" || i.progress === 100)
    .reduce((sum, i) => sum + (Number(i.budget) || 0), 0);
  const ac = actualCosts.reduce((sum, c) => sum + Number(c.amount), 0);

  // ✅ Prevent division by zero
  const cpi = ac > 0 ? ev / ac : 0;
  const spi = pv > 0 ? ev / pv : 0;
  const eac = cpi > 0 ? bac / cpi : ac > 0 ? bac : bac; // fallback to BAC if no progress
  const vac = bac - eac;

  // ✅ Sanity check – if BAC is astronomical, something is wrong
  if (bac > 1e12) {
    console.warn("⚠️ BAC is huge – check planning item budgets:", bac);
  }

  return {
    bac: Math.round(bac * 100) / 100,
    plannedValue: Math.round(pv * 100) / 100,
    earnedValue: Math.round(ev * 100) / 100,
    actualCost: Math.round(ac * 100) / 100,
    cpi: Math.round(cpi * 100) / 100,
    spi: Math.round(spi * 100) / 100,
    eac: Math.round(eac * 100) / 100,
    vac: Math.round(vac * 100) / 100,
  };
}
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await require2Auth("PROJECT_MANAGER", "CEO");

  // 1. Await params (Next.js 15)
  const { id: projectId } = await params;

  // 2. Fetch project (required)
  const project = await ProjectQueries.findById(projectId);
  if (!project) {
    notFound();
  }

  // 3. Fetch planning items (for the Tasks tree and EVM)
  const plans = await PlanningQueries.getPlanHierarchy(projectId);
  const planningItems = plans.map((p: any) => ({
    id: p.id,
    name: p.title,
    itemType: p.plan_type?.toLowerCase() || "task",
    status: p.status || "NOT_STARTED",
    startDate: p.startDate
      ? new Date(p.startDate).toISOString()
      : new Date().toISOString(),
    endDate: p.endDate
      ? new Date(p.endDate).toISOString()
      : new Date().toISOString(),
    owner: p.assigneeName || "Unassigned",
    parentId: p.parentId,
    progress: p.progress || 0,
    budget: p.budget || 0, // ensure budget is included
  }));

  // 4. Fetch actual costs (for EVM and Financial tab)
  const actualCosts = await ActualCostQueries.getByProject(projectId);

  // 5. Compute EVM metrics
  const evm = computeEVM(planningItems, actualCosts);

  // 6. Fetch optional data (risks, decisions, documents, etc.)
  const [risksResult, decisionsResult, documentsResult] =
    await Promise.allSettled([
      RiskQueries?.findByProject(projectId),
      DecisionQueries?.findByProject(projectId),
      DocumentQueries?.findByProject(projectId),
    ]);

  const risks = risksResult.status === "fulfilled" ? risksResult.value : null;
  const decisions =
    decisionsResult.status === "fulfilled" ? decisionsResult.value : null;
  const documents =
    documentsResult.status === "fulfilled" ? documentsResult.value : null;

  // (Optional) If you have a separate financial query, you could merge it here.
  // We'll use the EVM computed values as the financials.
  const financials = evm;

  return (
    <div className="eih-section overflow-hidden">
      <ProjectDetail
        project={project}
        planningItems={planningItems}
        actualCosts={actualCosts}
        risks={risks}
        financials={financials}
        decisions={decisions}
        documents={documents}
        user={user}
      />
    </div>
  );
}
