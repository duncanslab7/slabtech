import { createClient } from '@/utils/supabase/server'
import InviteAcceptForm from './InviteAcceptForm'

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = await createClient()

  // Fetch invite with company details
  const { data: invite } = await supabase
    .from('company_invites')
    .select('*, companies!inner(name, slug, logo_url, primary_color, secondary_color)')
    .eq('token', params.token)
    .eq('accepted', false)
    .single()

  // Invite not found or already accepted
  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#000033] via-[#001199] to-[#0a1a5f]">
        <div className="max-w-md w-full bg-[#001155]/80 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Invite Not Found</h1>
          <p className="text-gray-400">
            This invite link is invalid or has already been used.
          </p>
        </div>
      </div>
    )
  }

  // Check if invite has expired
  const expiresAt = new Date(invite.expires_at)
  const now = new Date()

  if (expiresAt < now) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#000033] via-[#001199] to-[#0a1a5f]">
        <div className="max-w-md w-full bg-[#001155]/80 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-white mb-2">Invite Expired</h1>
          <p className="text-gray-400">This invite link has expired. Please request a new invite.</p>
        </div>
      </div>
    )
  }

  return <InviteAcceptForm invite={invite} />
}
