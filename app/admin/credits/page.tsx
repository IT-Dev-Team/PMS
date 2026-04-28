'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface UserCredit {
  id: string;
  user_id: string;
  credit_percentage: number;
  credits_remaining: number;
  credits_used: number;
  created_at: string;
  updated_at: string;
}

export default function CreditsPage() {
  const [users, setUsers] = useState<UserCredit[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newPercentage, setNewPercentage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPercentage, setEditPercentage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      

      const response = await fetch('/api/admin/credits', {
        headers: { Authorization: `Bearer ` }
      });
      const data = await response.json();

      if (response.ok) {
        setUsers(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('[v0] Error fetching users:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to fetch users'
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserId.trim()) {
      setMessage({ type: 'error', text: 'User ID cannot be empty' });
      return;
    }

    if (newPercentage < 0 || newPercentage > 100) {
      setMessage({ type: 'error', text: 'Percentage must be between 0 and 100' });
      return;
    }

    setIsLoading(true);
    try {
      
      const response = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer `
        },
        body: JSON.stringify({
          userId: newUserId,
          creditPercentage: newPercentage
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add user');
      }

      setMessage({ type: 'success', text: data.message });
      setNewUserId('');
      setNewPercentage(0);
      fetchUsers();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string) => {
    if (editPercentage < 0 || editPercentage > 100) {
      setMessage({ type: 'error', text: 'Percentage must be between 0 and 100' });
      return;
    }

    setIsLoading(true);
    try {
    
      const response = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer `
        },
        body: JSON.stringify({
          userId,
          creditPercentage: editPercentage
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      setMessage({ type: 'success', text: 'User updated successfully' });
      setEditingId(null);
      fetchUsers();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totalPercentage = users.reduce((sum, u) => sum + u.credit_percentage, 0);

  if (isFetching) {
    return <div className="text-center py-8">Loading users...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">User Credits Management</h1>
        <p className="text-slate-600">Allocate credit percentages to users</p>
      </div>

      {message && (
        <Alert className={`mb-6 ${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Add New User */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-slate-900">Add New User</h2>
        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">User ID</label>
            <Input
              type="text"
              placeholder="user@example.com"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Credit % (0-100)</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={newPercentage}
              onChange={(e) => setNewPercentage(parseInt(e.target.value) || 0)}
            />
          </div>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Adding...' : 'Add User'}
          </Button>
        </form>
      </Card>

      {/* Total Percentage */}
      <Card className={`p-4 mb-6 ${totalPercentage !== 100 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Total Allocation</p>
            <p className="text-2xl font-bold">{totalPercentage}%</p>
          </div>
          {totalPercentage !== 100 && (
            <p className="text-sm text-yellow-800">
              ⚠️ Total should equal 100% for optimal distribution
            </p>
          )}
          {totalPercentage === 100 && (
            <p className="text-sm text-green-800">
              ✓ Perfect allocation - 100%
            </p>
          )}
        </div>
      </Card>

      {/* Users Table */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 text-slate-900">Current Users</h2>
        {users.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No users added yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Credit %</TableHead>
                  <TableHead>Credits Remaining</TableHead>
                  <TableHead>Credits Used</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.user_id}</TableCell>
                    <TableCell>
                      {editingId === user.id ? (
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={editPercentage}
                          onChange={(e) => setEditPercentage(parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                      ) : (
                        `${user.credit_percentage}%`
                      )}
                    </TableCell>
                    <TableCell>{user.credits_remaining}</TableCell>
                    <TableCell>{user.credits_used}</TableCell>
                    <TableCell>
                      {editingId === user.id ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateUser(user.user_id)}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(user.id);
                            setEditPercentage(user.credit_percentage);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
