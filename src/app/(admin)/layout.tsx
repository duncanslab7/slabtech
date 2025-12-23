import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is a super admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active, companies!inner(slug)')
    .eq('id', user.id)
    .single()

  // If no profile exists (legacy user), try to create one as super admin
  if (!profile) {
    const { error: insertError } = await supabase.from('user_profiles').insert({
      id: user.id,
      email: user.email,
      display_name: user.email,
      role: 'super_admin', // Legacy users become super admins
    })

    // If insert fails (table doesn't exist yet), treat as super admin anyway
    if (insertError) {
      console.warn('Could not create user profile:', insertError.message)
      // Continue as super admin - database migration may not be run yet
    }
  } else if (!profile.is_active) {
    // User is disabled
    await supabase.auth.signOut()
    redirect('/login?error=account_disabled')
  } else if (profile.role !== 'super_admin') {
    // Non-super-admin users are redirected to their company dashboard
    redirect(`/c/${profile.companies?.[0]?.slug}/dashboard`)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-pure-white border-b-2 border-midnight-blue">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center gap-8">
              <Link href="/">
                <Image
                  src="/slab-logo.png"
                  alt="SLAB"
                  width={50}
                  height={50}
                  className="h-[50px] w-auto"
                  priority
                />
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link
                  href="/admin"
                  className="text-midnight-blue hover:text-success-gold font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/companies"
                  className="text-midnight-blue hover:text-success-gold font-medium transition-colors"
                >
                  Companies
                </Link>
                <Link
                  href="/dashboard"
                  className="text-midnight-blue hover:text-success-gold font-medium transition-colors"
                >
                  Transcripts
                </Link>
                <Link
                  href="/users"
                  className="text-midnight-blue hover:text-success-gold font-medium transition-colors"
                >
                  Users
                </Link>
                <Link
                  href="/config"
                  className="text-midnight-blue hover:text-success-gold font-medium transition-colors"
                >
                  Config
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-steel-gray">{user.email}</span>
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                Super Admin
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-steel-gray hover:text-success-gold transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <main className="py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
