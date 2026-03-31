'use client';

import React, { useState, useEffect } from 'react';
import { ChatProvider } from '@/lib/chat-context';
import { LoginPage } from '@/components/login-page';
import { Sidebar } from '@/components/sidebar';
import { ChatInterface } from '@/components/chat-interface';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user is already logged in (from localStorage)
    const savedAuth = localStorage.getItem('eih_auth');
    if (savedAuth) {
      const auth = JSON.parse(savedAuth);
      setUser(auth);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (email: string) => {
    const userData = { email };
    localStorage.setItem('eih_auth', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('eih_auth');
    setUser(null);
    setIsAuthenticated(false);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block">
            <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent"></div>
          </div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ChatProvider>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="border-b border-border bg-card/50 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <p className="font-medium text-foreground">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              Sign Out
            </button>
          </div>

          {/* Chat Interface */}
          <ChatInterface />
        </div>
      </div>
    </ChatProvider>
  );
}
