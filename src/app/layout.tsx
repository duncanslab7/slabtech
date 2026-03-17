import type { Metadata } from "next";
import "./globals.css";
import { VT323 } from 'next/font/google';
import Link from 'next/link';

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323'
});

export const metadata: Metadata = {
  title: "Slab Voice",
  description: "Voice transcription and PII redaction system",
  icons: {
    icon: '/favicon-32x32.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={vt323.variable}>
      <body className="antialiased">
        {children}
        <footer className="border-t border-gray-200 py-4 text-center text-sm text-gray-400">
          <span>© {new Date().getFullYear()} SLAB Training. </span>
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
        </footer>
      </body>
    </html>
  );
}
