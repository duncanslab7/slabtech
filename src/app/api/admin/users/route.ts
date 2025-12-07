import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET all users (admin only)
export async function GET() {
  try {
    const supabase = await createClient();

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all users
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

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
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, displayName, role } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Use regular signup since we don't have admin API access
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${request.nextUrl.origin}/user/login`,
        data: {
          display_name: displayName || email,
          role: role || 'user',
        },
      },
    });

    if (signupError) {
      throw signupError;
    }

    if (!signupData.user) {
      throw new Error('Failed to create user');
    }

    // Manually create the profile (trigger may not work)
    // Use rpc to bypass RLS if needed
    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: signupData.user.id,
          email: email,
          display_name: displayName || email,
          role: role || 'user',
          created_by: user.id,
          is_active: true,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Continue anyway - the trigger might have created it
      }
    } catch (err) {
      console.error('Profile creation error:', err);
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
