// types/reporting.ts
import { BaseEntity, User } from './common';

export enum ReportType {
  EXECUTIVE_SUMMARY = 'EXECUTIVE_SUMMARY',
  PROJECT_HEALTH = 'PROJECT_HEALTH',
  FINANCIAL_DASHBOARD = 'FINANCIAL_DASHBOARD',
  RISK_ASSESSMENT = 'RISK_ASSESSMENT',
  RESOURCE_UTILIZATION = 'RESOURCE_UTILIZATION',
  VENDOR_PERFORMANCE = 'VENDOR_PERFORMANCE'
}

export enum ReportFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BI_WEEKLY = 'BI_WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY'
}

export enum ReportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  HTML = 'HTML'
}

export interface ScheduledReport extends BaseEntity {
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  recipients: string[]; // Email addresses
  parameters: any;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  isActive: boolean;
  createdById: string;
  createdBy?: User;
}

export interface ScheduledReportCreateInput {
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  recipients: string[];
  parameters?: any;
}

export interface ReportFilter {
  projectId?: string;
  departmentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string[];
}

export interface ReportData {
  title: string;
  generatedAt: Date;
  filters: ReportFilter;
  data: any;
  charts?: any[];
}

export interface ReportGenerationRequest {
  type: ReportType;
  format: ReportFormat;
  filters: ReportFilter;
  schedule?: {
    frequency: ReportFrequency;
    recipients: string[];
  };
}