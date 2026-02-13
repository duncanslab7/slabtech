'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Heading, Text, Container } from '@/components';

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: 'super_admin' | 'company_admin' | 'user';
  is_active: boolean;
  created_at: string;
  company_id: string | null;
}

export default function CompanyUserDetailPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = use(params);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'training'>('details');
  const [quizProgress, setQuizProgress] = useState<any>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  const fetchUserData = async () => {
    try {
      const supabase = createClient();

      const { data: userData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (userData) {
        setProfile(userData as UserProfile);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  const fetchQuizProgress = async () => {
    setQuizLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${id}/quiz-progress`);
      const data = await response.json();

      if (response.ok) {
        setQuizProgress(data);
      }
    } catch (error) {
      console.error('Error fetching quiz progress:', error);
    } finally {
      setQuizLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'training') {
      fetchQuizProgress();
    }
  }, [activeTab]);

  if (loading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-gold"></div>
        </div>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <Text variant="muted" className="text-gray-600">User not found</Text>
          <Link href={`/c/${slug}/users`} className="text-success-gold hover:underline mt-4 inline-block">
            Back to Users
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" padding="lg">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href={`/c/${slug}/users`} className="text-steel-gray hover:text-midnight-blue">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <Heading level={1} size="xl" className="truncate text-gray-900">
              {profile.display_name || profile.email}
            </Heading>
            <Text variant="muted" className="truncate text-gray-600">{profile.email}</Text>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-full ${
            profile.role === 'super_admin'
              ? 'bg-purple-100 text-purple-700'
              : profile.role === 'company_admin'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {profile.role === 'super_admin' ? 'Super Admin' : profile.role === 'company_admin' ? 'Company Admin' : 'User'}
          </span>
          <span className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-full ${
            profile.is_active
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {profile.is_active ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-8 min-w-max sm:min-w-0">
          {(['details', 'training'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium capitalize transition-colors text-sm sm:text-base whitespace-nowrap ${
                activeTab === tab
                  ? 'border-success-gold text-success-gold'
                  : 'border-transparent text-steel-gray hover:text-midnight-blue'
              }`}
            >
              {tab === 'training' ? 'Quiz Progress' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div>
              <Text variant="muted" size="sm" className="text-gray-600">Email</Text>
              <Text className="text-gray-900">{profile.email}</Text>
            </div>
            <div>
              <Text variant="muted" size="sm" className="text-gray-600">Display Name</Text>
              <Text className="text-gray-900">{profile.display_name || '-'}</Text>
            </div>
            <div>
              <Text variant="muted" size="sm" className="text-gray-600">Role</Text>
              <Text className="capitalize text-gray-900">{profile.role}</Text>
            </div>
            <div>
              <Text variant="muted" size="sm" className="text-gray-600">Created</Text>
              <Text className="text-gray-900">{new Date(profile.created_at).toLocaleDateString()}</Text>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'training' && (
        <div>
          {quizLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-gold"></div>
            </div>
          ) : !quizProgress ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
              <Text variant="muted" className="text-gray-600">Failed to load quiz progress</Text>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <Text variant="muted" size="sm" className="text-gray-600">Total Attempts</Text>
                  <Text className="text-2xl font-bold text-gray-900">{quizProgress.summary.totalAttempts}</Text>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <Text variant="muted" size="sm" className="text-gray-600">Videos Attempted</Text>
                  <Text className="text-2xl font-bold text-gray-900">{quizProgress.summary.uniqueVideos}</Text>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <Text variant="muted" size="sm" className="text-gray-600">Videos Passed</Text>
                  <Text className="text-2xl font-bold text-green-600">{quizProgress.summary.passedVideos}</Text>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <Text variant="muted" size="sm" className="text-gray-600">Average Score</Text>
                  <Text className="text-2xl font-bold text-gray-900">{quizProgress.summary.averageScore}%</Text>
                </div>
              </div>

              {/* Quiz Attempts by Video */}
              {quizProgress.videoProgress.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
                  <Text variant="muted" className="text-gray-600">No quiz attempts yet</Text>
                  <Text variant="muted" size="sm" className="mt-2 text-gray-500">
                    This user hasn't taken any quizzes
                  </Text>
                </div>
              ) : (
                <div className="space-y-4">
                  {quizProgress.videoProgress.map((videoData: any) => (
                    <div
                      key={videoData.video.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <Text variant="emphasis" className="text-lg font-semibold text-gray-900">
                              {videoData.video.title}
                            </Text>
                            {videoData.hasPassed ? (
                              <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-700 rounded-full">
                                ✓ Passed
                              </span>
                            ) : (
                              <span className="px-3 py-1 text-sm font-medium bg-red-100 text-red-700 rounded-full">
                                Not Passed
                              </span>
                            )}
                          </div>
                          <Text variant="muted" size="sm" className="mt-1 text-gray-600">
                            {videoData.totalAttempts} attempt{videoData.totalAttempts !== 1 ? 's' : ''} •
                            Best Score: {videoData.bestAttempt.score}%
                          </Text>
                        </div>
                      </div>

                      {/* Attempts Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Attempt
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Score
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Questions
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Date
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {videoData.allAttempts.map((attempt: any) => (
                              <tr key={attempt.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  #{attempt.attempt_number}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-sm font-semibold ${
                                    attempt.score >= 80 ? 'text-green-600' :
                                    attempt.score >= 60 ? 'text-amber-600' : 'text-red-600'
                                  }`}>
                                    {attempt.score}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {attempt.correct_answers}/{attempt.total_questions}
                                </td>
                                <td className="px-4 py-3">
                                  {attempt.passed ? (
                                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                      Passed
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                      Failed
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {new Date(attempt.completed_at).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Container>
  );
}
