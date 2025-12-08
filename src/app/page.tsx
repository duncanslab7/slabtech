'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { VideoIntro } from '@/components/VideoIntro';

// Video URL - served from public folder
const INTRO_VIDEO_URL = '/intro-video.mp4';
// Set to true to enable video intro
const ENABLE_VIDEO_INTRO = true;

export default function HomePage() {
  const [showIntro, setShowIntro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has seen the intro this session
    const hasSeenIntro = sessionStorage.getItem('hasSeenIntro');

    if (ENABLE_VIDEO_INTRO && !hasSeenIntro) {
      setShowIntro(true);
    }

    setIsLoading(false);
  }, []);

  const handleIntroComplete = () => {
    sessionStorage.setItem('hasSeenIntro', 'true');
    setShowIntro(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pure-white flex items-center justify-center">
        <div className="animate-pulse">
          <Image
            src="/slab-logo.png"
            alt="SLAB"
            width={150}
            height={150}
            priority
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Video Intro - shows once per session */}
      {showIntro && (
        <VideoIntro videoUrl={INTRO_VIDEO_URL} onComplete={handleIntroComplete} />
      )}

      {/* Main Homepage */}
      <main className="min-h-screen bg-pure-white flex flex-col">
        {/* Header with Logo */}
        <header className="w-full py-6 flex justify-center border-b-2 border-midnight-blue">
          <Link href="/">
            <Image
              src="/slab-logo.png"
              alt="SLAB"
              width={120}
              height={120}
              className="h-[120px] w-auto cursor-pointer hover:opacity-80 transition-opacity"
              priority
            />
          </Link>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          {/* Glowing Orange Text */}
          <h1
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-16 tracking-wide"
            style={{
              color: '#f39c12',
              textShadow: `
                0 0 10px rgba(243, 156, 18, 0.8),
                0 0 20px rgba(243, 156, 18, 0.6),
                0 0 30px rgba(243, 156, 18, 0.4),
                0 0 40px rgba(243, 156, 18, 0.3)
              `,
            }}
          >
            GOLDEN DOOR REPS AREN&apos;T BORN, THEY&apos;RE MADE
          </h1>

          {/* Navigation Circles */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            {/* Admin Circle */}
            <Link
              href="/login"
              className="group relative w-40 h-40 md:w-48 md:h-48 rounded-full bg-charcoal flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              style={{
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              }}
            >
              <span className="text-pure-white text-2xl md:text-3xl font-bold tracking-wider group-hover:text-success-gold transition-colors">
                ADMIN
              </span>
              {/* Hover ring effect */}
              <div className="absolute inset-0 rounded-full border-4 border-transparent group-hover:border-success-gold transition-all duration-300" />
            </Link>

            {/* Login Circle */}
            <Link
              href="/user/login"
              className="group relative w-40 h-40 md:w-48 md:h-48 rounded-full bg-charcoal flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              style={{
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              }}
            >
              <span className="text-pure-white text-2xl md:text-3xl font-bold tracking-wider group-hover:text-success-gold transition-colors">
                LOGIN
              </span>
              {/* Hover ring effect */}
              <div className="absolute inset-0 rounded-full border-4 border-transparent group-hover:border-success-gold transition-all duration-300" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-4 text-center text-steel-gray text-sm border-t border-gray-200">
          &copy; {new Date().getFullYear()} SLAB Voice. All rights reserved.
        </footer>
      </main>
    </>
  );
}
