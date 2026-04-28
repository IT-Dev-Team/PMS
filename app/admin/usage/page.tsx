'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface UserCredit {
  user_id: string;
  credit_percentage: number;
  credits_remaining: number;
  credits_used: number;
}

interface UsageLog {
  id: string;
  user_id: string;
  credits_used: number;
  description: string;
  created_at: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function UsagePage() {
  const [users, setUsers] = useState<UserCredit[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
     
      const [creditsRes, logsRes] = await Promise.all([
        fetch('/api/admin/credits', {
          headers: { Authorization: `Bearer ` }
        }),
        fetch('/api/admin/usage', {
          headers: { Authorization: `Bearer ` }
        })
      ]);

      const creditsData = await creditsRes.json();
      const logsData = await logsRes.json();

      if (creditsRes.ok) {
        setUsers(creditsData);
        if (creditsData.length > 0) {
          setSelectedUser(creditsData[0].user_id);
        }
      } else {
        throw new Error(creditsData.error);
      }

      if (logsRes.ok) {
        setUsageLogs(logsData);
      }
    } catch (error) {
      console.error('[v0] Error fetching data:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to fetch data'
      });
    } finally {
      setIsFetching(false);
    }
  };

  // Filter logs for selected user
  const filteredLogs = selectedUser
    ? usageLogs.filter(log => log.user_id === selectedUser)
    : usageLogs;

  // Prepare chart data
  const chartData = users.map(user => ({
    user_id: user.user_id.substring(0, 15),
    used: user.credits_used,
    remaining: user.credits_remaining
  }));

  // Prepare pie chart data
  const pieData = users.map(user => ({
    name: user.user_id,
    value: user.credits_remaining + user.credits_used
  }));

  // Calculate stats
  const totalUsed = users.reduce((sum, u) => sum + u.credits_used, 0);
  const totalRemaining = users.reduce((sum, u) => sum + u.credits_remaining, 0);
  const totalAllocated = totalUsed + totalRemaining;
  const usagePercentage = totalAllocated > 0 ? ((totalUsed / totalAllocated) * 100).toFixed(1) : 0;

  if (isFetching) {
    return <div className="text-center py-8">Loading usage data...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Usage Dashboard</h1>
        <p className="text-slate-600">Track credit usage and remaining balance by user</p>
      </div>

      {message && (
        <Alert className={`${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-600">Total Allocated</p>
          <p className="text-3xl font-bold mt-2">{totalAllocated.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-600">Credits Used</p>
          <p className="text-3xl font-bold mt-2 text-orange-600">{totalUsed.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-600">Credits Remaining</p>
          <p className="text-3xl font-bold mt-2 text-green-600">{totalRemaining.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-600">Usage %</p>
          <p className="text-3xl font-bold mt-2">{usagePercentage}%</p>
        </Card>
      </div>

      {/* Charts */}
      {users.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart - Used vs Remaining */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4 text-slate-900">Credits Used vs Remaining</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="user_id" angle={-45} textAnchor="end" height={80} fontSize={12} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="used" stackId="a" fill="#f59e0b" name="Used" />
                <Bar dataKey="remaining" stackId="a" fill="#10b981" name="Remaining" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Pie Chart - Credit Distribution */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4 text-slate-900">Credit Distribution by User</h3>
            {pieData.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}

      {/* User Details */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 text-slate-900">User Details</h2>
        {users.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No users found</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Credit %</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Usage %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const total = user.credits_remaining + user.credits_used;
                  const usage = total > 0 ? ((user.credits_used / total) * 100).toFixed(1) : 0;
                  return (
                    <TableRow
                      key={user.user_id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedUser(user.user_id)}
                    >
                      <TableCell className="font-medium">{user.user_id}</TableCell>
                      <TableCell>{user.credit_percentage}%</TableCell>
                      <TableCell className="text-green-600">{user.credits_remaining}</TableCell>
                      <TableCell className="text-orange-600">{user.credits_used}</TableCell>
                      <TableCell>{total}</TableCell>
                      <TableCell>{usage}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Usage Logs */}
      {selectedUser && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 text-slate-900">Usage History - {selectedUser}</h2>
          {filteredLogs.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No usage logs for this user</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Credits Used</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{log.credits_used}</TableCell>
                      <TableCell>{log.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
