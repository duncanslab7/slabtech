'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';

// Force dynamic rendering to prevent static export issues
export const dynamic = 'force-dynamic'

export default function UserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      if (data.user) {
        // Log the login for tracking
        await fetch('/api/auth/log-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        // Check user role and redirect accordingly
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, companies!inner(slug)')
          .eq('id', data.user.id)
          .single();

        if (profile?.role === 'super_admin') {
          // Redirect super admin users to admin dashboard
          router.push('/admin');
        } else if (profile?.role === 'company_admin' || profile?.role === 'user') {
          // Redirect company users to their company dashboard
          router.push(`/c/${(profile.companies as any)?.slug}/dashboard`);
        } else {
          // Fallback for legacy users
          router.push('/user/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#000033] via-[#001199] to-[#0a1a5f] flex flex-col relative overflow-hidden">
      {/* Grain overlay for texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-50 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      />

      {/* Header with Logo */}
      <header className="w-full py-6 flex justify-center border-b-2 relative z-10" style={{ borderColor: 'rgba(243, 156, 18, 0.3)' }}>
        <Link href="/">
          <Image
            src="/slab-logo-thermal.png"
            alt="SLAB"
            width={100}
            height={100}
            className="h-[100px] w-auto cursor-pointer hover:scale-110 transition-transform"
            style={{
              filter: 'drop-shadow(0 0 20px rgba(255, 140, 0, 0.8)) drop-shadow(0 0 40px rgba(255, 120, 0, 0.6))',
            }}
            priority
          />
        </Link>
      </header>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-[#001155]/80 rounded-lg p-8 border-2 backdrop-blur-sm" style={{
            borderColor: 'rgba(243, 156, 18, 0.3)',
            boxShadow: '0 0 30px rgba(255, 140, 0, 0.2), 0 0 60px rgba(255, 120, 0, 0.1)',
          }}>
            <h1 className="text-3xl font-bold text-center mb-8" style={{
              color: '#f39c12',
              textShadow: '0 0 20px rgba(255, 140, 0, 1), 0 0 40px rgba(255, 140, 0, 0.8)',
            }}>
              User Login
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2"
                  style={{ color: '#f39c12' }}
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-md focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: 'rgba(0, 17, 85, 0.6)',
                    border: '1px solid rgba(243, 156, 18, 0.3)',
                    color: '#fff',
                  }}
                  placeholder="you@example.com"
                />
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-2"
                  style={{ color: '#f39c12' }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-md focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: 'rgba(0, 17, 85, 0.6)',
                    border: '1px solid rgba(243, 156, 18, 0.3)',
                    color: '#fff',
                  }}
                  placeholder="••••••••"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="px-4 py-3 rounded-lg text-sm" style={{
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  color: '#fca5a5',
                }}>
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{
                  backgroundColor: '#f39c12',
                  color: '#000',
                  boxShadow: '0 0 20px rgba(255, 140, 0, 0.4), 0 0 40px rgba(255, 120, 0, 0.2)',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Back Link */}
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-sm transition-colors"
                style={{ color: '#f39c12' }}
              >
                &larr; Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
