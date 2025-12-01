'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Card, Container } from '@/components'
import Link from 'next/link'

export default function ConfigPage() {
  const [piiFields, setPiiFields] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Predefined PII field options from AssemblyAI (valid policies)
  const piiOptions = [
    { value: 'all', label: 'All PII Types', description: 'AssemblyAI default redaction for all supported PII' },
    { value: 'person_name', label: 'Person Names', description: 'Redact personal names' },
    { value: 'organization', label: 'Organizations', description: 'Redact company or organization names' },
    { value: 'location', label: 'Locations', description: 'Redact cities, addresses, or locations' },
    { value: 'email_address', label: 'Email Addresses', description: 'Redact email addresses' },
    { value: 'phone_number', label: 'Phone Numbers', description: 'Redact phone numbers' },
    { value: 'credit_card_number', label: 'Credit Card Numbers', description: 'Redact credit card numbers' },
    { value: 'bank_account_number', label: 'Bank Account Numbers', description: 'Redact bank/account numbers' },
    { value: 'us_social_security_number', label: 'US Social Security Numbers', description: 'Redact SSNs' },
    { value: 'date_of_birth', label: 'Date of Birth', description: 'Redact DOB references' },
    { value: 'age', label: 'Age', description: 'Redact ages' },
  ]

  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())

  // Fetch current config on mount
  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/get-config')
      const data = await response.json()

      if (response.ok) {
        setPiiFields(data.pii_fields)
        // Parse comma-separated string into Set
        const fields = data.pii_fields.split(',').map((f: string) => f.trim()).filter(Boolean)
        setSelectedFields(new Set(fields))
      } else {
        setMessage({ type: 'error', text: 'Failed to load configuration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error loading configuration' })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleField = (field: string) => {
    const newSelected = new Set(selectedFields)

    // If selecting 'all', clear everything else and only keep 'all'
    if (field === 'all') {
      if (newSelected.has('all')) {
        newSelected.clear()
      } else {
        newSelected.clear()
        newSelected.add('all')
      }
    } else {
      // If selecting another field, remove 'all' if it's present
      newSelected.delete('all')

      if (newSelected.has(field)) {
        newSelected.delete(field)
      } else {
        newSelected.add(field)
      }
    }

    setSelectedFields(newSelected)
    setPiiFields(Array.from(newSelected).join(', '))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/update-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pii_fields: piiFields.trim() || 'all',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Configuration updated successfully! New uploads will use these settings.',
        })
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to update configuration',
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error updating configuration',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div className="flex items-center justify-center min-h-[400px]">
          <Text variant="muted">Loading configuration...</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl" padding="lg">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-midnight-blue hover:text-steel-gray transition-colors text-sm font-medium mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <Heading level={1} size="xl">
          PII Redaction Configuration
        </Heading>
        <Text variant="muted" className="mt-2">
          Configure which types of personally identifiable information (PII) should be redacted from transcripts
        </Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <Card variant="elevated" padding="lg">
            <Heading level={3} size="md" className="mb-4">
              Select PII Types to Redact
            </Heading>

            <div className="space-y-3">
              {piiOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start p-4 border border-gray-200 rounded-lg hover:border-midnight-blue hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(option.value)}
                    onChange={() => handleToggleField(option.value)}
                    className="mt-1 h-4 w-4 text-midnight-blue border-gray-300 rounded focus:ring-midnight-blue"
                  />
                  <div className="ml-3 flex-1">
                    <Text variant="emphasis" size="sm">
                      {option.label}
                    </Text>
                    <Text variant="muted" size="sm" className="mt-1">
                      {option.description}
                    </Text>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Text variant="muted" size="sm" className="uppercase tracking-wide mb-2">
                Current Config String
              </Text>
              <code className="block p-3 bg-charcoal text-success-gold rounded text-sm font-mono">
                {piiFields || 'all'}
              </code>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-md bg-midnight-blue px-6 py-3 text-pure-white hover:bg-steel-gray transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
              <button
                onClick={fetchConfig}
                disabled={saving}
                className="rounded-md border border-gray-300 px-6 py-3 text-charcoal hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
              >
                Reset
              </button>
            </div>

            {/* Message Display */}
            {message && (
              <div
                className={`mt-4 rounded-md p-4 ${
                  message.type === 'success'
                    ? 'bg-success-gold bg-opacity-10 border border-success-gold border-opacity-20'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <Text
                  variant={message.type === 'success' ? 'emphasis' : 'body'}
                  size="sm"
                  className={message.type === 'success' ? 'text-success-gold' : 'text-red-800'}
                >
                  {message.text}
                </Text>
              </div>
            )}
          </Card>
        </div>

        {/* Info Panel */}
        <div className="lg:col-span-1">
          <Card variant="outlined" padding="lg">
            <Heading level={3} size="md" className="mb-4">
              How It Works
            </Heading>

            <div className="space-y-4">
              <div>
                <Text variant="emphasis" size="sm" className="mb-1">
                  AssemblyAI Redaction
                </Text>
                <Text variant="muted" size="sm">
                  This configuration uses AssemblyAI&apos;s PII redaction to automatically identify and mask
                  sensitive information in transcripts.
                </Text>
              </div>

              <div>
                <Text variant="emphasis" size="sm" className="mb-1">
                  Applied to New Uploads
                </Text>
                <Text variant="muted" size="sm">
                  Changes to this configuration will only affect new audio files uploaded after saving.
                  Existing transcripts remain unchanged.
                </Text>
              </div>

              <div>
                <Text variant="emphasis" size="sm" className="mb-1">
                  &quot;All&quot; vs Specific
                </Text>
                <Text variant="muted" size="sm">
                  Selecting &quot;All PII Types&quot; applies comprehensive redaction. For more granular control,
                  choose specific PII types instead.
                </Text>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <Text variant="muted" size="sm">
                  <strong>Note:</strong> Some redaction types may have region-specific implementations.
                  Test with sample audio to verify expected results.
                </Text>
              </div>
            </div>
          </Card>

          <Card variant="default" padding="md" className="mt-4">
            <Text variant="muted" size="sm">
              <strong>Documentation:</strong>{' '}
              <a
                href="https://www.assemblyai.com/docs/api-reference/pii-redaction"
                target="_blank"
                rel="noopener noreferrer"
                className="text-midnight-blue hover:text-steel-gray underline"
              >
                AssemblyAI PII Redaction
              </a>
            </Text>
          </Card>
        </div>
      </div>
    </Container>
  )
}
