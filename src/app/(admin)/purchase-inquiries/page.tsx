'use client'

import { useEffect, useState } from 'react'
import { Heading, Text, Container } from '@/components'
import Link from 'next/link'

interface PurchaseInquiry {
  id: string
  created_at: string
  product_type: 'hoodie' | 'individual' | 'company'
  name: string
  email: string
  phone: string
  industry?: string
  payment_plan?: string
  custom_data?: any
  message?: string
  status: 'pending' | 'contacted' | 'completed' | 'cancelled'
}

export default function PurchaseInquiriesPage() {
  const [inquiries, setInquiries] = useState<PurchaseInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'hoodie' | 'individual' | 'company'>('all')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  useEffect(() => {
    fetchInquiries()
  }, [])

  const fetchInquiries = async () => {
    try {
      const response = await fetch('/api/purchase-inquiry')
      if (!response.ok) {
        throw new Error('Failed to fetch inquiries')
      }
      const data = await response.json()
      setInquiries(data.inquiries || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (inquiryId: string, newStatus: string) => {
    setUpdatingStatus(inquiryId)
    try {
      const response = await fetch(`/api/purchase-inquiry/${inquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      // Update local state
      setInquiries(prev =>
        prev.map(inq =>
          inq.id === inquiryId
            ? { ...inq, status: newStatus as any }
            : inq
        )
      )
    } catch (err) {
      alert('Failed to update status: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setUpdatingStatus(null)
    }
  }

  const filteredInquiries = filter === 'all'
    ? inquiries
    : inquiries.filter(inq => inq.product_type === filter)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'contacted': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case 'hoodie': return 'Custom Hoodie'
      case 'individual': return 'Individual Access'
      case 'company': return 'Company Access'
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Container maxWidth="xl" padding="lg">
          <div className="flex items-center justify-center h-64">
            <Text>Loading inquiries...</Text>
          </div>
        </Container>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Container maxWidth="xl" padding="lg">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <Text className="text-red-800">Error: {error}</Text>
          </div>
        </Container>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Container maxWidth="xl" padding="lg">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Heading level={1} size="xl" className="text-gray-900">
              Purchase Inquiries
            </Heading>
            <Text variant="muted" className="mt-2 text-gray-600">
              View and manage customer purchase requests
            </Text>
          </div>
          <Link
            href="/admin"
            className="text-success-gold hover:text-success-gold-dark transition-colors"
          >
            ← Back to Admin
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-4">
            {['all', 'hoodie', 'individual', 'company'].map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === filterOption
                    ? 'bg-success-gold text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                {filterOption !== 'all' && (
                  <span className="ml-2 text-sm">
                    ({inquiries.filter(inq => inq.product_type === filterOption).length})
                  </span>
                )}
                {filterOption === 'all' && (
                  <span className="ml-2 text-sm">
                    ({inquiries.length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Inquiries List */}
        {filteredInquiries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Text variant="muted" className="text-gray-600">
              No inquiries found
            </Text>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInquiries.map((inquiry) => (
              <div
                key={inquiry.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Heading level={3} size="md" className="text-gray-900">
                        {inquiry.name}
                      </Heading>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(inquiry.status)}`}>
                        {inquiry.status}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {getProductTypeLabel(inquiry.product_type)}
                      </span>
                    </div>
                    <Text size="sm" variant="muted" className="text-gray-500">
                      {new Date(inquiry.created_at).toLocaleString()}
                    </Text>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Text size="sm" className="text-gray-600 font-medium mb-1">Email</Text>
                    <a
                      href={`mailto:${inquiry.email}`}
                      className="text-success-gold hover:underline text-sm"
                    >
                      {inquiry.email}
                    </a>
                  </div>
                  <div>
                    <Text size="sm" className="text-gray-600 font-medium mb-1">Phone</Text>
                    <a
                      href={`tel:${inquiry.phone}`}
                      className="text-success-gold hover:underline text-sm"
                    >
                      {inquiry.phone}
                    </a>
                  </div>

                  {inquiry.industry && (
                    <div>
                      <Text size="sm" className="text-gray-600 font-medium mb-1">Industry</Text>
                      <Text size="sm" className="text-gray-900">{inquiry.industry}</Text>
                    </div>
                  )}

                  {inquiry.payment_plan && (
                    <div>
                      <Text size="sm" className="text-gray-600 font-medium mb-1">Payment Plan</Text>
                      <Text size="sm" className="text-gray-900">
                        {inquiry.payment_plan === 'summer' ? '$500 for the summer' : '$100/month'}
                      </Text>
                    </div>
                  )}
                </div>

                {inquiry.custom_data && (
                  <div className="mb-4">
                    <Text size="sm" className="text-gray-600 font-medium mb-2">Custom Design</Text>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <Text size="sm" className="text-gray-900">
                        <strong>Hoodie Color:</strong> {inquiry.custom_data.hoodieColor}
                      </Text>
                      {inquiry.custom_data.logos && inquiry.custom_data.logos.length > 0 && (
                        <div className="mt-2">
                          <Text size="sm" className="text-gray-900 font-medium mb-1">Logos:</Text>
                          <ul className="list-disc list-inside space-y-1">
                            {inquiry.custom_data.logos.map((logo: any, idx: number) => (
                              <li key={idx} className="text-sm text-gray-700">
                                {logo.color} on {logo.position}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {inquiry.message && (
                  <div className="mb-4">
                    <Text size="sm" className="text-gray-600 font-medium mb-2">Message</Text>
                    <Text size="sm" className="text-gray-900 bg-gray-50 rounded-lg p-3">
                      {inquiry.message}
                    </Text>
                  </div>
                )}

                {/* Status Update Actions */}
                <div className="pt-4 border-t border-gray-200">
                  <Text size="sm" className="text-gray-600 font-medium mb-3">Update Status</Text>
                  <div className="flex gap-2 flex-wrap">
                    {['pending', 'contacted', 'completed', 'cancelled'].map((status) => (
                      <button
                        key={status}
                        onClick={() => updateStatus(inquiry.id, status)}
                        disabled={updatingStatus === inquiry.id || inquiry.status === status}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          inquiry.status === status
                            ? 'bg-success-gold text-white cursor-default'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {updatingStatus === inquiry.id ? 'Updating...' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </div>
  )
}
