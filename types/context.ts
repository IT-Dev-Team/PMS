// types/context.ts
import { Session } from 'next-auth';
import { User } from './common';

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (pageId: string, action?: 'read' | 'write' | 'delete') => boolean;
}

export interface PermissionsContextType {
  permissions: Record<string, 'FULL' | 'EDIT_OWN' | 'VIEW' | 'NONE'>;
  checkPermission: (pageId: string, action?: 'read' | 'write' | 'delete') => boolean;
  checkProjectOwnership: (projectId: string) => Promise<boolean>;
}

export interface NotificationContextType {
  notifications: any[];
  unreadCount: number;
  addNotification: (notification: any) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}