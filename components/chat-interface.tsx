'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@/lib/chat-context';
import { MessageComponent } from '@/components/message';
import { FileUpload } from '@/components/file-upload';
import { VoiceInput } from '@/components/voice-input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader } from 'lucide-react';
import { Message, Attachment } from '@/lib/types';
import { chatWithDeepSeek, generateTitle } from '@/lib/deepseek';
import { FileInfo } from '@/lib/files';

export function ChatInterface() {
  const { currentChat, addMessage, updateChatTitle, addAttachment } = useChat();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<FileInfo[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChat?.messages]);

  if (!currentChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🤖</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome to EIH AI Assistant
          </h2>
          <p className="text-muted-foreground mb-6">
            Start a new chat to begin your conversation. Use voice input,
            upload documents, or type your questions directly.
          </p>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Features:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Real-time chat with AI</li>
              <li>✓ Document upload & analysis</li>
              <li>✓ Voice input & text-to-speech</li>
              <li>✓ Chat history management</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    // Capture input before clearing
    const userInput = input;
    const files = [...attachedFiles];

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date(),
      attachments: files.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size,
        uploadedAt: f.uploadedAt,
      })),
    };

    // Add user message
    addMessage(userMessage);

    // Add attached files as chat attachments
    files.forEach((file) => {
      addAttachment({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: file.uploadedAt,
      });
    });

    // Clear input immediately
    setInput('');
    setAttachedFiles([]);
    setLoading(true);

    try {
      // Update chat title if it's the first message
      if (currentChat.messages.length === 0) {
        const title = await generateTitle(userInput);
        updateChatTitle(currentChat.id, title);
      }

      // Build context from chat history
      const messages = currentChat.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      // Add current message
      messages.push({
        role: 'user' as const,
        content: userInput,
      });

      // Stream response
      let fullResponse = '';
      await chatWithDeepSeek(messages, (chunk) => {
        fullResponse += chunk;
      });

      // Add assistant message
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date(),
      };

      addMessage(assistantMessage);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {currentChat.title}
        </h2>
        <p className="text-xs text-muted-foreground">
          {currentChat.messages.length} messages
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {currentChat.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground text-center">
              No messages yet. Start by typing a question or uploading a document.
            </p>
          </div>
        ) : (
          <>
            {currentChat.messages.map((message) => (
              <MessageComponent key={message.id} message={message} />
            ))}
            {loading && (
              <div className="flex gap-4 p-4">
                <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center flex-shrink-0">
                  <Loader className="w-4 h-4 animate-spin text-sidebar-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    EIH Assistant
                  </p>
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-card/50">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* File Upload */}
          <FileUpload
            onFilesSelected={setAttachedFiles}
            disabled={loading}
          />

          {/* Attached Files Preview */}
          {attachedFiles.length > 0 && (
            <div className="p-3 rounded bg-background border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''} ready to send
              </p>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything... (Shift+Enter for new line)"
                className="resize-none text-sm"
                rows={3}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || loading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Voice Input */}
          <VoiceInput
            onTranscript={(text) => {
              setInput((prev) => (prev ? prev + ' ' + text : text));
            }}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
}
