// types/project.ts
import { BaseEntity, User, Department } from './common';
import { Task } from './task';
import { Risk } from './risk';
import { Decision } from './governance';
import { ProcurementPackage } from './procurement';
import { EVMData, FinancialEntry } from './financial';

export enum ProjectStatus {
  INITIATING = 'INITIATING',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  MONITORING = 'MONITORING',
  CLOSING = 'CLOSING'
}

export enum ProjectPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface Project extends BaseEntity {
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  departmentId: string | null;
  department?: Department;
  managerId: string;
  manager?: User;
  startDate: Date;
  endDate: Date;
  budget: number;
  actualCost: number;
  percentComplete: number;
  baselineId: string | null;
  baseline?: Baseline;
  tasks?: Task[];
  risks?: Risk[];
  decisions?: Decision[];
  documents?: Document[];
  financialEntries?: FinancialEntry[];
  evmData?: EVMData;
  procurementPackages?: ProcurementPackage[];
  // Computed fields
  managerName?: string;
  departmentName?: string;
  ragStatus?: 'GREEN' | 'AMBER' | 'RED';
}

export interface ProjectCreateInput {
  code: string;
  name: string;
  description?: string;
  departmentId?: string;
  managerId: string;
  startDate: Date;
  endDate: Date;
  budget: number;
  status?: ProjectStatus;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  departmentId?: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  actualCost?: number;
  percentComplete?: number;
}

export interface Baseline extends BaseEntity {
  projectId: string;
  project?: Project;
  version: number;
  budget: number;
  schedule: any; // WBS structure
  approvedById: string | null;
  approvedBy?: User;
  approvalDate: Date | null;
  reason: string | null;
}

export interface BaselineCreateInput {
  projectId: string;
  version: number;
  budget: number;
  schedule: any;
  reason?: string;
}

export interface ProjectMetrics {
  taskCompletion: number;
  overdueTasks: number;
  scheduleVariance: number;
  costVariance: number;
  riskCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ProjectHealth {
  overall: 'GREEN' | 'AMBER' | 'RED';
  schedule: 'GREEN' | 'AMBER' | 'RED';
  cost: 'GREEN' | 'AMBER' | 'RED';
  scope: 'GREEN' | 'AMBER' | 'RED';
  risk: 'GREEN' | 'AMBER' | 'RED';
  quality: 'GREEN' | 'AMBER' | 'RED';
}

export interface ProjectDashboardData {
  project: Project;
  evmData: EVMData | null;
  risks: Risk[];
  tasks: Task[];
  decisions: Decision[];
  metrics: ProjectMetrics;
  health: ProjectHealth;
}

export interface ProjectFilters {
  status?: ProjectStatus;
  departmentId?: string;
  managerId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}