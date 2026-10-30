// types/risk.ts
import { BaseEntity, User, Document } from './common';
import { Project } from './project';
import { Task } from './task';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum RiskStatus {
  IDENTIFIED = 'IDENTIFIED',
  ASSESSED = 'ASSESSED',
  MITIGATING = 'MITIGATING',
  ACCEPTED = 'ACCEPTED',
  AVOIDED = 'AVOIDED',
  TRANSFERRED = 'TRANSFERRED',
  CLOSED = 'CLOSED'
}

export enum RiskCategory {
  TECHNICAL = 'TECHNICAL',
  FINANCIAL = 'FINANCIAL',
  SCHEDULE = 'SCHEDULE',
  RESOURCE = 'RESOURCE',
  GOVERNANCE = 'GOVERNANCE',
  EXTERNAL = 'EXTERNAL',
  HSE = 'HSE',
  REPUTATION = 'REPUTATION'
}

export interface Risk extends BaseEntity {
  projectId: string;
  project?: Project;
  title: string;
  description: string | null;
  probability: number; // 1-5
  impact: number; // 1-5
  riskScore: number; // probability * impact
  riskLevel: RiskLevel;
  mitigationPlan: string | null;
  contingencyPlan: string | null;
  status: RiskStatus;
  category: RiskCategory;
  ownerId: string | null;
  owner?: User;
  tasks?: Task[];
  documents?: Document[];
}

export interface RiskCreateInput {
  projectId: string;
  title: string;
  description?: string;
  probability: number;
  impact: number;
  category: RiskCategory;
  mitigationPlan?: string;
  contingencyPlan?: string;
  ownerId?: string;
  status?: RiskStatus;
}

export interface RiskUpdateInput {
  title?: string;
  description?: string;
  probability?: number;
  impact?: number;
  category?: RiskCategory;
  mitigationPlan?: string;
  contingencyPlan?: string;
  ownerId?: string;
  status?: RiskStatus;
}

export interface RiskHeatMapCell {
  probability: number;
  impact: number;
  count: number;
  riskTitles: string[];
  riskLevel: RiskLevel;
}

export interface RiskHeatMapData {
  cells: RiskHeatMapCell[];
  maxCount: number;
}

export interface PortfolioRiskExposure {
  totalRisks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgRiskScore: number;
  totalExposure: number;
}

export interface RiskMatrixCoordinates {
  probability: number;
  impact: number;
}

export interface RiskFilter {
  projectId?: string;
  status?: RiskStatus;
  category?: RiskCategory;
  riskLevel?: RiskLevel;
  ownerId?: string;
}