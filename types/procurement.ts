// types/procurement.ts
import { BaseEntity } from './common';
import { Project } from './project';

export enum ProcurementStatus {
  DRAFT = 'DRAFT',
  RELEASED = 'RELEASED',
  AWARDED = 'AWARDED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE'
}

export interface ProcurementPackage extends BaseEntity {
  projectId: string;
  project?: Project;
  vendorId: string | null;
  vendor?: Vendor;
  title: string;
  name?: string;
  code?: string;
  description: string | null;
  contractValue: number;
  totalContractValue?: number;
  terms: string | null;
  status: ProcurementStatus;
  paymentSchedule?: any;
  milestones?: ContractMilestone[];
  documents?: Document[];
  issueDate?: string | Date;
  startDate?: string | Date;
  endDate?: string | Date;
  currency?: string;
  // Computed
  projectName?: string;
  vendorName?: string;
  totalMilestones?: number;
  completedMilestones?: number;
}

export interface ContractMilestone extends BaseEntity {
  packageId: string;
  package?: ProcurementPackage;
  title: string;
  dueDate: Date;
  percentage: number;
  status: MilestoneStatus;
  deliveredAt: Date | null;
}

export interface ProcurementPackageCreateInput {
  projectId: string;
  vendorId?: string;
  title: string;
  description?: string;
  contractValue: number;
  terms?: string;
  paymentSchedule?: any;
}

export interface ProcurementPackageUpdateInput {
  vendorId?: string;
  title?: string;
  description?: string;
  contractValue?: number;
  terms?: string;
  status?: ProcurementStatus;
  paymentSchedule?: any;
}

export interface MilestoneCreateInput {
  packageId: string;
  title: string;
  dueDate: Date;
  percentage: number;
}

export interface Vendor extends BaseEntity {
  name: string;
  code: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  rating: number | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';
}