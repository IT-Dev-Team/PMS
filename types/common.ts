// types/common.ts
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
  department?: Department;
}

export enum UserRole {
  CEO = 'CEO',
  PORTFOLIO_MANAGER = 'PORTFOLIO_MANAGER',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  FINANCE = 'FINANCE',
  PROCUREMENT = 'PROCUREMENT',
  BOARD_MEMBER = 'BOARD_MEMBER',
  TEAM_MEMBER = 'TEAM_MEMBER'
}

export interface Department extends BaseEntity {
  code: string;
  name: string;
  parentId: string | null;
  parent?: Department;
  children?: Department[];
}

export interface AuditLog extends BaseEntity {
  userId: string | null;
  user?: User;
  action: string;
  entityType: string;
  entityId: string;
  changes: any;
  reason: string | null;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface Document extends BaseEntity {
  projectId: string | null;
  taskId: string | null;
  riskId: string | null;
  decisionId: string | null;
  procurementId: string | null;
  name: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  version: number;
  uploadedById: string;
  uploadedBy?: User;
}

export enum EntityType {
  PROJECT = 'PROJECT',
  TASK = 'TASK',
  RISK = 'RISK',
  DECISION = 'DECISION',
  PROCUREMENT_PACKAGE = 'PROCUREMENT_PACKAGE',
  VENDOR = 'VENDOR'
}