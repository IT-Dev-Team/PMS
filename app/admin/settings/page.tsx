'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    reset_day: 1,
    total_monthly_credits: 10000,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      
      const response = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ` }
      });
      const data = await response.json();
      if (response.ok) {
        setSettings(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('[v0] Error fetching settings:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer `
        },
        body: JSON.stringify({
          resetDay: settings.reset_day,
          totalMonthlyCredits: settings.total_monthly_credits
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setMessage({ type: 'success', text: 'Settings updated successfully' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualReset = async () => {
    setIsResetting(true);
    try {
     
      const response = await fetch('/api/admin/reset-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ manual: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset credits');
      }

      setMessage({
        type: 'success',
        text: `Credits reset successfully! Distributed ${data.creditsAllocated} credits to ${data.usersUpdated} users.`
      });
      setShowResetConfirm(false);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isFetching) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">General Settings</h1>
        <p className="text-slate-600">Configure monthly credits and reset schedules</p>
      </div>

      {message && (
        <Alert className={`mb-6 ${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold mb-6 text-slate-900">Credit Configuration</h2>
        <form onSubmit={handleUpdateSettings} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Monthly Reset Day (1-31)
            </label>
            <Input
              type="number"
              min="1"
              max="31"
              value={settings.reset_day}
              onChange={(e) => setSettings({ ...settings, reset_day: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-2">
              Credits will be automatically reset on this day of every month
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Total Monthly Credits
            </label>
            <Input
              type="number"
              min="1"
              value={settings.total_monthly_credits}
              onChange={(e) => setSettings({ ...settings, total_monthly_credits: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-2">
              Total credits available each month to distribute among users
            </p>
          </div>

          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 w-full">
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </Card>

      <Card className="p-6 bg-orange-50 border-orange-200">
        <h2 className="text-xl font-bold mb-4 text-orange-900">Manual Credit Reset</h2>
        <p className="text-sm text-orange-800 mb-4">
          Manually trigger a credit reset to redistribute credits to all users based on their allocated percentages.
        </p>

        {!showResetConfirm ? (
          <Button
            onClick={() => setShowResetConfirm(true)}
            className="bg-orange-600 hover:bg-orange-700 w-full"
          >
            Trigger Manual Reset
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-orange-900">
              ⚠️ Are you sure? This will reset all user credits based on their percentages.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleManualReset}
                disabled={isResetting}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </Button>
              <Button
                onClick={() => setShowResetConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
