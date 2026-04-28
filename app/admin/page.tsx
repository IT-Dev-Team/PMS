'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCredits: 0,
    nextResetDay: 1,
    loading: true
  });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const [settingsRes, creditsRes] = await Promise.all([
        fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/admin/credits', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const settings = await settingsRes.json();
      const credits = await creditsRes.json();

      setStats({
        totalUsers: credits.length,
        totalCredits: settings.total_monthly_credits || 0,
        nextResetDay: settings.reset_day || 1,
        loading: false
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }

  const sections = [
    {
      title: 'API Key Settings',
      description: 'Set and manage your ManusAI API key',
      href: '/admin/api-key',
      color: 'bg-blue-50'
    },
    {
      title: 'General Settings',
      description: 'Configure monthly reset day and total credits',
      href: '/admin/settings',
      color: 'bg-purple-50'
    },
    {
      title: 'User Credits',
      description: 'Manage credit allocation and percentages',
      href: '/admin/credits',
      color: 'bg-green-50'
    },
    {
      title: 'Usage Dashboard',
      description: 'Track credits used and remaining by user',
      href: '/admin/usage',
      color: 'bg-orange-50'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Total Users</p>
            <p className="text-3xl font-bold">{stats.totalUsers}</p>
          </div>
        </Card>
        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Monthly Credits</p>
            <p className="text-3xl font-bold">{stats.totalCredits.toLocaleString()}</p>
          </div>
        </Card>
        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Reset Day</p>
            <p className="text-3xl font-bold">{stats.nextResetDay}</p>
            <p className="text-xs text-gray-500">of every month</p>
          </div>
        </Card>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Management Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className={`${section.color} p-6 hover:shadow-lg transition-shadow cursor-pointer h-full`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold text-lg">{section.title}</h3>
                    <p className="text-sm text-gray-600">{section.description}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 mt-1" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
