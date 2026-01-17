'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Heading, Text, Container } from '@/components';

interface UserUsageSummary {
  user_id: string;
  email: string;
  display_name: string | null;
  company_id: string | null;
  company_name: string | null;
  role: string;
  is_active: boolean;
  account_created_at: string;
  lifetime_active_minutes: number;
  lifetime_sessions: number;
  lifetime_transcript_views: number;
  lifetime_audio_minutes: number;
  lifetime_uploads: number;
  last_7_days_active_minutes: number;
  last_7_days_sessions: number;
  last_30_days_active_minutes: number;
  last_30_days_sessions: number;
  first_active_date: string | null;
  last_active_date: string | null;
  total_days_active: number;
  days_active_last_7: number;
  days_active_last_30: number;
  avg_minutes_per_active_day: number;
}

interface CompanyUsageSummary {
  company_id: string;
  company_name: string;
  total_users: number;
  active_users: number;
  lifetime_active_minutes: number;
  last_7_days_active_minutes: number;
  last_30_days_active_minutes: number;
  active_users_last_7_days: number;
  active_users_last_30_days: number;
  avg_minutes_per_user: number;
}

export default function UsageAnalyticsPage() {
  const [users, setUsers] = useState<UserUsageSummary[]>([]);
  const [companies, setCompanies] = useState<CompanyUsageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'users' | 'companies'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'lifetime' | 'last_7' | 'last_30'>('last_7');

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch user usage summary
    const { data: usersData, error: usersError } = await supabase
      .from('user_usage_summary')
      .select('*')
      .order('last_7_days_active_minutes', { ascending: false });

    if (usersData && !usersError) {
      setUsers(usersData);
    }

    // Fetch company usage summary
    const { data: companiesData, error: companiesError } = await supabase
      .from('company_usage_summary')
      .select('*')
      .order('last_7_days_active_minutes', { ascending: false });

    if (companiesData && !companiesError) {
      setCompanies(companiesData);
    }

    setLoading(false);
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatHours = (minutes: number): string => {
    return (minutes / 60).toFixed(1) + 'h';
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.display_name && user.display_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.company_name && user.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === 'lifetime') {
      return b.lifetime_active_minutes - a.lifetime_active_minutes;
    } else if (sortBy === 'last_7') {
      return b.last_7_days_active_minutes - a.last_7_days_active_minutes;
    } else {
      return b.last_30_days_active_minutes - a.last_30_days_active_minutes;
    }
  });

  if (loading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-gold"></div>
        </div>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" padding="lg">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/admin" className="text-steel-gray hover:text-midnight-blue">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Heading level={1} size="xl" className="text-gray-900">
            Usage Analytics
          </Heading>
        </div>
        <Text variant="muted" className="text-gray-600">
          Track user engagement and platform usage across all companies
        </Text>
      </div>

      {/* View Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setView('users')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            view === 'users'
              ? 'border-success-gold text-success-gold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Users ({users.length})
        </button>
        <button
          onClick={() => setView('companies')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            view === 'companies'
              ? 'border-success-gold text-success-gold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Companies ({companies.length})
        </button>
      </div>

      {view === 'users' ? (
        <>
          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold focus:border-transparent"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold focus:border-transparent"
            >
              <option value="last_7">Last 7 Days</option>
              <option value="last_30">Last 30 Days</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <Text variant="muted" size="sm" className="text-gray-600">Total Users</Text>
              <Heading level={3} size="lg" className="text-gray-900 mt-1">{users.length}</Heading>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <Text variant="muted" size="sm" className="text-gray-600">Active Users (7d)</Text>
              <Heading level={3} size="lg" className="text-gray-900 mt-1">
                {users.filter(u => u.last_7_days_active_minutes > 0).length}
              </Heading>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <Text variant="muted" size="sm" className="text-gray-600">Total Time (7d)</Text>
              <Heading level={3} size="lg" className="text-gray-900 mt-1">
                {formatHours(users.reduce((sum, u) => sum + u.last_7_days_active_minutes, 0))}
              </Heading>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <Text variant="muted" size="sm" className="text-gray-600">Avg per User (7d)</Text>
              <Heading level={3} size="lg" className="text-gray-900 mt-1">
                {formatMinutes(Math.round(users.reduce((sum, u) => sum + u.last_7_days_active_minutes, 0) / Math.max(users.length, 1)))}
              </Heading>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last 7 Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last 30 Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lifetime
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Active
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedUsers.map((user) => (
                    <tr key={user.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.display_name || user.email}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Text size="sm" className="text-gray-900">
                          {user.company_name || '-'}
                        </Text>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatHours(user.last_7_days_active_minutes)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.last_7_days_sessions} sessions
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatHours(user.last_30_days_active_minutes)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.last_30_days_sessions} sessions
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatHours(user.lifetime_active_minutes)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.lifetime_sessions} sessions
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {user.total_days_active} total
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.days_active_last_7} last 7d
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Link
                          href={`/users/${user.user_id}/usage`}
                          className="text-success-gold hover:text-amber-600"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Companies Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <Text variant="muted" size="sm" className="text-gray-600">Total Companies</Text>
              <Heading level={3} size="lg" className="text-gray-900 mt-1">{companies.length}</Heading>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <Text variant="muted" size="sm" className="text-gray-600">Total Users</Text>
              <Heading level={3} size="lg" className="text-gray-900 mt-1">
                {companies.reduce((sum, c) => sum + c.total_users, 0)}
              </Heading>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <Text variant="muted" size="sm" className="text-gray-600">Active Users (7d)</Text>
              <Heading level={3} size="lg" className="text-gray-900 mt-1">
                {companies.reduce((sum, c) => sum + c.active_users_last_7_days, 0)}
              </Heading>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <Text variant="muted" size="sm" className="text-gray-600">Total Time (7d)</Text>
              <Heading level={3} size="lg" className="text-gray-900 mt-1">
                {formatHours(companies.reduce((sum, c) => sum + c.last_7_days_active_minutes, 0))}
              </Heading>
            </div>
          </div>

          {/* Companies Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active (7d)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time (7d)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time (30d)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lifetime
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companies.map((company) => (
                    <tr key={company.company_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Text className="font-medium text-gray-900">
                          {company.company_name}
                        </Text>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {company.active_users} / {company.total_users}
                        </div>
                        <div className="text-xs text-gray-500">active</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Text size="sm" className="text-gray-900">
                          {company.active_users_last_7_days}
                        </Text>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Text size="sm" className="text-gray-900">
                          {formatHours(company.last_7_days_active_minutes)}
                        </Text>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Text size="sm" className="text-gray-900">
                          {formatHours(company.last_30_days_active_minutes)}
                        </Text>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Text size="sm" className="text-gray-900">
                          {formatHours(company.lifetime_active_minutes)}
                        </Text>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Link
                          href={`/c/${company.company_id}/usage`}
                          className="text-success-gold hover:text-amber-600"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Container>
  );
}
