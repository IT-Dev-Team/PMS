// types/dashboard.ts
import { Project } from './project';
import { Task } from './task';
import { Risk } from './risk';
import { Decision } from './governance';
import { EVMData } from './financial';

export interface KPIItem {
  label: string;
  value: string | number;
  change?: number;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
  color?: string;
}

export interface WidgetItem {
  title: string;
  content: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  error?: Error | null;
}

export interface DashboardData {
  kpis: KPIItem[];
  widgets: WidgetItem[];
  refreshInterval?: number;
  onRefresh?: () => void;
}

export interface PMWorkspaceData {
  projects: Project[];
  tasks: Task[];
  risks: Risk[];
  decisions: Decision[];
  evmData: Record<string, EVMData>;
}

export interface CEOExecutiveData {
  portfolioKPIs: {
    totalValue: number;
    activeProjects: number;
    onTrackProjects: number;
    atRiskProjects: number;
    criticalProjects: number;
    openRisks: number;
    pendingApprovals: number;
  };
  pendingApprovals: Decision[];
  riskBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    totalExposure: number;
  };
  topProjects: Array<{
    id: string;
    name: string;
    budget: number;
    percentComplete: number;
    managerName: string;
  }>;
}

export interface FinancialDashboardData {
  kpis: {
    totalBudget: number;
    totalActualCost: number;
    totalVariance: number;
    averageCPI: number;
    averageSPI: number;
  };
  trends: {
    dates: Date[];
    plannedValues: number[];
    earnedValues: number[];
    actualCosts: number[];
  };
  projects: Array<{
    id: string;
    name: string;
    budget: number;
    actualCost: number;
    cpi: number;
    spi: number;
    eac: number;
    vac: number;
    ragStatus: 'GREEN' | 'AMBER' | 'RED';
  }>;
}

export interface ProcurementDashboardData {
  kpis: {
    totalPackages: number;
    totalContractValue: number;
    activeVendors: number;
    packagesOnTrack: number;
    packagesAtRisk: number;
  };
  packages: any[];
  vendors: any[];
  topVendors: any[];
}