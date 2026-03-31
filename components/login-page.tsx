'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail } from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError('');

    // Simulate Microsoft OAuth flow
    // In production, use NextAuth.js with Microsoft provider
    try {
      // Validate email
      if (!email.includes('@')) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      // Simulate auth delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Proceed with login
      onLogin(email);
    } catch (err) {
      setError('Authentication failed. Please try again.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleMicrosoftLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-sidebar-primary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <span className="text-3xl font-bold text-accent">EIH</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">EIH AI</h1>
          <p className="text-muted-foreground">
            Ethiopian Investment Holding AI Assistant
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-lg">
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Welcome Back
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in with your Microsoft account to continue
          </p>

          {/* Email Input */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="you@example.com"
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Login Button */}
          <Button
            onClick={handleMicrosoftLogin}
            disabled={!email || loading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Signing in...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
                </svg>
                Sign in with Microsoft
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="my-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card text-muted-foreground">or</span>
            </div>
          </div>

          {/* Demo Button */}
          <Button
            onClick={() => onLogin('demo@example.com')}
            disabled={loading}
            variant="outline"
            className="w-full border-accent/30 text-foreground hover:bg-accent/5"
          >
            Continue as Demo User
          </Button>

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center mt-6">
            By signing in, you agree to our{' '}
            <span className="text-accent hover:underline cursor-pointer">
              Terms of Service
            </span>{' '}
            and{' '}
            <span className="text-accent hover:underline cursor-pointer">
              Privacy Policy
            </span>
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="text-xl mb-1">💬</p>
            <p className="text-muted-foreground">Smart Chat</p>
          </div>
          <div>
            <p className="text-xl mb-1">📄</p>
            <p className="text-muted-foreground">File Upload</p>
          </div>
          <div>
            <p className="text-xl mb-1">🎙️</p>
            <p className="text-muted-foreground">Voice Input</p>
          </div>
        </div>
      </div>
    </div>
  );
}
