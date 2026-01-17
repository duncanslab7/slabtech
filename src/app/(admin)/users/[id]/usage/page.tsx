'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Heading, Text, Container } from '@/components';

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  company_id: string | null;
  company_name: string | null;
  role: string;
  is_active: boolean;
}

interface DailyUsage {
  date: string;
  total_active_minutes: number;
  session_count: number;
  transcript_views: number;
  audio_listen_minutes: number;
  uploads_count: number;
  first_activity: string;
  last_activity: string;
}

interface WeeklyUsage {
  week_start: string;
  total_active_minutes: number;
  session_count: number;
  days_active_in_week: number;
  avg_minutes_per_day: number;
}

interface Session {
  id: string;
  session_start: string;
  session_end: string | null;
  last_activity: string;
  is_active: boolean;
}

interface UsageSummary {
  lifetime_active_minutes: number;
  lifetime_sessions: number;
  total_days_active: number;
  avg_minutes_per_active_day: number;
  first_active_date: string | null;
  last_active_date: string | null;
}

export default function UserUsageDetailPage() {
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [weeklyUsage, setWeeklyUsage] = useState<WeeklyUsage[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [userId, timeRange]);

  const fetchData = async () => {
    setLoading(true);

    // Auto-close inactive sessions before fetching data
    try {
      await fetch('/api/activity/session', { method: 'GET' });
    } catch (error) {
      console.warn('Failed to auto-close sessions:', error);
    }

    // Fetch user profile
    const { data: userData } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        display_name,
        company_id,
        role,
        is_active,
        companies (
          name
        )
      `)
      .eq('id', userId)
      .single();

    if (userData) {
      setUser({
        ...userData,
        company_name: (userData as any).companies?.name || null,
      });
    }

    // Fetch usage summary
    const { data: summaryData } = await supabase
      .from('user_usage_summary')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (summaryData) {
      setSummary({
        lifetime_active_minutes: summaryData.lifetime_active_minutes,
        lifetime_sessions: summaryData.lifetime_sessions,
        total_days_active: summaryData.total_days_active,
        avg_minutes_per_active_day: summaryData.avg_minutes_per_active_day,
        first_active_date: summaryData.first_active_date,
        last_active_date: summaryData.last_active_date,
      });
    }

    // Calculate date range
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch daily usage
    const { data: dailyData } = await supabase
      .from('daily_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (dailyData) {
      setDailyUsage(dailyData);
    }

    // Fetch weekly usage
    const { data: weeklyData } = await supabase
      .from('weekly_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('week_start', startDate.toISOString())
      .order('week_start', { ascending: false });

    if (weeklyData) {
      setWeeklyUsage(weeklyData);
    }

    // Fetch recent sessions
    const { data: sessionsData } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_start', { ascending: false })
      .limit(20);

    if (sessionsData) {
      setSessions(sessionsData);
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

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateSessionDuration = (session: Session): string => {
    if (!session.session_end) {
      return 'Active';
    }
    const start = new Date(session.session_start);
    const end = new Date(session.session_end);
    const minutes = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
    return formatMinutes(minutes);
  };

  if (loading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-gold"></div>
        </div>
      </Container>
    );
  }

  if (!user || !summary) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Text className="text-center text-gray-600">User not found</Text>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" padding="lg">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/usage-analytics" className="text-steel-gray hover:text-midnight-blue">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Heading level={1} size="xl" className="text-gray-900">
            User Usage Details
          </Heading>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Text className="text-gray-900 font-medium">
            {user.display_name || user.email}
          </Text>
          <Text variant="muted" className="text-gray-600">
            {user.email}
          </Text>
          {user.company_name && (
            <Text variant="muted" className="text-gray-600">
              • {user.company_name}
            </Text>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text variant="muted" size="sm" className="text-gray-600">Total Active Time</Text>
          <Heading level={3} size="lg" className="text-gray-900 mt-1">
            {formatHours(summary.lifetime_active_minutes)}
          </Heading>
          <Text size="sm" className="text-gray-500 mt-1">
            Across {summary.lifetime_sessions} sessions
          </Text>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text variant="muted" size="sm" className="text-gray-600">Days Active</Text>
          <Heading level={3} size="lg" className="text-gray-900 mt-1">
            {summary.total_days_active}
          </Heading>
          <Text size="sm" className="text-gray-500 mt-1">
            {summary.first_active_date ? `Since ${formatDate(summary.first_active_date)}` : 'No activity'}
          </Text>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text variant="muted" size="sm" className="text-gray-600">Avg per Active Day</Text>
          <Heading level={3} size="lg" className="text-gray-900 mt-1">
            {formatMinutes(Math.round(summary.avg_minutes_per_active_day))}
          </Heading>
          <Text size="sm" className="text-gray-500 mt-1">
            Average engagement time
          </Text>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text variant="muted" size="sm" className="text-gray-600">Last Active</Text>
          <Heading level={3} size="lg" className="text-gray-900 mt-1">
            {summary.last_active_date ? formatDate(summary.last_active_date) : 'Never'}
          </Heading>
          <Text size="sm" className="text-gray-500 mt-1">
            Most recent activity
          </Text>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 flex gap-2">
        {(['7d', '30d', '90d', 'all'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-success-gold text-black'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : range === '90d' ? 'Last 90 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Weekly Usage */}
      {weeklyUsage.length > 0 && (
        <div className="mb-6">
          <Heading level={2} size="lg" className="text-gray-900 mb-4">
            Weekly Breakdown
          </Heading>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Week Starting
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Active
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg per Day
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {weeklyUsage.map((week) => (
                    <tr key={week.week_start} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(week.week_start)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatHours(week.total_active_minutes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {week.session_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {week.days_active_in_week}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatMinutes(Math.round(week.avg_minutes_per_day))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Daily Usage */}
      {dailyUsage.length > 0 && (
        <div className="mb-6">
          <Heading level={2} size="lg" className="text-gray-900 mb-4">
            Daily Activity
          </Heading>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transcripts Viewed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      First / Last Activity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dailyUsage.map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatDate(day.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatMinutes(day.total_active_minutes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {day.session_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {day.transcript_views}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {day.uploads_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(day.first_activity)} - {formatDateTime(day.last_activity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div>
          <Heading level={2} size="lg" className="text-gray-900 mb-4">
            Recent Sessions
          </Heading>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ended
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateTime(session.session_start)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.session_end ? formatDateTime(session.session_end) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {calculateSessionDuration(session)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          session.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {session.is_active ? 'Active' : 'Ended'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {dailyUsage.length === 0 && sessions.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <Heading level={3} size="md" className="text-gray-900 mb-2">
            No Activity Data
          </Heading>
          <Text variant="muted" className="text-gray-600">
            This user hasn't had any tracked activity in the selected time range.
          </Text>
        </div>
      )}
    </Container>
  );
}
