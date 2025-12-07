import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request headers for logging
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const userAgent = headersList.get('user-agent');

    // Determine the IP address
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

    // Log the login
    const { error: logError } = await supabase.from('login_logs').insert({
      user_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent || 'unknown',
    });

    if (logError) {
      console.error('Error logging login:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login logging error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
