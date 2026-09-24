'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The app-wide footer. The marketing home page ships its own footer (and its
 * own dark palette), so this one stays out of its way.
 */
export default function GlobalFooter() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <footer className="border-t border-gray-200 py-4 text-center text-sm text-gray-400">
      <span>© {new Date().getFullYear()} SLAB Training. </span>
      <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
      <span className="mx-2">·</span>
      <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
    </footer>
  );
}
