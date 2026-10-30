// types/planning.ts
import { BaseEntity } from './common';
import { Project } from './project';

export enum Quarter {
  Q1 = 'Q1',
  Q2 = 'Q2',
  Q3 = 'Q3',
  Q4 = 'Q4'
}

export enum Month {
  JANUARY = 'JANUARY',
  FEBRUARY = 'FEBRUARY',
  MARCH = 'MARCH',
  APRIL = 'APRIL',
  MAY = 'MAY',
  JUNE = 'JUNE',
  JULY = 'JULY',
  AUGUST = 'AUGUST',
  SEPTEMBER = 'SEPTEMBER',
  OCTOBER = 'OCTOBER',
  NOVEMBER = 'NOVEMBER',
  DECEMBER = 'DECEMBER'
}

export enum WeekStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELAYED = 'DELAYED',
  BLOCKED = 'BLOCKED'
}

export interface QuarterlyPlan extends BaseEntity {
  projectId: string;
  project?: Project;
  year: number;
  quarter: Quarter;
  objectives: string[];
  keyResults: string[];
  status: WeekStatus;
  startDate: Date;
  endDate: Date;
  progress: number;
  quarterlyGoals: QuarterlyGoal[];
}

export interface QuarterlyGoal extends BaseEntity {
  quarterlyPlanId: string;
  quarterlyPlan?: QuarterlyPlan;
  title: string;
  description: string;
  targetDate: Date;
  status: WeekStatus;
  progress: number;
  monthlyPlans?: MonthlyPlan[];
}

export interface MonthlyPlan extends BaseEntity {
  projectId: string;
  project?: Project;
  quarterlyPlanId: string;
  quarterlyPlan?: QuarterlyPlan;
  month: Month;
  year: number;
  goals: string[];
  milestones: string[];
  status: WeekStatus;
  startDate: Date;
  endDate: Date;
  progress: number;
  weeklyPlans?: WeeklyPlan[];
}

export interface WeeklyPlan extends BaseEntity {
  projectId: string;
  project?: Project;
  monthlyPlanId: string;
  monthlyPlan?: MonthlyPlan;
  weekNumber: number;
  year: number;
  tasks: string[];
  deliverables: string[];
  status: WeekStatus;
  startDate: Date;
  endDate: Date;
  progress: number;
  dailyTasks?: DailyTask[];
}

export interface DailyTask extends BaseEntity {
  weeklyPlanId: string;
  weeklyPlan?: WeeklyPlan;
  title: string;
  description: string;
  assigneeId: string;
  assignee?: any;
  status: string;
  priority: number;
  estimatedHours: number;
  actualHours: number;
  date: Date;
  completedAt: Date | null;
}

export interface PlanningAlignment {
  projectStartDate: Date;
  projectEndDate: Date;
  totalWeeks: number;
  currentWeek: number;
  progress: number;
  quarters: {
    quarter: Quarter;
    startDate: Date;
    endDate: Date;
    weeks: number;
    progress: number;
  }[];
}