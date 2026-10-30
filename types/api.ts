// types/api.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ApiRequest<T = any> {
  data: T;
  params?: Record<string, string>;
  query?: Record<string, any>;
}

// API Route Handlers
export interface ApiHandler<T = any, R = any> {
  (request: ApiRequest<T>): Promise<ApiResponse<R>>;
}

// Webhook Payloads
export interface WebhookPayload {
  event: string;
  timestamp: Date;
  data: any;
  source: string;
}

export interface ProjectWebhookPayload extends WebhookPayload {
  data: {
    projectId: string;
    projectCode: string;
    status: string;
    changes: any;
  };
}

export interface TaskWebhookPayload extends WebhookPayload {
  data: {
    taskId: string;
    projectId: string;
    status: string;
    assigneeId?: string;
  };
}

export interface DecisionWebhookPayload extends WebhookPayload {
  data: {
    decisionId: string;
    projectId: string;
    status: string;
    priority: string;
  };
}