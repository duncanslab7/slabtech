import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Company routes (/c/[slug]/...) require auth and company membership
  if (request.nextUrl.pathname.startsWith('/c/')) {
    const pathParts = request.nextUrl.pathname.split('/')
    const companySlug = pathParts[2]

    // If not logged in, redirect to company login
    if (!user) {
      return NextResponse.redirect(new URL(`/c/${companySlug}/login`, request.url))
    }

    // Verify user belongs to this company (unless super admin)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, company_id, companies!inner(slug)')
      .eq('id', user.id)
      .single()

    // Super admins can access any company
    if (profile?.role === 'super_admin') {
      return supabaseResponse
    }

    // Check if user's company matches the URL company slug
    if (profile?.companies?.[0]?.slug !== companySlug) {
      // Redirect to user's own company
      return NextResponse.redirect(new URL(`/c/${profile?.companies?.[0]?.slug}/dashboard`, request.url))
    }
  }

  // Admin routes (/admin, /dashboard, /users, etc.) - only for super admins and company admins
  if (request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/users') ||
      request.nextUrl.pathname.startsWith('/config') ||
      request.nextUrl.pathname.startsWith('/transcripts')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, companies!inner(slug)')
      .eq('id', user.id)
      .single()

    // Only super_admins can access admin routes
    if (profile?.role !== 'super_admin') {
      // Regular users and company admins go to their company dashboard
      return NextResponse.redirect(new URL(`/c/${profile?.companies?.[0]?.slug}/dashboard`, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/c/:path*',
    '/admin/:path*',
    '/dashboard/:path*',
    '/users/:path*',
    '/config/:path*',
    '/transcripts/:path*',
    '/((?!_next/static|_next/image|favicon.ico|api/process-audio|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)',
  ],
}
