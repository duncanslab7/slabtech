'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Heading, Text, Container } from '@/components';

interface UserUsageSummary {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  account_created_at: string;
  lifetime_active_minutes: number;
  lifetime_sessions: number;
  last_7_days_active_minutes: number;
  last_7_days_sessions: number;
  last_30_days_active_minutes: number;
  last_30_days_sessions: number;
  total_days_active: number;
  days_active_last_7: number;
  days_active_last_30: number;
  avg_minutes_per_active_day: number;
  last_active_date: string | null;
}

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
}

export default function CompanyUsagePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [users, setUsers] = useState<UserUsageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'lifetime' | 'last_7' | 'last_30'>('last_7');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    setLoading(true);

    // Get company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('id, name, slug')
      .eq('slug', slug)
      .single();

    if (companyData) {
      setCompany(companyData);

      // Fetch user usage for this company
      const { data: usersData } = await supabase
        .from('user_usage_summary')
        .select('*')
        .eq('company_id', companyData.id)
        .order('last_7_days_active_minutes', { ascending: false });

      if (usersData) {
        setUsers(usersData);
      }
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

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.display_name && user.display_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && user.last_7_days_active_minutes > 0) ||
      (filterStatus === 'inactive' && user.last_7_days_active_minutes === 0);

    return matchesSearch && matchesStatus;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === 'lifetime') {
      return b.lifetime_active_minutes - a.lifetime_active_minutes;
    } else if (sortBy === 'last_7') {
      return b.last_7_days_active_minutes - a.last_7_days_active_minutes;
    } else {
      return b.last_30_days_active_minutes - a.last_30_days_active_minutes;
    }
  });

  // Calculate summary stats
  const totalUsers = users.length;
  const activeUsersLast7 = users.filter(u => u.last_7_days_active_minutes > 0).length;
  const totalTimeLast7 = users.reduce((sum, u) => sum + u.last_7_days_active_minutes, 0);
  const avgTimeLast7 = totalUsers > 0 ? totalTimeLast7 / totalUsers : 0;

  if (loading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-gold"></div>
        </div>
      </Container>
    );
  }

  if (!company) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Text className="text-center text-gray-600">Company not found</Text>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" padding="lg">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link href={`/c/${slug}/dashboard`} className="text-steel-gray hover:text-midnight-blue">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Heading level={1} size="xl" className="text-gray-900">
            Usage Analytics
          </Heading>
        </div>
        <Text variant="muted" className="text-gray-600">
          Track user engagement and platform usage for {company.name}
        </Text>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text variant="muted" size="sm" className="text-gray-600">Total Users</Text>
          <Heading level={3} size="lg" className="text-gray-900 mt-1">{totalUsers}</Heading>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text variant="muted" size="sm" className="text-gray-600">Active Users (7d)</Text>
          <Heading level={3} size="lg" className="text-gray-900 mt-1">
            {activeUsersLast7}
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({totalUsers > 0 ? Math.round((activeUsersLast7 / totalUsers) * 100) : 0}%)
            </span>
          </Heading>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text variant="muted" size="sm" className="text-gray-600">Total Time (7d)</Text>
          <Heading level={3} size="lg" className="text-gray-900 mt-1">
            {formatHours(totalTimeLast7)}
          </Heading>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text variant="muted" size="sm" className="text-gray-600">Avg per User (7d)</Text>
          <Heading level={3} size="lg" className="text-gray-900 mt-1">
            {formatMinutes(Math.round(avgTimeLast7))}
          </Heading>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold focus:border-transparent"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold focus:border-transparent"
        >
          <option value="all">All Users</option>
          <option value="active">Active (7d)</option>
          <option value="inactive">Inactive (7d)</option>
        </select>
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

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4 mb-6">
        {sortedUsers.map((user) => (
          <div key={user.user_id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="mb-3">
              <div className="font-semibold text-gray-900">
                {user.display_name || user.email}
              </div>
              <div className="text-sm text-gray-600">{user.email}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <div className="text-gray-600 text-xs">Last 7 Days</div>
                <div className="font-medium text-gray-900">{formatHours(user.last_7_days_active_minutes)}</div>
                <div className="text-xs text-gray-500">{user.last_7_days_sessions} sessions</div>
              </div>
              <div>
                <div className="text-gray-600 text-xs">Lifetime</div>
                <div className="font-medium text-gray-900">{formatHours(user.lifetime_active_minutes)}</div>
                <div className="text-xs text-gray-500">{user.lifetime_sessions} sessions</div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <Link
                href={`/users/${user.user_id}/usage`}
                className="text-sm text-success-gold hover:text-amber-600 font-medium"
              >
                View Details →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Active
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
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.last_7_days_active_minutes > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.last_7_days_active_minutes > 0 ? 'Active' : 'Inactive'}
                    </span>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_active_date
                      ? new Date(user.last_active_date).toLocaleDateString()
                      : 'Never'}
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

      {sortedUsers.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <Text variant="muted" className="text-gray-600">
            No users found matching your filters
          </Text>
        </div>
      )}
    </Container>
  );
}
