// types/settings.ts
import { BaseEntity, EntityType } from './common';

export interface ReasonCode extends BaseEntity {
  code: string;
  category: ReasonCategory;
  description: string;
  isActive: boolean;
}

export enum ReasonCategory {
  TASK_INCOMPLETE = 'TASK_INCOMPLETE',
  BASELINE_CHANGE = 'BASELINE_CHANGE',
  CONTINGENCY_DRAW = 'CONTINGENCY_DRAW',
  RISK_MITIGATION = 'RISK_MITIGATION',
  PROCUREMENT_CHANGE = 'PROCUREMENT_CHANGE',
  SCHEDULE_SLIP = 'SCHEDULE_SLIP',
  BUDGET_VARIANCE = 'BUDGET_VARIANCE',
  RESOURCE_REALLOCATION = 'RESOURCE_REALLOCATION',
  GOVERNANCE_ESCALATION = 'GOVERNANCE_ESCALATION'
}

export interface CustomField extends BaseEntity {
  name: string;
  type: FieldType;
  entityType: EntityType;
  isRequired: boolean;
  options: any;
  defaultValue: string | null;
  isActive: boolean;
}

export enum FieldType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  SELECT = 'SELECT',
  MULTI_SELECT = 'MULTI_SELECT',
  CHECKBOX = 'CHECKBOX',
  RADIO = 'RADIO',
  TEXTAREA = 'TEXTAREA',
  URL = 'URL',
  EMAIL = 'EMAIL'
}

export interface AdminSettings {
  id: number;
  apiKeyHash: string | null;
  manusProjectId: string | null;
  updatedAt: Date;
}

export interface SystemConfig {
  maxUploadSize: number; // in bytes
  allowedFileTypes: string[];
  sessionTimeout: number; // in minutes
  enableAuditLog: boolean;
  reportRetentionDays: number;
}