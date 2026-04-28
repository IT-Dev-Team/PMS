// components/chat/chat-messages.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Loader2, Bot, User, CheckCircle2, Clock, AlertCircle, Globe, Code, FileText, Wrench } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  statusType?: 'processing' | 'completed' | 'failed' | 'waiting';
  agentStatus?: string;
  statusDescription?: string;
  toolName?: string;
  toolDescription?: string;
  explanationContent?: string;
  created_at: string;
  updated_at?: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isProcessing?: boolean;
}

export function ChatMessages({ messages, isProcessing }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getStatusIcon = (statusType?: string, agentStatus?: string) => {
    if (statusType === 'completed') return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    if (statusType === 'failed') return <AlertCircle className="w-3 h-3 text-red-500" />;
    if (agentStatus === 'waiting') return <Clock className="w-3 h-3 text-yellow-500" />;
    return <Loader2 className="w-3 h-3 animate-spin text-primary" />;
  };

  const getToolIcon = (toolName?: string) => {
    switch (toolName) {
      case 'browser': return <Globe className="w-3 h-3" />;
      case 'code_executor': return <Code className="w-3 h-3" />;
      case 'file_reader': return <FileText className="w-3 h-3" />;
      default: return <Wrench className="w-3 h-3" />;
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            message.role === 'user' ? 'bg-primary/10 order-2' : 'bg-secondary'
          }`}>
            {message.role === 'user' ? <User className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4" />}
          </div>

          <div className={`flex flex-col max-w-[70%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`px-4 py-2 rounded-2xl ${
              message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            </div>

            {message.role === 'assistant' && (message.statusType || message.agentStatus) && (
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {getStatusIcon(message.statusType, message.agentStatus)}
                
                {message.statusDescription && (
                  <span>{message.statusDescription}</span>
                )}
                
                {message.toolName && message.toolDescription && (
                  <div className="flex items-center gap-1">
                    {getToolIcon(message.toolName)}
                    <span>{message.toolDescription}</span>
                  </div>
                )}
                
                {message.statusType === 'completed' && (
                  <span className="text-green-600">✓ Complete</span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {isProcessing && messages[messages.length - 1]?.statusType === 'processing' && (
        <div className="flex justify-start gap-3 animate-in fade-in duration-300">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div className="bg-muted px-4 py-2 rounded-2xl">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {messages[messages.length - 1]?.statusDescription || 'Processing...'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}