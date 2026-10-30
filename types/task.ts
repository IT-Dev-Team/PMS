// types/task.ts
import { BaseEntity, User, Document } from './common';
import { Project } from './project';
import { Risk } from './risk';
import { Decision } from './governance';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  INCOMPLETE = 'INCOMPLETE'
}

export enum TaskPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface Task extends BaseEntity {
  projectId: string;
  project?: Project;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assignee?: User;
  startDate: Date;
  endDate: Date;
  percentComplete: number;
  completedAt: Date | null;
  incompleteReason: string | null;
  riskId: string | null;
  risk?: Risk;
  decisionId: string | null;
  decision?: Decision;
  documents?: Document[];
  // Computed fields
  assigneeName?: string;
  projectName?: string;
  isOverdue?: boolean;
}

export interface TaskCreateInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  startDate: Date;
  endDate: Date;
  riskId?: string;
  decisionId?: string;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  startDate?: Date;
  endDate?: Date;
  percentComplete?: number;
}

export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  blocked: number;
  completed: number;
  incomplete: number;
  avgComplete: number;
  overdue: number;
}

export interface TaskBoardColumn {
  id: TaskStatus;
  title: string;
  icon: any;
  color: string;
}

export interface TaskBoardData {
  columns: TaskBoardColumn[];
  tasks: Task[];
}