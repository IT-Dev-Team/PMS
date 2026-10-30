// types/governance.ts
import { BaseEntity, User } from './common';
import { Project } from './project';

export enum DecisionPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum DecisionStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ESCALATED_TO_BOARD = 'ESCALATED_TO_BOARD',
  BOARD_VOTING = 'BOARD_VOTING',
  BOARD_RESOLVED = 'BOARD_RESOLVED'
}

export enum VoteType {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  ABSTAIN = 'ABSTAIN'
}

export interface Decision extends BaseEntity {
  projectId: string;
  project?: Project;
  title: string;
  description: string | null;
  amount: number | null;
  priority: DecisionPriority;
  justification: string | null;
  requesterId: string;
  requester?: User;
  status: DecisionStatus;
  ceoComments: string | null;
  boardResolution: string | null;
  tasks?: any[];
  votes?: Vote[];
  documents?: any[];
  // Computed fields
  requesterName?: string;
  projectName?: string;
  voteCount?: number;
}

export interface DecisionCreateInput {
  projectId: string;
  title: string;
  description?: string;
  amount?: number;
  priority: DecisionPriority;
  justification?: string;
  requesterId: string;
}

export interface Vote extends BaseEntity {
  decisionId: string;
  decision?: Decision;
  boardMemberId: string;
  boardMember?: User;
  vote: VoteType;
  comments: string | null;
}

export interface VoteInput {
  decisionId: string;
  boardMemberId: string;
  vote: VoteType;
  comments?: string;
}

export interface VoteResults {
  totalVotes: number;
  approves: number;
  rejects: number;
  abstains: number;
  quorumMet: boolean;
  passed: boolean | null;
}

export interface BoardStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalValue: number;
}

export interface DecisionFilters {
  status?: DecisionStatus;
  priority?: DecisionPriority;
  projectId?: string;
  requesterId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface RecentDecision {
  id: string;
  title: string;
  status: DecisionStatus | string;
  created_at: Date | string;
  projectName: string | null;
  requesterName: string | null;
}