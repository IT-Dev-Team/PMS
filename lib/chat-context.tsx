'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Chat, Message, Attachment } from './types';

interface ChatContextType {
  chats: Chat[];
  currentChat: Chat | null;
  createChat: (title?: string) => string;
  selectChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  addMessage: (message: Message, chatId?: string) => void;
  addAttachment: (attachment: Attachment, chatId?: string) => void;
  updateChatTitle: (chatId: string, title: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const currentChat = chats.find((chat) => chat.id === currentChatId) || null;

  const createChat = useCallback(
    (title: string = 'New Chat'): string => {
      const newChat: Chat = {
        id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        messages: [],
        documents: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setChats((prev) => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      return newChat.id;
    },
    []
  );

  const selectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
  }, []);

  const deleteChat = useCallback((chatId: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
    }
  }, [currentChatId]);

  const addMessage = useCallback(
    (message: Message, chatId?: string) => {
      const targetChatId = chatId || currentChatId;
      if (!targetChatId) return;

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id === targetChatId) {
            return {
              ...chat,
              messages: [...chat.messages, message],
              updatedAt: new Date(),
            };
          }
          return chat;
        })
      );
    },
    [currentChatId]
  );

  const addAttachment = useCallback(
    (attachment: Attachment, chatId?: string) => {
      const targetChatId = chatId || currentChatId;
      if (!targetChatId) return;

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id === targetChatId) {
            return {
              ...chat,
              documents: [...(chat.documents || []), attachment],
              updatedAt: new Date(),
            };
          }
          return chat;
        })
      );
    },
    [currentChatId]
  );

  const updateChatTitle = useCallback((chatId: string, title: string) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === chatId) {
          return {
            ...chat,
            title,
            updatedAt: new Date(),
          };
        }
        return chat;
      })
    );
  }, []);

  const value: ChatContextType = {
    chats,
    currentChat,
    createChat,
    selectChat,
    deleteChat,
    addMessage,
    addAttachment,
    updateChatTitle,
  };

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}
