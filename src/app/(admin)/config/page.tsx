'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Salesperson {
  id: string
  name: string
  display_order: number
}

export default function ConfigPage() {
  // PII Config State
  const [piiFields, setPiiFields] = useState('')
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [savingPii, setSavingPii] = useState(false)
  const [piiMessage, setPiiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Salespeople State
  const [salespeople, setSalespeople] = useState<Salesperson[]>([])
  const [newSalespersonName, setNewSalespersonName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingSalespeople, setSavingSalespeople] = useState(false)
  const [salespeopleMessage, setSalespeopleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pii' | 'salespeople'>('salespeople')

  // PII Options
  const piiOptions = [
    { value: 'all', label: 'All PII Types', description: 'Comprehensive redaction for all supported PII' },
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

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch PII config
      const piiResponse = await fetch('/api/admin/get-config')
      const piiData = await piiResponse.json()
      if (piiResponse.ok) {
        setPiiFields(piiData.pii_fields)
        const fields = piiData.pii_fields.split(',').map((f: string) => f.trim()).filter(Boolean)
        setSelectedFields(new Set(fields))
      }

      // Fetch salespeople
      const spResponse = await fetch('/api/admin/salespeople')
      const spData = await spResponse.json()
      if (spData.salespeople) {
        setSalespeople(spData.salespeople)
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      setLoading(false)
    }
  }

  // PII Handlers
  const handleToggleField = (field: string) => {
    const newSelected = new Set(selectedFields)
    if (field === 'all') {
      if (newSelected.has('all')) {
        newSelected.clear()
      } else {
        newSelected.clear()
        newSelected.add('all')
      }
    } else {
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

  const handleSavePii = async () => {
    setSavingPii(true)
    setPiiMessage(null)
    try {
      const response = await fetch('/api/admin/update-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pii_fields: piiFields.trim() || 'all' }),
      })
      if (response.ok) {
        setPiiMessage({ type: 'success', text: 'PII configuration saved!' })
      } else {
        setPiiMessage({ type: 'error', text: 'Failed to save configuration' })
      }
    } catch {
      setPiiMessage({ type: 'error', text: 'Error saving configuration' })
    } finally {
      setSavingPii(false)
    }
  }

  // Salespeople Handlers
  const handleAddSalesperson = async () => {
    if (!newSalespersonName.trim()) return
    setSavingSalespeople(true)
    setSalespeopleMessage(null)
    try {
      const response = await fetch('/api/admin/salespeople', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSalespersonName.trim() }),
      })
      const data = await response.json()
      if (response.ok && data.salesperson) {
        setSalespeople([...salespeople, data.salesperson])
        setNewSalespersonName('')
        setSalespeopleMessage({ type: 'success', text: `Added ${data.salesperson.name}!` })
      } else {
        setSalespeopleMessage({ type: 'error', text: data.error || 'Failed to add salesperson' })
      }
    } catch {
      setSalespeopleMessage({ type: 'error', text: 'Error adding salesperson' })
    } finally {
      setSavingSalespeople(false)
    }
  }

  const handleUpdateSalesperson = async (id: string) => {
    if (!editingName.trim()) return
    setSavingSalespeople(true)
    setSalespeopleMessage(null)
    try {
      const response = await fetch(`/api/admin/salespeople/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      })
      const data = await response.json()
      if (response.ok && data.salesperson) {
        setSalespeople(salespeople.map(sp => sp.id === id ? data.salesperson : sp))
        setEditingId(null)
        setEditingName('')
        setSalespeopleMessage({ type: 'success', text: 'Name updated!' })
      } else {
        setSalespeopleMessage({ type: 'error', text: data.error || 'Failed to update' })
      }
    } catch {
      setSalespeopleMessage({ type: 'error', text: 'Error updating salesperson' })
    } finally {
      setSavingSalespeople(false)
    }
  }

  const handleDeleteSalesperson = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Their transcripts will be moved to Misc.`)) return
    setSavingSalespeople(true)
    setSalespeopleMessage(null)
    try {
      const response = await fetch(`/api/admin/salespeople/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setSalespeople(salespeople.filter(sp => sp.id !== id))
        setSalespeopleMessage({ type: 'success', text: `Deleted ${name}` })
      } else {
        const data = await response.json()
        setSalespeopleMessage({ type: 'error', text: data.error || 'Failed to delete' })
      }
    } catch {
      setSalespeopleMessage({ type: 'error', text: 'Error deleting salesperson' })
    } finally {
      setSavingSalespeople(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-200">Loading configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium mb-4 inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mt-4">Settings</h1>
          <p className="text-purple-200 mt-1">Configure salespeople and PII redaction settings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('salespeople')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              activeTab === 'salespeople'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                : 'bg-white/10 text-purple-200 hover:bg-white/20 border border-white/10'
            }`}
          >
            Salespeople
          </button>
          <button
            onClick={() => setActiveTab('pii')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              activeTab === 'pii'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                : 'bg-white/10 text-purple-200 hover:bg-white/20 border border-white/10'
            }`}
          >
            PII Redaction
          </button>
        </div>

        {/* Salespeople Tab */}
        {activeTab === 'salespeople' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Manage Salespeople</h2>
            <p className="text-purple-200 text-sm mb-6">
              Add, edit, or remove salespeople. Uploaded recordings are organized by salesperson.
            </p>

            {/* Add New Salesperson */}
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={newSalespersonName}
                onChange={(e) => setNewSalespersonName(e.target.value)}
                placeholder="Enter name..."
                className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSalesperson()}
              />
              <button
                onClick={handleAddSalesperson}
                disabled={savingSalespeople || !newSalespersonName.trim()}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/25"
              >
                Add
              </button>
            </div>

            {/* Salespeople List */}
            <div className="space-y-2">
              {salespeople.map((sp) => (
                <div
                  key={sp.id}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
                    sp.name === 'Misc'
                      ? 'bg-white/5 border border-white/10'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
                    {sp.name.charAt(0).toUpperCase()}
                  </div>

                  {editingId === sp.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateSalesperson(sp.id)}
                      />
                      <button
                        onClick={() => handleUpdateSalesperson(sp.id)}
                        disabled={savingSalespeople}
                        className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditingName('') }}
                        className="px-4 py-2 bg-white/10 text-purple-300 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-white font-medium">{sp.name}</span>
                      {sp.name !== 'Misc' && (
                        <>
                          <button
                            onClick={() => { setEditingId(sp.id); setEditingName(sp.name) }}
                            className="px-4 py-2 bg-white/10 text-purple-300 rounded-lg hover:bg-white/20 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSalesperson(sp.id, sp.name)}
                            disabled={savingSalespeople}
                            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {sp.name === 'Misc' && (
                        <span className="text-purple-400 text-sm italic">System category</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Message */}
            {salespeopleMessage && (
              <div className={`mt-4 p-4 rounded-xl ${
                salespeopleMessage.type === 'success'
                  ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                  : 'bg-red-500/20 border border-red-500/30 text-red-300'
              }`}>
                {salespeopleMessage.text}
              </div>
            )}
          </div>
        )}

        {/* PII Redaction Tab */}
        {activeTab === 'pii' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6">
            <h2 className="text-xl font-bold text-white mb-4">PII Redaction Settings</h2>
            <p className="text-purple-200 text-sm mb-6">
              Select which types of personally identifiable information should be redacted from transcripts.
            </p>

            <div className="space-y-2">
              {piiOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedFields.has(option.value)
                      ? 'bg-purple-500/20 border-purple-500/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(option.value)}
                    onChange={() => handleToggleField(option.value)}
                    className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="ml-3 flex-1">
                    <span className="text-white font-medium text-sm">{option.label}</span>
                    <p className="text-purple-300 text-sm mt-0.5">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Current Config */}
            <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-purple-300 text-xs uppercase tracking-wide mb-2">Current Config</p>
              <code className="block p-3 bg-slate-800 text-purple-400 rounded-lg text-sm font-mono">
                {piiFields || 'all'}
              </code>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSavePii}
                disabled={savingPii}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/25"
              >
                {savingPii ? 'Saving...' : 'Save Configuration'}
              </button>
              <button
                onClick={fetchData}
                disabled={savingPii}
                className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors border border-white/20"
              >
                Reset
              </button>
            </div>

            {/* Message */}
            {piiMessage && (
              <div className={`mt-4 p-4 rounded-xl ${
                piiMessage.type === 'success'
                  ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                  : 'bg-red-500/20 border border-red-500/30 text-red-300'
              }`}>
                {piiMessage.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
