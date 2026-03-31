'use client';

import React from 'react';
import { useChat } from '@/lib/chat-context';
import { PREDEFINED_USE_CASES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Scroll } from 'lucide-react';
import { Trash2, Plus, MessageSquare } from 'lucide-react';

export function Sidebar() {
  const { chats, currentChat, createChat, selectChat, deleteChat } = useChat();

  const handleNewChat = () => {
    createChat('New Chat');
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-accent-foreground font-bold text-xs">EIH</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground leading-tight">
              EIH AI
            </h1>
            <p className="text-xs text-muted-foreground">DeepSeek Powered</p>
          </div>
        </div>
        <Button
          onClick={handleNewChat}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">
          Chat History
        </p>
        {chats.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No chats yet. Start a new conversation!
          </p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`group p-3 rounded-lg cursor-pointer transition-all ${
                currentChat?.id === chat.id
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'hover:bg-sidebar-accent/10 text-sidebar-foreground'
              }`}
              onClick={() => selectChat(chat.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{chat.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(chat.createdAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4 text-destructive hover:text-destructive/80" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Use Cases */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">
          Quick Start
        </p>
        <div className="space-y-2">
          {PREDEFINED_USE_CASES.slice(0, 3).map((useCase) => (
            <button
              key={useCase.id}
              onClick={() => createChat(useCase.title)}
              className="w-full text-left p-2 rounded text-xs hover:bg-sidebar-accent/10 transition-colors text-muted-foreground hover:text-sidebar-foreground group"
            >
              <span className="mr-2">{useCase.icon}</span>
              <span className="group-hover:text-sidebar-primary-foreground">
                {useCase.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
