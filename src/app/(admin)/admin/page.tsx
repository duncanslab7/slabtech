import { Heading, Text, Card, Container } from '@/components'
import Link from 'next/link'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Container maxWidth="xl" padding="lg">
        <div className="mb-8">
          <Heading level={1} size="xl" className="text-gray-900">
            Admin Panel
          </Heading>
          <Text variant="muted" className="mt-2 text-gray-600">
            Manage transcriptions, configure PII redaction, and review call recordings
          </Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dashboard Card */}
        <Link href="/dashboard" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full transition-all hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-success-gold bg-opacity-10">
                <svg
                  className="h-6 w-6 text-success-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <span className="text-success-gold group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2 text-gray-900">
              View Transcripts
            </Heading>
            <Text variant="muted" className="text-gray-600">
              Browse all call recordings, view transcripts, and download audio files
            </Text>
          </div>
        </Link>

        {/* Config Card */}
        <Link href="/config" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full transition-all hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-success-gold bg-opacity-10">
                <svg
                  className="h-6 w-6 text-success-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </div>
              <span className="text-success-gold group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2 text-gray-900">
              Configure Redaction
            </Heading>
            <Text variant="muted" className="text-gray-600">
              Manage PII redaction settings for new transcript processing
            </Text>
          </div>
        </Link>

        {/* Upload Card */}
        <Link href="/upload" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full transition-all hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-success-gold bg-opacity-10">
                <svg
                  className="h-6 w-6 text-success-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <span className="text-success-gold group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2 text-gray-900">
              Upload New Recording
            </Heading>
            <Text variant="muted" className="text-gray-600">
              Go to the upload form to process a new call recording
            </Text>
          </div>
        </Link>

        {/* User Management Card */}
        <Link href="/users" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full transition-all hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-success-gold bg-opacity-10">
                <svg
                  className="h-6 w-6 text-success-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <span className="text-success-gold group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2 text-gray-900">
              User Management
            </Heading>
            <Text variant="muted" className="text-gray-600">
              Create and manage user accounts, assign roles, and monitor login activity
            </Text>
          </div>
        </Link>

        {/* Companies Card */}
        <Link href="/companies" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full transition-all hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-success-gold bg-opacity-10">
                <svg
                  className="h-6 w-6 text-success-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <span className="text-success-gold group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2 text-gray-900">
              Companies
            </Heading>
            <Text variant="muted" className="text-gray-600">
              Manage companies, branding, and account limits
            </Text>
          </div>
        </Link>

        {/* Usage Analytics Card */}
        <Link href="/usage-analytics" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full transition-all hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-success-gold bg-opacity-10">
                <svg
                  className="h-6 w-6 text-success-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <span className="text-success-gold group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2 text-gray-900">
              Usage Analytics
            </Heading>
            <Text variant="muted" className="text-gray-600">
              Track user engagement, active time, and platform usage metrics
            </Text>
          </div>
        </Link>

        {/* Purchase Inquiries Card */}
        <Link href="/purchase-inquiries" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full transition-all hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-success-gold bg-opacity-10">
                <svg
                  className="h-6 w-6 text-success-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <span className="text-success-gold group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2 text-gray-900">
              Purchase Inquiries
            </Heading>
            <Text variant="muted" className="text-gray-600">
              View customer requests for hoodies and platform access
            </Text>
          </div>
        </Link>

        {/* Stats Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-success-gold bg-opacity-10">
              <svg
                className="h-6 w-6 text-success-gold"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <Heading level={3} size="md" className="mb-2 text-gray-900">
            System Status
          </Heading>
          <Text variant="muted" className="mb-3 text-gray-600">
            All services operational
          </Text>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-gold"></div>
              <Text size="sm" className="text-gray-700">AssemblyAI API Connected</Text>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-gold"></div>
              <Text size="sm" className="text-gray-700">Supabase Database Active</Text>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-gold"></div>
              <Text size="sm" className="text-gray-700">Storage Available</Text>
            </div>
          </div>
        </div>
      </div>
    </Container>
    </div>
  )
}
