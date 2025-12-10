'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Heading, Text, Card, Container } from '@/components';

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

interface UserLoginStats {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  logins_last_7_days: number;
  logins_last_24_hours: number;
  unique_days_logged_in: number;
  last_login: string | null;
  is_suspicious: boolean;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserLoginStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [orphanedUsers, setOrphanedUsers] = useState<any[]>([]);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Create user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchUsers = async () => {
    const supabase = createClient();

    // Fetch user login stats from the view
    const { data, error } = await supabase
      .from('user_login_stats')
      .select('*')
      .order('email');

    if (data && !error) {
      setUsers(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          displayName: newDisplayName || newEmail,
          role: newRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      // Reset form and close modal
      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      setNewRole('user');
      setShowCreateModal(false);

      // Refresh users list
      fetchUsers();
    } catch (error: any) {
      setCreateError(error.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      setShowDeleteModal(null);
      fetchUsers();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }

      fetchUsers();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleCheckOrphanedUsers = async () => {
    setCleanupLoading(true);
    try {
      const response = await fetch('/api/admin/cleanup-orphaned');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check orphaned users');
      }

      setOrphanedUsers(data.orphanedUsers || []);
      setShowCleanupModal(true);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleCleanupOrphanedUsers = async () => {
    setCleanupLoading(true);
    try {
      const response = await fetch('/api/admin/cleanup-orphaned', {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cleanup orphaned users');
      }

      alert(data.message);
      setShowCleanupModal(false);
      setOrphanedUsers([]);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <Container maxWidth="xl" padding="lg">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/admin" className="text-steel-gray hover:text-midnight-blue">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Heading level={1} size="xl">
            User Management
          </Heading>
        </div>
        <Text variant="muted" className="mb-4">
          Create, manage, and monitor user accounts
        </Text>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCheckOrphanedUsers}
            disabled={cleanupLoading}
            className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            {cleanupLoading ? 'Checking...' : 'Cleanup Orphaned'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-success-gold text-white font-semibold rounded-lg hover:bg-amber-500 transition-colors text-sm sm:text-base"
          >
            + Create User
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-gold"></div>
        </div>
      ) : users.length === 0 ? (
        <Card variant="outlined" padding="lg" className="text-center">
          <Text variant="muted">No users found. Create your first user to get started.</Text>
        </Card>
      ) : (
        <>
          {/* Horizontal Scroll Indicator */}
          <div className="mb-4 flex items-center justify-center gap-2 text-xs text-steel-gray lg:hidden">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <span>Swipe to see more</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>

          {/* Mobile Card Layout */}
          <div className="lg:hidden space-y-4">
            {users.map((user) => (
              <Card key={user.user_id} variant="outlined" padding="md" className={user.is_suspicious ? 'border-red-300 bg-red-50' : ''}>
                <div className="space-y-3">
                  {/* User Info */}
                  <div>
                    <div className="font-semibold text-midnight-blue flex items-center gap-2 flex-wrap">
                      {user.display_name || user.email}
                      {user.is_suspicious && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                          Suspicious
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-steel-gray">{user.email}</div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-steel-gray text-xs">Logins (7 days)</div>
                      <div className="font-medium">{user.logins_last_7_days}</div>
                    </div>
                    <div>
                      <div className="text-steel-gray text-xs">Last Login</div>
                      <div className="font-medium">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Link
                      href={`/users/${user.user_id}`}
                      className="flex-1 text-center px-3 py-2 bg-success-gold text-white text-sm font-medium rounded-lg hover:bg-amber-500"
                    >
                      Manage
                    </Link>
                    <button
                      onClick={() => handleToggleActive(user.user_id, user.is_active)}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border ${
                        user.is_active
                          ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          : 'border-green-300 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {user.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(user.user_id)}
                      className="px-3 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Logins (7 days)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.user_id} className={`hover:bg-gray-50 ${user.is_suspicious ? 'bg-red-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        {user.display_name || user.email}
                        {user.is_suspicious && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                            Suspicious
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {user.logins_last_7_days} logins
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.unique_days_logged_in} unique days
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/users/${user.user_id}`}
                        className="text-success-gold hover:text-amber-600"
                      >
                        Manage
                      </Link>
                      <button
                        onClick={() => handleToggleActive(user.user_id, user.is_active)}
                        className={`${
                          user.is_active
                            ? 'text-gray-500 hover:text-gray-700'
                            : 'text-green-600 hover:text-green-700'
                        }`}
                      >
                        {user.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => setShowDeleteModal(user.user_id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-midnight-blue mb-4">Create New User</h2>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold focus:border-transparent"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold focus:border-transparent"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold focus:border-transparent"
                >
                  <option value="user">User (Limited Access)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>

              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 px-4 py-2 bg-success-gold text-white font-semibold rounded-lg hover:bg-amber-500 disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-red-600 mb-4">Delete User</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(showDeleteModal)}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Orphaned Users Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-midnight-blue mb-4">Orphaned Users Cleanup</h2>

            {orphanedUsers.length === 0 ? (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                No orphaned users found. All auth users have corresponding profiles.
              </div>
            ) : (
              <>
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4">
                  Found {orphanedUsers.length} orphaned user(s) - users in auth without profiles.
                </div>

                <div className="max-h-64 overflow-y-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Confirmed</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orphanedUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{user.email}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {user.email_confirmed_at ? (
                              <span className="text-green-600">Yes</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCleanupModal(false);
                  setOrphanedUsers([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {orphanedUsers.length > 0 && (
                <button
                  onClick={handleCleanupOrphanedUsers}
                  disabled={cleanupLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {cleanupLoading ? 'Cleaning...' : `Delete ${orphanedUsers.length} User(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
