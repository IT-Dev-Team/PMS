// types/financial.ts
import { BaseEntity } from './common';
import { Project } from './project';
import { User } from './common';
import { Vendor } from './procurement';

// ========== COST BREAKDOWN STRUCTURE ==========
export interface CostBreakdownStructure extends BaseEntity {
  projectId: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  level: number;
  type: 'WORK_PACKAGE' | 'CONTROL_ACCOUNT' | 'COST_ACCOUNT';
  sortOrder: number;
  children?: CostBreakdownStructure[];
}

// ========== BUDGET LINE ITEMS ==========
export interface BudgetLineItem extends BaseEntity {
  projectId: string;
  cbsId: string | null;
  category: string;
  subCategory: string | null;
  plannedAmount: number;
  actualAmount: number;
  committedAmount: number;
  remainingAmount: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'OVER_BUDGET';
  currency: string;
  exchangeRate: number;
  baselineVersion: number;
}

// ========== ACTUAL COSTS ==========
export interface ActualCost extends BaseEntity {
  projectId: string;
  budgetLineItemId?: string | null;
  planId?: string | null;
  planName?: string | null;
  projectName?: string | null;
  period: Date | string;
  amount: number;
  costType: 'LABOR' | 'MATERIAL' | 'EQUIPMENT' | 'SUBCONTRACT' | 'OVERHEAD' | 'OTHER' | string;
  description: string | null;
  referenceNumber?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  poNumber?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  currency: string;
  exchangeRate?: number;
  vendor?: Vendor;
  approver?: User;
}

// ========== COMMITMENTS ==========
export interface Commitment extends BaseEntity {
  projectId: string;
  budgetLineItemId: string | null;
  vendorId: string | null;
  poNumber: string;
  description: string | null;
  amount: number;
  committedDate: Date;
  expectedDelivery: Date | null;
  status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'OVERDUE';
  currency: string;
  exchangeRate: number;
  vendor?: Vendor;
}

// ========== FORECASTS ==========
export interface Forecast extends BaseEntity {
  projectId: string;
  period: Date;
  etc: number;
  eac: number;
  vac: number;
  confidenceLevel: number;
  scenario: 'MOST_LIKELY' | 'OPTIMISTIC' | 'PESSIMISTIC';
  assumptions: string | null;
  createdBy: string | null;
  creator?: User;
}

// ========== EVM SNAPSHOTS ==========
export interface EVMSnapshot extends BaseEntity {
  projectId: string;
  period: Date;
  pv: number; // Planned Value
  ev: number; // Earned Value
  ac: number; // Actual Cost
  cpi: number | null; // Cost Performance Index
  spi: number | null; // Schedule Performance Index
  csi: number | null; // Cost Schedule Index
  eac: number | null; // Estimate at Completion
  etc: number | null; // Estimate to Complete
  vac: number | null; // Variance at Completion
  tcr: number | null; // To Complete Performance Index
  earnedSchedule: number | null;
}

// ========== BUDGET CHANGES ==========
export interface BudgetChange extends BaseEntity {
  projectId: string;
  budgetLineItemId: string | null;
  changeType: 'INCREASE' | 'DECREASE' | 'REALLOCATE';
  amount: number;
  previousAmount: number;
  newAmount: number;
  reason: string;
  justification: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  decisionId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdBy: string;
}

// ========== FINANCIAL METRICS ==========
export interface FinancialMetrics {
  budget: {
    total: number;
    utilized: number;
    remaining: number;
    utilizationPercent: number;
  };
  evm: {
    pv: number;
    ev: number;
    ac: number;
    cpi: number;
    spi: number;
    eac: number;
    etc: number;
    vac: number;
  };
  forecast: {
    eac: number;
    etc: number;
    vac: number;
    confidence: number;
  };
  trends: {
    cpi: number[];
    spi: number[];
    ev: number[];
    ac: number[];
    periods: Date[];
  };
  health: {
    cost: 'GREEN' | 'AMBER' | 'RED';
    schedule: 'GREEN' | 'AMBER' | 'RED';
    overall: 'GREEN' | 'AMBER' | 'RED';
  };
}

// ========== EVM DATA & FINANCIAL ENTRY ==========
export interface EVMData {
  pv?: number;
  ev?: number;
  ac?: number;
  cpi?: number;
  spi?: number;
  csi?: number;
  eac?: number;
  etc?: number;
  vac?: number;
  tcr?: number;
  bac?: number;
  plannedValue?: number;
  earnedValue?: number;
  actualCost?: number;
  period?: Date | string;
  [key: string]: any;
}

export interface FinancialEntry extends BaseEntity {
  projectId: string;
  category?: string;
  plannedAmount?: number;
  actualAmount?: number;
  amount?: number;
  period?: Date | string;
  description?: string | null;
  [key: string]: any;
}