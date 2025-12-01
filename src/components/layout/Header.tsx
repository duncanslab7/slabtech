'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export const Header = () => {
  const pathname = usePathname();

  // Don't show header on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <header className="bg-pure-white border-b-2 border-midnight-blue">
      <nav className="max-w-[800px] mx-auto px-6 py-1">
        <div className="flex items-center justify-between">
          {/* Logo - serves as home button */}
          <Link href="/" className="flex items-center">
            <Image
              src="/slab-logo.png"
              alt="SLAB"
              width={75}
              height={75}
              className="h-[75px] w-auto"
              priority
            />
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className={`text-2xl font-semibold transition-colors ${
                pathname.startsWith('/admin') ? 'text-success-gold' : 'text-midnight-blue hover:text-success-gold'
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
