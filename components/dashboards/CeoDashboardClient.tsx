"use client";

import { useCallback } from "react";
import toast from "react-hot-toast";

import { CEOExecutiveDashboard } from "@/components/dashboards/CEOExecutiveDashboard";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import { useNotifications } from "@/hooks/useNotifications";
import { useDashboardNav } from "@/hooks/useDashboardNav";

type Props = {
  portfolios: any[];
  overallHealth: number;
  user: { id: string; name: string; role: string };
};

export function CeoDashboardClient({ portfolios, user }: Props) {
  const { push } = useNotifications();
  const nav = useDashboardNav();

  const findProject = useCallback(
    (projectId: string) => {
      for (const pf of portfolios) {
        const p = (pf.projects || []).find(
          (x: any) => String(x.id) === String(projectId),
        );
        if (p) return p;
      }
      return null;
    },
    [portfolios],
  );

  const activeProject = nav.activeProjectId
    ? findProject(nav.activeProjectId)
    : null;

  const handleReportSubmittedToCeo = useCallback(
    (
      report: { id: string; projectId: string },
      project: { id: string; name: string },
    ) => {
      push({
        type: "REPORT_SUBMITTED_TO_CEO",
        title: "New report submitted to CEO",
        message: `"${project.name}" — a new progress report is awaiting your review.`,
        projectId: project.id,
        projectName: project.name,
        targetType: "report",
        targetId: report.id,
        submittedBy: user.name,
      });
      toast.success("Report submitted to CEO");
    },
    [push, user.name],
  );

  const handleIssueEscalated = useCallback(
    (
      issue: {
        id: string;
        projectId: string;
        title: string;
        severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      },
      project: { id: string; name: string },
    ) => {
      push({
        type: "ISSUE_CEO_ATTENTION",
        title: "Issue requires CEO attention",
        message: issue.title,
        projectId: project.id,
        projectName: project.name,
        targetType: "issue",
        targetId: issue.id,
        submittedBy: user.name,
        severity: issue.severity,
      });
      toast.success("Issue escalated to CEO");
    },
    [push, user.name],
  );

  if (activeProject) {
    return (
      <ProjectDetail
        project={activeProject}
        user={user}
        activeTab={nav.activeTab}
        highlightItemId={nav.highlightItemId}
        onClearHighlight={nav.clearHighlight}
        onNavigateToDashboard={nav.backToDashboard}
        onReportSubmittedToCeo={handleReportSubmittedToCeo}
        onIssueEscalated={handleIssueEscalated}
      />
    );
  }

  return (
    <CEOExecutiveDashboard
      portfolios={portfolios}
      portfolioMetrics={portfolios}
      user={user}
      onOpenProject={nav.openProject}
    />
  );
}
