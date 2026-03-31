export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  documents?: Attachment[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export const PREDEFINED_USE_CASES = [
  {
    id: '1',
    title: 'Investment Analysis',
    description: 'Analyze investment opportunities and market trends',
    icon: '📊',
  },
  {
    id: '2',
    title: 'Document Review',
    description: 'Review and summarize documents',
    icon: '📄',
  },
  {
    id: '3',
    title: 'Business Strategy',
    description: 'Develop business strategies and action plans',
    icon: '🎯',
  },
  {
    id: '4',
    title: 'Data Analysis',
    description: 'Analyze and interpret complex data',
    icon: '📈',
  },
  {
    id: '5',
    title: 'Writing & Content',
    description: 'Create and refine written content',
    icon: '✍️',
  },
  {
    id: '6',
    title: 'Q&A Support',
    description: 'Get answers to your questions',
    icon: '❓',
  },
];
