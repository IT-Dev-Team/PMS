'use client';

import React from 'react';
import { Message } from '@/lib/types';
import { User, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface MessageProps {
  message: Message;
}

export function MessageComponent({ message }: MessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-4 p-4 rounded-lg animate-fade-in ${
        isUser
          ? 'bg-card border border-border ml-8'
          : 'bg-transparent border-0'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-accent/20 text-accent'
            : 'bg-sidebar-primary text-sidebar-primary-foreground'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <span className="text-xs font-bold">AI</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground mb-2">
          {isUser ? 'You' : 'EIH Assistant'}
        </p>
        <div className="prose prose-invert max-w-none text-sm text-foreground leading-relaxed">
          {message.content.split('\n').map((line, idx) => (
            <div key={idx}>{line || '\u00a0'}</div>
          ))}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 p-2 bg-background rounded text-xs text-muted-foreground"
              >
                <span>📎</span>
                <span className="truncate">{att.name}</span>
                <span className="ml-auto text-muted-foreground/50">
                  ({(att.size / 1024).toFixed(1)}KB)
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <button
          onClick={handleCopy}
          className="mt-2 flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
