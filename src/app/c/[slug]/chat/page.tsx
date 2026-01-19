import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ChatLayout } from '@/components/chat/ChatLayout'

export default async function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/c/${slug}/login`)
  }

  // Get user's profile and company
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, company_id, companies!inner(id, name, slug)')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  // Verify user belongs to this company (unless super_admin)
  const userCompanySlug = (profile.companies as any).slug
  if (profile.role !== 'super_admin' && userCompanySlug !== slug) {
    redirect(`/c/${userCompanySlug}/dashboard`)
  }

  const companyId = profile.company_id

  return (
    <div className="h-screen">
      <ChatLayout companyId={companyId} />
    </div>
  )
}
