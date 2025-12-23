import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { NextResponse } from 'next/server';

// GET orphaned users (auth users without profiles)
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

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role to get all auth users
    const serviceSupabase = createServiceRoleClient();
    const { data: authUsers, error: authError } = await serviceSupabase.auth.admin.listUsers();

    if (authError) {
      throw authError;
    }

    // Get all profiles
    const { data: profiles, error: profileError } = await serviceSupabase
      .from('user_profiles')
      .select('id, email');

    if (profileError) {
      throw profileError;
    }

    // Find orphaned users (in auth but not in profiles)
    const profileIds = new Set(profiles?.map(p => p.id) || []);
    const orphanedUsers = authUsers.users.filter(u => !profileIds.has(u.id));

    return NextResponse.json({
      orphanedUsers: orphanedUsers.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
      })),
      count: orphanedUsers.length,
    });
  } catch (error: any) {
    console.error('Error checking orphaned users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE orphaned users
export async function DELETE() {
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

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role to get all auth users
    const serviceSupabase = createServiceRoleClient();
    const { data: authUsers, error: authError } = await serviceSupabase.auth.admin.listUsers();

    if (authError) {
      throw authError;
    }

    // Get all profiles
    const { data: profiles, error: profileError } = await serviceSupabase
      .from('user_profiles')
      .select('id');

    if (profileError) {
      throw profileError;
    }

    // Find orphaned users
    const profileIds = new Set(profiles?.map(p => p.id) || []);
    const orphanedUsers = authUsers.users.filter(u => !profileIds.has(u.id));

    // Delete orphaned users
    const deletedUsers = [];
    const errors = [];

    for (const orphanedUser of orphanedUsers) {
      try {
        await serviceSupabase.auth.admin.deleteUser(orphanedUser.id);
        deletedUsers.push({
          id: orphanedUser.id,
          email: orphanedUser.email,
        });
      } catch (deleteError: any) {
        errors.push({
          id: orphanedUser.id,
          email: orphanedUser.email,
          error: deleteError.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedUsers,
      deletedCount: deletedUsers.length,
      errors: errors,
      message: `Successfully deleted ${deletedUsers.length} orphaned user(s)`,
    });
  } catch (error: any) {
    console.error('Error cleaning up orphaned users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
