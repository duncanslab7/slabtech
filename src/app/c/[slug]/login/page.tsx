import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import CompanyLoginForm from './CompanyLoginForm'

export default async function CompanyLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch company data
  const { data: company } = await supabase
    .from('companies')
    .select('name, slug, logo_url, primary_color, secondary_color')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#000033] via-[#001199] to-[#0a1a5f]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Company Not Found</h1>
          <p className="text-gray-400">The company you're looking for doesn't exist or has been deactivated.</p>
        </div>
      </div>
    )
  }

  // Check if already logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // Already authenticated, redirect to dashboard
    redirect(`/c/${slug}/dashboard`)
  }

  return <CompanyLoginForm company={company} />
}
