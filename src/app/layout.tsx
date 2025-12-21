import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components";
import { VT323 } from 'next/font/google';

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
        <Header />
        {children}
      </body>
    </html>
  );
}
