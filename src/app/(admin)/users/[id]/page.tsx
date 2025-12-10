'use client';

import { useState, useEffect, use } from 'react';
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

interface LoginLog {
  id: string;
  logged_in_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface TranscriptAssignment {
  id: string;
  assigned_at: string;
  transcripts: {
    id: string;
    original_filename: string;
    salesperson_name: string;
    created_at: string;
  };
}

interface AvailableTranscript {
  id: string;
  original_filename: string;
  salesperson_name: string;
  created_at: string;
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginLog[]>([]);
  const [assignments, setAssignments] = useState<TranscriptAssignment[]>([]);
  const [availableTranscripts, setAvailableTranscripts] = useState<AvailableTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'transcripts' | 'activity'>('details');

  // Edit form
  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [saveLoading, setSaveLoading] = useState(false);

  // Assign transcript
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTranscripts, setSelectedTranscripts] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchUserData = async () => {
    try {
      const response = await fetch(`/api/admin/users/${id}`);
      const data = await response.json();

      if (response.ok) {
        setProfile(data.profile);
        setLoginHistory(data.loginHistory);
        setAssignments(data.assignments);
        setEditDisplayName(data.profile.display_name || '');
        setEditRole(data.profile.role);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  const fetchAvailableTranscripts = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('transcripts')
      .select('id, original_filename, salesperson_name, created_at')
      .order('created_at', { ascending: false });

    if (data) {
      // Filter out already assigned transcripts
      const assignedIds = assignments.map(a => a.transcripts.id);
      const available = data.filter(t => !assignedIds.includes(t.id));
      setAvailableTranscripts(available);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [id]);

  useEffect(() => {
    if (showAssignModal) {
      fetchAvailableTranscripts();
    }
  }, [showAssignModal, assignments]);

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: editDisplayName,
          role: editRole,
        }),
      });

      if (response.ok) {
        setEditing(false);
        fetchUserData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save changes');
      }
    } catch (error) {
      alert('Failed to save changes');
    }
    setSaveLoading(false);
  };

  const handleAssignTranscripts = async () => {
    if (selectedTranscripts.length === 0) return;

    setAssignLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${id}/transcripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptIds: selectedTranscripts }),
      });

      if (response.ok) {
        setShowAssignModal(false);
        setSelectedTranscripts([]);
        fetchUserData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to assign transcripts');
      }
    } catch (error) {
      alert('Failed to assign transcripts');
    }
    setAssignLoading(false);
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${id}/transcripts/${assignmentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchUserData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to remove assignment');
      }
    } catch (error) {
      alert('Failed to remove assignment');
    }
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

  if (!profile) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card variant="outlined" padding="lg" className="text-center">
          <Text variant="muted">User not found</Text>
          <Link href="/users" className="text-success-gold hover:underline mt-4 inline-block">
            Back to Users
          </Link>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" padding="lg">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/users" className="text-steel-gray hover:text-midnight-blue">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <Heading level={1} size="xl" className="truncate">
              {profile.display_name || profile.email}
            </Heading>
            <Text variant="muted" className="truncate">{profile.email}</Text>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-full ${
            profile.role === 'admin'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {profile.role}
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
          {(['details', 'transcripts', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium capitalize transition-colors text-sm sm:text-base whitespace-nowrap ${
                activeTab === tab
                  ? 'border-success-gold text-success-gold'
                  : 'border-transparent text-steel-gray hover:text-midnight-blue'
              }`}
            >
              {tab === 'activity' ? 'Login Activity' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <Card variant="outlined" padding="lg">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-gold"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="px-4 py-2 bg-success-gold text-white rounded-lg hover:bg-amber-500 disabled:opacity-50"
                >
                  {saveLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <div>
                  <Text variant="muted" size="sm">Email</Text>
                  <Text>{profile.email}</Text>
                </div>
                <div>
                  <Text variant="muted" size="sm">Display Name</Text>
                  <Text>{profile.display_name || '-'}</Text>
                </div>
                <div>
                  <Text variant="muted" size="sm">Role</Text>
                  <Text className="capitalize">{profile.role}</Text>
                </div>
                <div>
                  <Text variant="muted" size="sm">Created</Text>
                  <Text>{new Date(profile.created_at).toLocaleDateString()}</Text>
                </div>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-midnight-blue text-white rounded-lg hover:bg-opacity-90"
              >
                Edit Details
              </button>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'transcripts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <Text variant="muted">
              {assignments.length} transcript{assignments.length !== 1 ? 's' : ''} assigned
            </Text>
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-4 py-2 bg-success-gold text-white font-semibold rounded-lg hover:bg-amber-500"
            >
              + Assign Transcripts
            </button>
          </div>

          {assignments.length === 0 ? (
            <Card variant="outlined" padding="lg" className="text-center">
              <Text variant="muted">No transcripts assigned to this user</Text>
            </Card>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Filename
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Salesperson
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Assigned
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {assignment.transcripts.original_filename}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {assignment.transcripts.salesperson_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(assignment.assigned_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div>
          <Text variant="muted" className="mb-4">
            Last 50 login attempts
          </Text>

          {loginHistory.length === 0 ? (
            <Card variant="outlined" padding="lg" className="text-center">
              <Text variant="muted">No login activity recorded</Text>
            </Card>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Device
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loginHistory.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(log.logged_in_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.ip_address || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {log.user_agent || 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Assign Transcripts Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-midnight-blue">Assign Transcripts</h2>
              <p className="text-sm text-gray-500 mt-1">
                Select transcripts to assign to {profile.display_name || profile.email}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {availableTranscripts.length === 0 ? (
                <Text variant="muted" className="text-center py-4">
                  No transcripts available to assign
                </Text>
              ) : (
                <div className="space-y-2">
                  {availableTranscripts.map((transcript) => (
                    <label
                      key={transcript.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTranscripts.includes(transcript.id)
                          ? 'border-success-gold bg-amber-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTranscripts.includes(transcript.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTranscripts([...selectedTranscripts, transcript.id]);
                          } else {
                            setSelectedTranscripts(selectedTranscripts.filter(id => id !== transcript.id));
                          }
                        }}
                        className="rounded border-gray-300 text-success-gold focus:ring-success-gold"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{transcript.original_filename}</div>
                        <div className="text-sm text-gray-500">
                          {transcript.salesperson_name} • {new Date(transcript.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedTranscripts([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTranscripts}
                disabled={selectedTranscripts.length === 0 || assignLoading}
                className="flex-1 px-4 py-2 bg-success-gold text-white rounded-lg hover:bg-amber-500 disabled:opacity-50"
              >
                {assignLoading ? 'Assigning...' : `Assign ${selectedTranscripts.length} Transcript${selectedTranscripts.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
