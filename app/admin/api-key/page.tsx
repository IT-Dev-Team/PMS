'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ApiKeyPage() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchApiKeyStatus();
  }, []);

  const fetchApiKeyStatus = async () => {
    try {
    

      const response = await fetch('/api/admin/api-key', {
        headers: { Authorization: `Bearer ` }
      });
      const data = await response.json();
      setHasKey(data.hasKey || false);
    } catch (error) {
      console.error('[v0] Error fetching API key status:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpdateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'API key cannot be empty' });
      return;
    }

    setIsLoading(true);
    try {
      

      const response = await fetch('/api/admin/api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update API key');
      }

      setMessage({ type: 'success', text: 'API key updated successfully' });
      setApiKey('');
      setShowKey(false);
      setHasKey(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">ManusAI API Key</h1>
        <p className="text-slate-600">Set or update your ManusAI API key securely</p>
      </div>

      {message && (
        <Alert className={`mb-6 ${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-6">
        <form onSubmit={handleUpdateApiKey} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              API Key {hasKey && <span className="text-green-600 font-medium">(Currently Set)</span>}
            </label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="Enter your ManusAI API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'Hide' : 'Show'}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Your API key is hashed and securely stored. It will never be displayed after saving.
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? 'Updating...' : 'Update API Key'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Security Note</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>API keys are hashed using bcrypt for maximum security</li>
          <li>Only the hash is stored in the database</li>
          <li>You can update the key at any time</li>
          <li>The key is used to authenticate requests to ManusAI API</li>
        </ul>
      </Card>
    </div>
  );
}
