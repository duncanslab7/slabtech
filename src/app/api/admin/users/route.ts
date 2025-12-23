import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { NextRequest, NextResponse } from 'next/server';

// GET all users (admin only)
export async function GET() {
  try {
    const supabase = await createClient();

    // Verify admin using regular client (can read own profile)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!['super_admin', 'company_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role client to fetch users
    const serviceSupabase = createServiceRoleClient();

    // Super admins can see all users, company admins see only their company's users
    let query = serviceSupabase.from('user_profiles').select('*');

    if (profile.role === 'company_admin') {
      query = query.eq('company_id', profile.company_id);
    }

    const { data: users, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!['super_admin', 'company_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, displayName, role, companyId } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Determine which company to assign user to
    let targetCompanyId = companyId || profile.company_id;

    // Company admins can only create users in their own company
    if (profile.role === 'company_admin' && companyId && companyId !== profile.company_id) {
      return NextResponse.json({ error: 'Company admins can only create users in their own company' }, { status: 403 });
    }

    // Use service role client to create user (bypasses email confirmation)
    // Note: The database trigger 'handle_new_user' will automatically create the user_profile
    const serviceSupabase = createServiceRoleClient();
    const { data: signupData, error: signupError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        display_name: displayName || email,
        role: role || 'user',
        company_id: targetCompanyId,
      },
    });

    if (signupError) {
      throw signupError;
    }

    if (!signupData.user) {
      throw new Error('Failed to create user');
    }

    // Wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify the profile was created by the trigger
    const { data: profileCheck, error: profileCheckError } = await serviceSupabase
      .from('user_profiles')
      .select('id, email, role, company_id')
      .eq('id', signupData.user.id)
      .single();

    if (profileCheckError || !profileCheck) {
      // If profile wasn't created, clean up the auth user
      try {
        await serviceSupabase.auth.admin.deleteUser(signupData.user.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup user after profile creation failure:', cleanupError);
      }
      throw new Error('Profile was not created automatically. Please check database triggers.');
    }

    // Update profile with company_id if not set by trigger
    if (!profileCheck.company_id && targetCompanyId) {
      await serviceSupabase
        .from('user_profiles')
        .update({ company_id: targetCompanyId })
        .eq('id', signupData.user.id);
    }

    return NextResponse.json({
      success: true,
      user: signupData.user,
      message: 'User created successfully. They may need to confirm their email.',
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
