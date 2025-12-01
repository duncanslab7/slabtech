import { createClient } from '@/utils/supabase/server'
import { Heading, Text, Card, Container } from '@/components'
import Link from 'next/link'

interface Transcript {
  id: string
  created_at: string
  salesperson_name: string
  customer_name: string | null
  original_filename: string
  redaction_config_used: string
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch all transcripts
  const { data: transcripts, error } = await supabase
    .from('transcripts')
    .select('id, created_at, salesperson_name, customer_name, original_filename, redaction_config_used')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching transcripts:', error)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Container maxWidth="xl" padding="lg">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Heading level={1} size="xl">
            Transcripts Dashboard
          </Heading>
          <Text variant="muted" className="mt-2">
            View and manage all call recordings and transcriptions
          </Text>
        </div>
        <Link
          href="/config"
          className="rounded-md bg-steel-gray px-4 py-2 text-pure-white hover:bg-midnight-blue transition-colors"
        >
          Configure Redaction
        </Link>
      </div>

      {!transcripts || transcripts.length === 0 ? (
        <Card variant="elevated" padding="lg">
          <div className="text-center py-12">
            <Text variant="muted" size="lg">
              No transcripts yet. Upload your first audio file to get started.
            </Text>
          </div>
        </Card>
      ) : (
        <Card variant="elevated" padding="none">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-midnight-blue">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-pure-white uppercase tracking-wider"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-pure-white uppercase tracking-wider"
                  >
                    Salesperson
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-pure-white uppercase tracking-wider"
                  >
                    Customer
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-pure-white uppercase tracking-wider"
                  >
                    Filename
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-pure-white uppercase tracking-wider"
                  >
                    Config Used
                  </th>
                  <th scope="col" className="px-6 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-pure-white divide-y divide-gray-200">
                {transcripts.map((transcript) => (
                  <tr key={transcript.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Text size="sm">{formatDate(transcript.created_at)}</Text>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Text variant="emphasis" size="sm">
                        {transcript.salesperson_name}
                      </Text>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Text variant="muted" size="sm">
                        {transcript.customer_name || '—'}
                      </Text>
                    </td>
                    <td className="px-6 py-4">
                      <Text size="sm" className="truncate max-w-xs">
                        {transcript.original_filename}
                      </Text>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-gold bg-opacity-10 text-success-gold">
                        {transcript.redaction_config_used}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/transcripts/${transcript.id}`}
                        className="text-midnight-blue hover:text-steel-gray transition-colors font-medium"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-6 flex justify-between items-center">
        <Text variant="muted" size="sm">
          Total transcripts: {transcripts?.length || 0}
        </Text>
        <Link
          href="/admin"
          className="text-midnight-blue hover:text-steel-gray transition-colors text-sm font-medium"
        >
          ← Back to Admin
        </Link>
      </div>
    </Container>
  )
}
