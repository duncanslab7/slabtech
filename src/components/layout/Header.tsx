'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export const Header = () => {
  const pathname = usePathname();

  // Don't show header on these pages (they have their own headers)
  const hideHeaderPaths = ['/', '/login', '/user/login', '/user/dashboard'];
  if (hideHeaderPaths.includes(pathname)) {
    return null;
  }

  return (
    <header className="bg-gradient-to-r from-thermal-deep via-thermal-dark to-thermal-deep border-b-2 border-thermal-orange/30 shadow-lg">
      <nav className="max-w-[800px] mx-auto px-6 py-1">
        <div className="flex items-center justify-between">
          {/* Logo - serves as home button */}
          <Link href="/" className="flex items-center">
            <Image
              src="/slab-logo.png"
              alt="SLAB"
              width={75}
              height={75}
              className="h-[75px] w-auto hover:scale-110 transition-transform drop-shadow-[0_0_15px_rgba(255,221,0,0.5)] animate-thermal-flicker"
              priority
            />
          </Link>

          {/* Navigation Links - Thermal Style */}
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className={`text-2xl font-semibold transition-all thermal-text-glow ${
                pathname.startsWith('/admin')
                  ? 'text-thermal-gold shadow-thermal-glow'
                  : 'text-thermal-yellow hover:text-thermal-gold hover:shadow-thermal-glow'
              }`}
            >
              Admin
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
};
