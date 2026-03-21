'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Award { id?: string; title: string; year: number }
interface Member {
  id: string
  name: string
  bio: string | null
  instagram_handle: string | null
  profile_picture_url: string | null
  background_picture_url: string | null
  field_company_logo_url: string | null
  best_day: number
  best_summer: number
  best_week: number
  retention_percentage: number
  is_active: boolean
  display_order: number
  big_five_awards: Award[]
  big_five_transcript_links: { id: string; salesperson_name: string }[]
}

const EMPTY_FORM = {
  name: '',
  bio: '',
  instagram_handle: '',
  best_day: 0,
  best_summer: 0,
  best_week: 0,
  retention_percentage: 0,
  is_active: true,
  display_order: 0,
  awards: [] as Award[],
  transcript_links: [] as string[],
}

export default function BigFiveAdminPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  // Award editing
  const [newAwardTitle, setNewAwardTitle] = useState('')
  const [newAwardYear, setNewAwardYear] = useState(new Date().getFullYear())

  // Transcript link editing
  const [newLinkName, setNewLinkName] = useState('')

  // Image upload
  const profileInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)
  const [uploadingProfile, setUploadingProfile] = useState<string | null>(null)
  const [uploadingBg, setUploadingBg] = useState<string | null>(null)
  const [uploadingFieldLogo, setUploadingFieldLogo] = useState<string | null>(null)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/big-five')
      const data = await res.json()
      setMembers(data.members || [])
    } catch {
      setMessage({ type: 'error', text: 'Failed to load members' })
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    setShowModal(true)
  }

  function openEdit(m: Member) {
    setForm({
      name: m.name,
      bio: m.bio || '',
      instagram_handle: m.instagram_handle || '',
      best_day: m.best_day,
      best_summer: m.best_summer,
      best_week: m.best_week,
      retention_percentage: m.retention_percentage,
      is_active: m.is_active,
      display_order: m.display_order,
      awards: m.big_five_awards.map(a => ({ id: a.id, title: a.title, year: a.year })),
      transcript_links: m.big_five_transcript_links.map(l => l.salesperson_name),
    })
    setEditingId(m.id)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setMessage({ type: 'error', text: 'Name is required' }); return }
    setSaving(true)
    setMessage(null)
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/big-five/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      } else {
        const res = await fetch('/api/admin/big-five', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      }
      setShowModal(false)
      setMessage({ type: 'success', text: editingId ? 'Member updated.' : 'Member created.' })
      await fetchMembers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/big-five/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setDeleteConfirmId(null)
      setMessage({ type: 'success', text: 'Member deleted.' })
      await fetchMembers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadPicture(memberId: string, type: 'profile' | 'background' | 'field_logo', file: File) {
    const setter = type === 'profile' ? setUploadingProfile : type === 'background' ? setUploadingBg : setUploadingFieldLogo
    setter(memberId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const res = await fetch(`/api/admin/big-five/${memberId}/upload-picture`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const label = type === 'profile' ? 'Profile picture' : type === 'background' ? 'Background picture' : 'Field company logo'
      setMessage({ type: 'success', text: `${label} updated.` })
      await fetchMembers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setter(null)
    }
  }

  function addAward() {
    if (!newAwardTitle.trim()) return
    setForm(f => ({ ...f, awards: [...f.awards, { title: newAwardTitle.trim(), year: newAwardYear }] }))
    setNewAwardTitle('')
  }

  function removeAward(i: number) {
    setForm(f => ({ ...f, awards: f.awards.filter((_, idx) => idx !== i) }))
  }

  function addLink() {
    if (!newLinkName.trim() || form.transcript_links.includes(newLinkName.trim())) return
    setForm(f => ({ ...f, transcript_links: [...f.transcript_links, newLinkName.trim()] }))
    setNewLinkName('')
  }

  function removeLink(name: string) {
    setForm(f => ({ ...f, transcript_links: f.transcript_links.filter(l => l !== name) }))
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-midnight-blue">The Big Five</h1>
          <p className="text-steel-gray mt-1">Manage Big Five member profiles, stats, and awards</p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 bg-success-gold text-white font-semibold rounded-lg hover:bg-amber-500 transition-colors"
        >
          + Add Member
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
          <button className="ml-4 underline text-sm" onClick={() => setMessage(null)}>Dismiss</button>
        </div>
      )}

      {/* Members grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-10 w-10 rounded-full border-4 border-success-gold border-t-transparent" />
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <p className="text-steel-gray text-lg">No Big Five members yet.</p>
          <p className="text-steel-gray text-sm mt-2">Click "Add Member" to create the first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {members.map(m => (
            <div key={m.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              {/* Background picture */}
              <div className="relative h-32 bg-gradient-to-br from-midnight-blue to-slate-700">
                {m.background_picture_url && (
                  <img src={m.background_picture_url} alt="" className="w-full h-full object-cover" />
                )}
                <label className="absolute bottom-2 right-2 cursor-pointer bg-black/50 text-white text-xs px-2 py-1 rounded hover:bg-black/70 transition-colors">
                  {uploadingBg === m.id ? 'Uploading…' : '📷 Background'}
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handleUploadPicture(m.id, 'background', e.target.files[0])}
                  />
                </label>

                {/* Active badge */}
                <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                  m.is_active ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
                }`}>
                  {m.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Profile pic + info */}
              <div className="px-5 pb-5">
                <div className="flex items-end gap-4 -mt-10 mb-3">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-white shadow overflow-hidden bg-success-gold flex items-center justify-center">
                      {m.profile_picture_url
                        ? <img src={m.profile_picture_url} alt={m.name} className="w-full h-full object-cover" />
                        : <span className="text-2xl font-bold text-white">{m.name.charAt(0)}</span>
                      }
                    </div>
                    <label className="absolute -bottom-1 -right-1 cursor-pointer bg-midnight-blue text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-slate-600 transition-colors shadow">
                      {uploadingProfile === m.id ? '…' : '✏️'}
                      <input
                        type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && handleUploadPicture(m.id, 'profile', e.target.files[0])}
                      />
                    </label>
                  </div>
                  <div className="flex-1 min-w-0 pt-10">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-midnight-blue truncate">{m.name}</h2>
                      {/* Field company logo */}
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-full border-2 border-amber-300 overflow-hidden bg-amber-50 flex items-center justify-center">
                          {m.field_company_logo_url
                            ? <img src={m.field_company_logo_url} alt="Field co." className="w-full h-full object-cover" />
                            : <span className="text-xs text-amber-400">?</span>
                          }
                        </div>
                        <label className="absolute -bottom-1 -right-1 cursor-pointer bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-amber-600 transition-colors shadow" title="Upload field company logo">
                          {uploadingFieldLogo === m.id ? '…' : '+'}
                          <input
                            type="file" accept="image/*" className="hidden"
                            onChange={e => e.target.files?.[0] && handleUploadPicture(m.id, 'field_logo', e.target.files[0])}
                          />
                        </label>
                      </div>
                    </div>
                    {m.instagram_handle && (
                      <p className="text-sm text-steel-gray">@{m.instagram_handle}</p>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Best Day', value: m.best_day },
                    { label: 'Best Summer', value: m.best_summer },
                    { label: 'Best Week', value: m.best_week },
                  ].map(stat => (
                    <div key={stat.label} className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-xl font-bold text-success-gold">{stat.value}</div>
                      <div className="text-xs text-steel-gray">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm text-steel-gray mb-4">
                  <span>Retention: <strong className="text-midnight-blue">{m.retention_percentage}%</strong></span>
                  <span>{m.big_five_awards.length} award{m.big_five_awards.length !== 1 ? 's' : ''}</span>
                  <span>{m.big_five_transcript_links.length} name{m.big_five_transcript_links.length !== 1 ? 's' : ''} linked</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(m)}
                    className="flex-1 py-2 bg-midnight-blue text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(m.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-midnight-blue">
                {editingId ? 'Edit Member' : 'Add Member'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-midnight-blue mb-1">Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-success-gold focus:border-transparent"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-midnight-blue mb-1">Instagram Handle</label>
                  <input
                    value={form.instagram_handle}
                    onChange={e => setForm(f => ({ ...f, instagram_handle: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-success-gold focus:border-transparent"
                    placeholder="username (no @)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-midnight-blue mb-1">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-success-gold focus:border-transparent resize-none"
                  placeholder="Short bio..."
                />
              </div>

              {/* Stats */}
              <div>
                <label className="block text-sm font-medium text-midnight-blue mb-2">Sales Stats</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'best_day', label: 'Best Day' },
                    { key: 'best_summer', label: 'Best Summer' },
                    { key: 'best_week', label: 'Best Week' },
                    { key: 'retention_percentage', label: 'Retention %' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-steel-gray mb-1">{label}</label>
                      <input
                        type="number"
                        value={(form as any)[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-success-gold focus:border-transparent"
                        min="0"
                        step={key === 'retention_percentage' ? '0.1' : '1'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Display order + active */}
              <div className="flex items-center gap-6">
                <div>
                  <label className="block text-sm font-medium text-midnight-blue mb-1">Display Order</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-success-gold focus:border-transparent"
                    min="0"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-5">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 accent-success-gold"
                  />
                  <span className="text-sm font-medium text-midnight-blue">Active (visible to users)</span>
                </label>
              </div>

              {/* Awards */}
              <div>
                <label className="block text-sm font-medium text-midnight-blue mb-2">Awards</label>
                <div className="space-y-2 mb-2">
                  {form.awards.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <span className="flex-1 text-sm font-medium">{a.title} <span className="text-steel-gray font-normal">({a.year})</span></span>
                      <button onClick={() => removeAward(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newAwardTitle}
                    onChange={e => setNewAwardTitle(e.target.value)}
                    placeholder="Award title (e.g. Golden Door)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-success-gold focus:border-transparent"
                  />
                  <input
                    type="number"
                    value={newAwardYear}
                    onChange={e => setNewAwardYear(parseInt(e.target.value))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-success-gold focus:border-transparent"
                  />
                  <button
                    onClick={addAward}
                    className="px-3 py-2 bg-success-gold text-white text-sm font-semibold rounded-lg hover:bg-amber-500 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Transcript links */}
              <div>
                <label className="block text-sm font-medium text-midnight-blue mb-1">
                  Linked Salesperson Names
                  <span className="ml-1 text-xs font-normal text-steel-gray">(matches recordings to this member)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.transcript_links.map(name => (
                    <span key={name} className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-full px-3 py-1">
                      {name}
                      <button onClick={() => removeLink(name)} className="text-blue-400 hover:text-blue-600 ml-1">&times;</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newLinkName}
                    onChange={e => setNewLinkName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addLink()}
                    placeholder="e.g. Rylan Gebaeur"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-success-gold focus:border-transparent"
                  />
                  <button
                    onClick={addLink}
                    className="px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Link
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-success-gold text-white font-semibold rounded-lg hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-midnight-blue mb-2">Delete Member?</h3>
            <p className="text-steel-gray text-sm mb-5">This will permanently delete the member, all their awards, and transcript links. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={saving}
                className="flex-1 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
