import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/company/users - Create new user (company admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is company admin or super admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, company_id, companies!inner(account_limit)')
      .eq('id', user.id)
      .single()

    if (!profile || !['company_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, display_name, company_id } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const targetCompanyId = company_id || profile.company_id

    // Check account limit
    if (profile.companies?.[0]?.account_limit) {
      const { count } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', targetCompanyId)
        .eq('is_active', true)

      if (count && count >= profile.companies[0].account_limit) {
        return NextResponse.json({
          error: `Account limit reached (${profile.companies[0].account_limit} users)`
        }, { status: 400 })
      }
    }

    // Create user using service role
    const serviceSupabase = createServiceRoleClient()
    const { data: newUser, error: createError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500))

    // Update the profile with company_id and display_name
    const { error: updateError } = await serviceSupabase
      .from('user_profiles')
      .update({
        company_id: targetCompanyId,
        display_name: display_name || null,
      })
      .eq('id', newUser.user.id)

    if (updateError) {
      console.error('Error updating user profile:', updateError)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
      }
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
