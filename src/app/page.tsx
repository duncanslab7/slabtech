'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type LetterKey = 'S' | 'L' | 'A' | 'B' | null;

interface LetterConfig {
  key: LetterKey;
  fullText: string;
  href?: string;
}

const letters: LetterConfig[] = [
  { key: 'S', fullText: 'Story' },
  { key: 'L', fullText: 'Login', href: '/user/login' },
  { key: 'A', fullText: 'Admin', href: '/login' },
  { key: 'B', fullText: 'Buy' },
];

export default function HomePage() {
  const [expandedLetter, setExpandedLetter] = useState<LetterKey>(null);

  const handleLetterClick = (key: LetterKey) => {
    setExpandedLetter(expandedLetter === key ? null : key);
  };

  const handleClose = () => {
    setExpandedLetter(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#000033] via-[#001199] to-[#0a1a5f] relative overflow-hidden flex flex-col">
      {/* Grain overlay for texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-50 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      />

      {/* Overlay darkening when a letter is expanded - lower z-index than content */}
      {expandedLetter && (
        <div
          className="fixed inset-0 bg-black/60 z-[5] transition-opacity duration-300"
          onClick={handleClose}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 py-12 gap-8 lg:gap-16 relative z-10">

        {/* Desktop Layout: Letters horizontal, logo below */}
        <div className="hidden lg:flex flex-col items-center gap-4">
          {/* SLAB Letters - Horizontal */}
          <div className="flex items-center gap-6">
            {letters.map((letter, index) => (
              <div key={letter.key} className="flex items-center gap-6">
                <LetterButton
                  letter={letter}
                  isExpanded={expandedLetter === letter.key}
                  isDimmed={expandedLetter !== null && expandedLetter !== letter.key}
                  onClick={() => handleLetterClick(letter.key)}
                  onClose={handleClose}
                />
                {/* Dot separator (except after last letter) */}
                {index < letters.length - 1 && (
                  <div
                    className={`w-4 h-4 rounded-full bg-[#f39c12] transition-opacity ${
                      expandedLetter !== null && expandedLetter !== letter.key ? 'opacity-30' : 'opacity-100'
                    }`}
                    style={{
                      boxShadow: '0 0 10px rgba(243, 156, 18, 0.6), 0 0 20px rgba(243, 156, 18, 0.4)'
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Logo Video */}
          <LogoVideo isDimmed={expandedLetter !== null} />

          {/* Copyright Text */}
          <p className="text-[#1a1a4d] text-sm font-medium tracking-wide mt-4">
            2025 SLAB LLC All rights reserved
          </p>
        </div>

        {/* Mobile Layout: Letters vertical, logo on right */}
        <div className="flex lg:hidden items-center gap-6">
          {/* SLAB Letters - Vertical */}
          <div className="flex flex-col items-center gap-6">
            {letters.map((letter, index) => (
              <div key={letter.key} className="flex flex-col items-center gap-6">
                <LetterButton
                  letter={letter}
                  isExpanded={expandedLetter === letter.key}
                  isDimmed={expandedLetter !== null && expandedLetter !== letter.key}
                  onClick={() => handleLetterClick(letter.key)}
                  onClose={handleClose}
                />
                {/* Dot separator (except after last letter) */}
                {index < letters.length - 1 && (
                  <div
                    className={`w-4 h-4 rounded-full bg-[#f39c12] transition-opacity ${
                      expandedLetter !== null && expandedLetter !== letter.key ? 'opacity-30' : 'opacity-100'
                    }`}
                    style={{
                      boxShadow: '0 0 10px rgba(243, 156, 18, 0.6), 0 0 20px rgba(243, 156, 18, 0.4)'
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Logo Video */}
          <div className="flex flex-col items-center gap-4">
            <LogoVideo isDimmed={expandedLetter !== null} />

            {/* Copyright Text */}
            <p className="text-[#1a1a4d] text-xs font-medium tracking-wide">
              2025 SLAB LLC All rights reserved
            </p>
          </div>
        </div>
      </div>

      {/* Scrolling Ticker at Bottom */}
      <ScrollingTicker />
    </main>
  );
}

interface LetterButtonProps {
  letter: LetterConfig;
  isExpanded: boolean;
  isDimmed: boolean;
  onClick: () => void;
  onClose: () => void;
}

function LetterButton({ letter, isExpanded, isDimmed, onClick, onClose }: LetterButtonProps) {
  // Shared text styles
  const textClassName = `text-6xl md:text-8xl font-bold tracking-wider transition-all duration-300 relative ${
    isDimmed ? 'opacity-30' : 'opacity-100'
  }`;

  const collapsedStyle = {
    textShadow: '0 0 15px rgba(243, 156, 18, 0.8), 0 0 30px rgba(243, 156, 18, 0.6), 0 0 45px rgba(243, 156, 18, 0.4)',
  };

  const expandedStyle = {
    textShadow: '0 0 20px rgba(255, 255, 0, 1), 0 0 40px rgba(255, 255, 0, 0.9), 0 0 60px rgba(255, 221, 0, 0.7), 0 0 80px rgba(255, 221, 0, 0.5)',
  };

  const content = (
    <div className="relative z-30">
      {/* If expanded and has href, render as clickable Link */}
      {isExpanded && letter.href ? (
        <Link
          href={letter.href}
          className={`${textClassName} text-[#ffff00] hover:text-white cursor-pointer block`}
          style={expandedStyle}
        >
          {letter.fullText}
        </Link>
      ) : isExpanded ? (
        // Expanded but no href (Story, Buy)
        <div
          className={`${textClassName} text-[#ffff00]`}
          style={expandedStyle}
        >
          {letter.fullText}
        </div>
      ) : (
        // Collapsed state - clickable button
        <button
          onClick={onClick}
          className={`${textClassName} text-[#f39c12] hover:text-[#ff8800]`}
          style={collapsedStyle}
        >
          {letter.key}
        </button>
      )}

      {/* X button when expanded */}
      {isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-2xl text-[#f39c12] hover:text-[#ff8800] transition-colors z-20"
          style={{
            textShadow: '0 0 10px rgba(243, 156, 18, 0.6), 0 0 20px rgba(243, 156, 18, 0.4)'
          }}
        >
          ✕
        </button>
      )}
    </div>
  );

  return content;
}

function LogoVideo({ isDimmed }: { isDimmed: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      // Try to play, but silently handle autoplay restrictions
      videoRef.current.play().catch(() => {
        // Autoplay was prevented by browser, this is normal
      });
    }
  }, []);

  return (
    <div className={`transition-opacity duration-300 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}>
      <video
        ref={videoRef}
        loop
        muted
        playsInline
        autoPlay
        preload="auto"
        className="w-80 h-80 md:w-[500px] md:h-[500px] object-contain"
        style={{ background: 'transparent' }}
        onError={(e) => console.error('Video failed to load:', e)}
        onLoadedData={() => console.log('Video loaded successfully')}
      >
        <source src="/slab-logo-video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

function ScrollingTicker() {
  return (
    <div className="relative w-full py-4 overflow-hidden">
      <div className="flex animate-scroll whitespace-nowrap">
        {/* Repeat the content multiple times for seamless loop */}
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-6">
            <Image
              src="/slab-logo.png"
              alt="SLAB"
              width={30}
              height={30}
              className="w-[30px] h-[30px]"
            />
            <span
              className="text-lg font-[family-name:var(--font-vt323)] tracking-wider text-[#f39c12]"
              style={{
                textShadow: '0 0 10px rgba(243, 156, 18, 0.8), 0 0 20px rgba(243, 156, 18, 0.6), 0 0 30px rgba(243, 156, 18, 0.4)'
              }}
            >
              CLICK ON A LETTER TO LEARN MORE
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
