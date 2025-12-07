import { Heading, Text, Card, Container } from '@/components'
import Link from 'next/link'

export default function AdminDashboard() {
  return (
    <Container maxWidth="xl" padding="lg">
      <div className="mb-8">
        <Heading level={1} size="xl">
          Admin Panel
        </Heading>
        <Text variant="muted" className="mt-2">
          Manage transcriptions, configure PII redaction, and review call recordings
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dashboard Card */}
        <Link href="/dashboard" className="group">
          <Card variant="outlined" padding="lg" className="h-full transition-all hover:border-midnight-blue hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-midnight-blue bg-opacity-10">
                <svg
                  className="h-6 w-6 text-midnight-blue"
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
              <span className="text-midnight-blue group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2">
              View Transcripts
            </Heading>
            <Text variant="muted">
              Browse all call recordings, view transcripts, and download audio files
            </Text>
          </Card>
        </Link>

        {/* Config Card */}
        <Link href="/config" className="group">
          <Card variant="outlined" padding="lg" className="h-full transition-all hover:border-midnight-blue hover:shadow-lg">
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
              <span className="text-midnight-blue group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2">
              Configure Redaction
            </Heading>
            <Text variant="muted">
              Manage PII redaction settings for new transcript processing
            </Text>
          </Card>
        </Link>

        {/* Upload Card */}
        <Link href="/upload" className="group">
          <Card variant="outlined" padding="lg" className="h-full transition-all hover:border-steel-gray hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-steel-gray bg-opacity-10">
                <svg
                  className="h-6 w-6 text-steel-gray"
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
              <span className="text-steel-gray group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2">
              Upload New Recording
            </Heading>
            <Text variant="muted">
              Go to the upload form to process a new call recording
            </Text>
          </Card>
        </Link>

        {/* User Management Card */}
        <Link href="/users" className="group">
          <Card variant="outlined" padding="lg" className="h-full transition-all hover:border-midnight-blue hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-midnight-blue bg-opacity-10">
                <svg
                  className="h-6 w-6 text-midnight-blue"
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
              <span className="text-midnight-blue group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <Heading level={3} size="md" className="mb-2">
              User Management
            </Heading>
            <Text variant="muted">
              Create and manage user accounts, assign roles, and monitor login activity
            </Text>
          </Card>
        </Link>

        {/* Stats Card */}
        <Card variant="elevated" padding="lg">
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
          </div>
          <Heading level={3} size="md" className="mb-2">
            System Status
          </Heading>
          <Text variant="muted" className="mb-3">
            All services operational
          </Text>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-gold"></div>
              <Text size="sm">AssemblyAI API Connected</Text>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-gold"></div>
              <Text size="sm">Supabase Database Active</Text>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success-gold"></div>
              <Text size="sm">Storage Available</Text>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  )
}
