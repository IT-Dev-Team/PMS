'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { label: 'API Key Settings', href: '/admin/api-key' },
    { label: 'General Settings', href: '/admin/settings' },
    { label: 'User Credits', href: '/admin/credits' },
    { label: 'Usage Dashboard', href: '/admin/usage' },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-6 border-b border-slate-700">
          <h1 className={`font-bold text-lg ${!sidebarOpen && 'hidden'}`}>ManusAI Admin</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  className={`w-full justify-start ${isActive ? 'bg-blue-600' : 'hover:bg-slate-800'}`}
                >
                  <span className={!sidebarOpen ? 'hidden' : ''}>{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full text-slate-400 hover:text-white"
          >
            {sidebarOpen ? '←' : '→'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <h2 className="text-2xl font-bold text-slate-900">Admin Dashboard</h2>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
