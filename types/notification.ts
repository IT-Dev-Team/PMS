// types/notification.ts
import { BaseEntity } from './common';

export enum NotificationType {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  readAt: Date | null;
  metadata: any;
}

export interface NotificationCreateInput {
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  metadata?: any;
}

export interface NotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  pushNotifications: boolean;
  types: {
    projectUpdates: boolean;
    taskAssignments: boolean;
    riskAlerts: boolean;
    decisionRequests: boolean;
    procurementUpdates: boolean;
    reportNotifications: boolean;
  };
}