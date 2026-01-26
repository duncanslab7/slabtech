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

      {/* Mobile: Scrolling Ticker at Top */}
      <div className="lg:hidden relative z-10">
        <ScrollingTicker />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 py-12 gap-8 lg:gap-16 relative z-10">

        {/* Desktop Layout: Letters horizontal, logo below */}
        <div className="hidden lg:flex flex-col items-center gap-8">
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

          {/* Logo Row with Motto and Trademark */}
          <div className="flex items-center justify-between w-full max-w-[1400px] px-8">
            {/* Motto */}
            <div className="flex-1 flex justify-end pr-12">
              <p
                className={`text-lg font-medium italic max-w-[220px] text-center transition-opacity ${
                  expandedLetter !== null ? 'opacity-30' : 'opacity-100'
                }`}
                style={{
                  color: '#f39c12',
                  textShadow: '0 0 10px rgba(255, 140, 0, 0.6), 0 0 20px rgba(255, 140, 0, 0.4)',
                }}
              >
                "Golden Reps aren't born, They're Made"
              </p>
            </div>

            {/* Logo Video */}
            <div className="flex-shrink-0">
              <LogoVideo isDimmed={expandedLetter !== null} />
            </div>

            {/* Trademark */}
            <div className="flex-1 flex justify-start pl-12">
              <p
                className={`text-base font-medium max-w-[220px] text-center transition-opacity ${
                  expandedLetter !== null ? 'opacity-30' : 'opacity-100'
                }`}
                style={{
                  color: '#f39c12',
                  textShadow: '0 0 10px rgba(255, 140, 0, 0.6), 0 0 20px rgba(255, 140, 0, 0.4)',
                }}
              >
                SalesLab Immersion™<br />
                Voice Intelligence Platform
              </p>
            </div>
          </div>

          {/* Copyright Text */}
          <p className="text-[#1a1a4d] text-sm font-medium tracking-wide mt-4">
            2025 SLAB LLC All rights reserved
          </p>
        </div>

        {/* Mobile Layout: New pristine layout */}
        <div className="flex lg:hidden flex-col items-center gap-6 w-full px-4">
          {/* Quote at top */}
          <p
            className={`text-lg font-medium italic text-center px-4 transition-opacity ${
              expandedLetter !== null ? 'opacity-30' : 'opacity-100'
            }`}
            style={{
              color: '#f39c12',
              textShadow: '0 0 10px rgba(255, 140, 0, 0.6), 0 0 20px rgba(255, 140, 0, 0.4)',
            }}
          >
            "Golden Door reps aren't born, They're Made"
          </p>

          {/* Letters and Video centered together */}
          <div className="flex items-center gap-4 justify-center">
            {/* SLAB Letters - Vertical */}
            <div className="flex flex-col items-center gap-5">
              {letters.map((letter, index) => (
                <div key={letter.key} className="flex flex-col items-center gap-5">
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
                      className={`w-3 h-3 rounded-full bg-[#f39c12] transition-opacity ${
                        expandedLetter !== null ? 'opacity-0' : 'opacity-100'
                      }`}
                      style={{
                        boxShadow: '0 0 10px rgba(243, 156, 18, 0.6), 0 0 20px rgba(243, 156, 18, 0.4)'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Logo Video centered with letters */}
            <div className="flex-shrink-0">
              <LogoVideo isDimmed={expandedLetter !== null} />
            </div>
          </div>

          {/* Trademark and Copyright below */}
          <div className={`flex flex-col items-center gap-4 transition-opacity ${
            expandedLetter !== null ? 'opacity-30' : 'opacity-100'
          }`}>
            {/* Trademark */}
            <p
              className="text-sm font-medium text-center px-4"
              style={{
                color: '#f39c12',
                textShadow: '0 0 10px rgba(255, 140, 0, 0.6), 0 0 20px rgba(255, 140, 0, 0.4)',
              }}
            >
              SalesLab Immersion™<br />
              Voice Intelligence Platform
            </p>

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
  // Shared text styles - bigger on mobile, even bigger when expanded
  const textClassName = isExpanded
    ? `text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-wider transition-all duration-300 relative max-w-[90vw] break-words text-center ${
        isDimmed ? 'opacity-30' : 'opacity-100'
      }`
    : `text-7xl md:text-8xl font-bold tracking-wider transition-all duration-300 relative ${
        isDimmed ? 'opacity-30' : 'opacity-100'
      }`;

  const collapsedStyle = {
    textShadow: '0 0 20px rgba(255, 140, 0, 1), 0 0 40px rgba(255, 140, 0, 0.8), 0 0 60px rgba(255, 120, 0, 0.6), 0 0 80px rgba(255, 100, 0, 0.4)',
  };

  const expandedStyle = {
    textShadow: '0 0 20px rgba(255, 255, 0, 1), 0 0 40px rgba(255, 255, 0, 0.9), 0 0 60px rgba(255, 221, 0, 0.7), 0 0 80px rgba(255, 221, 0, 0.5)',
  };

  const content = (
    <div className="relative z-30 flex flex-col items-center">
      {/* If expanded and has href, render as clickable Link */}
      {isExpanded && letter.href ? (
        <Link
          href={letter.href}
          className={`${textClassName} text-[#ffff00] hover:text-white cursor-pointer block px-2`}
          style={expandedStyle}
        >
          {letter.fullText}
        </Link>
      ) : isExpanded ? (
        // Expanded but no href (Story, Buy)
        <div className="flex flex-col items-center gap-6 max-w-6xl px-4">
          <div
            className={`${textClassName} text-[#ffff00] px-2`}
            style={expandedStyle}
          >
            {letter.fullText}
          </div>
          {letter.key === 'S' && <StoryContent />}
          {letter.key === 'B' && <BuyContent />}
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
          className="mt-4 text-2xl text-[#f39c12] hover:text-[#ff8800] transition-colors z-20"
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
    const video = videoRef.current;
    if (!video) return;

    // Try to play immediately
    const playVideo = () => {
      video.play().catch(() => {
        // If autoplay fails, try again on any user interaction
        const playOnInteraction = () => {
          video.play().catch(() => {});
          document.removeEventListener('click', playOnInteraction);
          document.removeEventListener('touchstart', playOnInteraction);
        };
        document.addEventListener('click', playOnInteraction, { once: true });
        document.addEventListener('touchstart', playOnInteraction, { once: true });
      });
    };

    // Try to play when loaded
    if (video.readyState >= 2) {
      playVideo();
    } else {
      video.addEventListener('loadeddata', playVideo, { once: true });
    }
  }, []);

  return (
    <div className={`relative w-48 h-36 sm:w-64 sm:h-48 md:w-80 md:h-60 lg:w-[400px] lg:h-[240px] transition-opacity duration-300 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}>
      {/* Orange glow effect */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255, 140, 0, 0.4) 0%, rgba(255, 120, 0, 0.2) 40%, transparent 70%)',
          filter: 'blur(30px)',
          transform: 'scale(1.1)',
        }}
      />
      {/* Grainy texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: 0.3,
          mixBlendMode: 'overlay',
          userSelect: 'none',
        }}
      />
      <video
        ref={videoRef}
        loop
        muted
        playsInline
        autoPlay
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        className="w-full h-full object-contain relative z-10"
        style={{ background: 'transparent', mixBlendMode: 'screen' }}
        onError={(e) => console.error('Video failed to load:', e)}
        onLoadedData={() => console.log('Video loaded successfully')}
      >
        <source src="/slab-logo-pan.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

function BuyContent() {
  const [selectedProduct, setSelectedProduct] = useState<'hoodie' | 'individual' | 'company' | null>(null);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-6xl py-4 px-4">
      {/* Product Grid */}
      {!selectedProduct && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {/* Custom Hoodie Card - Coming Soon */}
          <div className="relative">
            <ProductCard
              title="Custom Hoodie"
              description="1 of 1 custom piece. Choose your colors, logos, and placement."
              price="Contact for pricing"
              onClick={() => {}}
              disabled
            />
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-[#ffff00] text-2xl font-bold mb-2" style={{
                  textShadow: '0 0 10px rgba(255, 255, 0, 0.6)'
                }}>
                  Coming Soon
                </p>
                <p className="text-[#f39c12] text-sm">
                  Custom hoodies will be available soon
                </p>
              </div>
            </div>
          </div>

          {/* Individual Tier Card */}
          <ProductCard
            title="Individual Access"
            description="3000+ hours of top 1% industry content with AI analytics"
            price="$500/summer or $100/month"
            features={[
              "3000+ hours of the top 1%",
              "Patented Immersion Method",
              "AI analytics",
              "Choose: Pest, Roofing, Solar, or Fiber"
            ]}
            onClick={() => setSelectedProduct('individual')}
          />

          {/* Company Tier Card */}
          <ProductCard
            title="Company Access"
            description="Everything in Individual plus company optimization tools"
            price="Contact us"
            features={[
              "All Individual benefits",
              "Company optimization",
              "In-house messaging & leaderboard",
              "Gameified learning",
              "Training data & optics",
              "+ more"
            ]}
            onClick={() => setSelectedProduct('company')}
            highlighted
          />
        </div>
      )}

      {/* Hoodie Builder */}
      {selectedProduct === 'hoodie' && (
        <HoodieBuilder onBack={() => setSelectedProduct(null)} />
      )}

      {/* Individual Inquiry Form */}
      {selectedProduct === 'individual' && (
        <InquiryForm
          productType="individual"
          onBack={() => setSelectedProduct(null)}
        />
      )}

      {/* Company Inquiry Form */}
      {selectedProduct === 'company' && (
        <InquiryForm
          productType="company"
          onBack={() => setSelectedProduct(null)}
        />
      )}

      {/* Contact Info */}
      {!selectedProduct && (
        <div className="text-center mt-4">
          <p className="text-[#f39c12] text-lg" style={{
            textShadow: '0 0 8px rgba(243, 156, 18, 0.5), 0 0 15px rgba(243, 156, 18, 0.3)'
          }}>
            Questions? Contact us at{' '}
            <a href="mailto:duncan@slabtraining.com" className="underline hover:text-white transition-colors">
              duncan@slabtraining.com
            </a>
            {' '}or{' '}
            <a href="tel:5208341750" className="underline hover:text-white transition-colors">
              520-834-1750
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

interface ProductCardProps {
  title: string;
  description: string;
  price: string;
  features?: string[];
  onClick: () => void;
  highlighted?: boolean;
  disabled?: boolean;
}

function ProductCard({ title, description, price, features, onClick, highlighted, disabled }: ProductCardProps) {
  return (
    <div
      className={`relative bg-black/40 rounded-lg border-2 ${highlighted ? 'border-[#ffff00]' : 'border-[#f39c12]/50'} overflow-hidden backdrop-blur-sm p-6 flex flex-col gap-4 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-[#ffff00]'} transition-all group`}
      onClick={disabled ? undefined : onClick}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: 'radial-gradient(circle, rgba(255, 140, 0, 0.2) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div className="relative z-10 flex flex-col gap-4 flex-1">
        <h3 className="text-[#ffff00] text-2xl font-bold" style={{
          textShadow: '0 0 10px rgba(255, 255, 0, 0.6), 0 0 20px rgba(255, 255, 0, 0.4)'
        }}>
          {title}
        </h3>

        <p className="text-[#f39c12] text-sm leading-relaxed">
          {description}
        </p>

        {features && (
          <ul className="text-[#f39c12] text-sm space-y-2">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[#ffff00] mt-1">•</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-4 border-t border-[#f39c12]/30">
          <p className="text-[#ffff00] text-xl font-bold" style={{
            textShadow: '0 0 8px rgba(255, 255, 0, 0.5)'
          }}>
            {price}
          </p>
        </div>

        <button className="w-full bg-[#f39c12] hover:bg-[#ffff00] text-black font-bold py-3 rounded-lg transition-colors" style={{
          boxShadow: '0 0 20px rgba(243, 156, 18, 0.4)'
        }}>
          Learn More
        </button>
      </div>
    </div>
  );
}

function HoodieBuilder({ onBack }: { onBack: () => void }) {
  const [hoodieColor, setHoodieColor] = useState<'black' | 'grey'>('black');
  const [logos, setLogos] = useState<Array<{ color: string; position: string }>>([]);

  const logoColors = ['All Black', 'All White', 'Orange', 'Blue', 'Green'];
  const positions = ['Left Sleeve', 'Right Sleeve', 'Front', 'Back'];

  const addLogo = () => {
    if (logos.length < 3) {
      setLogos([...logos, { color: logoColors[0], position: positions[0] }]);
    }
  };

  const removeLogo = (index: number) => {
    setLogos(logos.filter((_, i) => i !== index));
  };

  const updateLogo = (index: number, field: 'color' | 'position', value: string) => {
    const updated = [...logos];
    updated[index][field] = value;
    setLogos(updated);
  };

  return (
    <div className="w-full max-w-4xl">
      <button
        onClick={onBack}
        className="text-[#f39c12] hover:text-[#ffff00] mb-6 flex items-center gap-2 transition-colors"
      >
        ← Back to Store
      </button>

      <div className="bg-black/40 rounded-lg border-2 border-[#f39c12]/50 p-6 space-y-6">
        <h3 className="text-[#ffff00] text-3xl font-bold text-center" style={{
          textShadow: '0 0 10px rgba(255, 255, 0, 0.6)'
        }}>
          Design Your 1 of 1 Hoodie
        </h3>

        {/* Hoodie Color */}
        <div className="space-y-3">
          <label className="text-[#f39c12] text-lg font-medium">Hoodie Color</label>
          <div className="flex gap-4">
            {['black', 'grey'].map((color) => (
              <button
                key={color}
                onClick={() => setHoodieColor(color as 'black' | 'grey')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  hoodieColor === color
                    ? 'bg-[#ffff00] text-black'
                    : 'bg-black/60 text-[#f39c12] border border-[#f39c12]/50 hover:border-[#ffff00]'
                }`}
              >
                {color.charAt(0).toUpperCase() + color.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Logo Placements */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[#f39c12] text-lg font-medium">
              Logo Placements ({logos.length}/3)
            </label>
            {logos.length < 3 && (
              <button
                onClick={addLogo}
                className="bg-[#f39c12] hover:bg-[#ffff00] text-black font-medium px-4 py-2 rounded-lg transition-colors"
              >
                + Add Logo
              </button>
            )}
          </div>

          {logos.map((logo, index) => (
            <div key={index} className="bg-black/60 rounded-lg p-4 space-y-3 border border-[#f39c12]/30">
              <div className="flex items-center justify-between">
                <span className="text-[#ffff00] font-medium">Logo {index + 1}</span>
                <button
                  onClick={() => removeLogo(index)}
                  className="text-[#f39c12] hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#f39c12] text-sm mb-2 block">Color</label>
                  <select
                    value={logo.color}
                    onChange={(e) => updateLogo(index, 'color', e.target.value)}
                    className="w-full bg-black/60 border border-[#f39c12]/50 text-[#f39c12] rounded px-3 py-2"
                  >
                    {logoColors.map((color) => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[#f39c12] text-sm mb-2 block">Position</label>
                  <select
                    value={logo.position}
                    onChange={(e) => updateLogo(index, 'position', e.target.value)}
                    className="w-full bg-black/60 border border-[#f39c12]/50 text-[#f39c12] rounded px-3 py-2"
                  >
                    {positions.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {logos.length === 0 && (
            <p className="text-[#f39c12]/60 text-center py-8">
              Click "Add Logo" to start customizing your hoodie
            </p>
          )}
        </div>

        {/* Summary & Contact Form Link */}
        {logos.length > 0 && (
          <div className="pt-6 border-t border-[#f39c12]/30 space-y-4">
            <div className="bg-black/60 rounded-lg p-4">
              <h4 className="text-[#ffff00] font-medium mb-3">Your Design:</h4>
              <div className="text-[#f39c12] space-y-2 text-sm">
                <p>• {hoodieColor.charAt(0).toUpperCase() + hoodieColor.slice(1)} hoodie</p>
                {logos.map((logo, i) => (
                  <p key={i}>• {logo.color} logo on {logo.position}</p>
                ))}
              </div>
            </div>

            <InquiryForm
              productType="hoodie"
              customData={{ hoodieColor, logos }}
              inline
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface InquiryFormProps {
  productType: 'hoodie' | 'individual' | 'company';
  customData?: any;
  onBack?: () => void;
  inline?: boolean;
}

function InquiryForm({ productType, customData, onBack, inline }: InquiryFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    industry: 'Pest',
    paymentPlan: 'summer',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/purchase-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType,
          customData,
          ...formData
        })
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        alert('Something went wrong. Please contact us directly at duncan@slabtraining.com');
      }
    } catch (error) {
      alert('Something went wrong. Please contact us directly at duncan@slabtraining.com');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-black/40 rounded-lg border-2 border-[#ffff00] p-8 text-center">
        <div className="text-[#ffff00] text-5xl mb-4">✓</div>
        <h3 className="text-[#ffff00] text-2xl font-bold mb-4" style={{
          textShadow: '0 0 10px rgba(255, 255, 0, 0.6)'
        }}>
          Request Received!
        </h3>
        <p className="text-[#f39c12] text-lg mb-6">
          We'll contact you shortly at {formData.email} or {formData.phone}
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="bg-[#f39c12] hover:bg-[#ffff00] text-black font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Back to Store
          </button>
        )}
      </div>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!inline && (
        <>
          <h3 className="text-[#ffff00] text-2xl font-bold text-center mb-6" style={{
            textShadow: '0 0 10px rgba(255, 255, 0, 0.6)'
          }}>
            {productType === 'hoodie' && 'Request Your Custom Hoodie'}
            {productType === 'individual' && 'Get Individual Access'}
            {productType === 'company' && 'Get Company Access'}
          </h3>

          {productType === 'individual' && (
            <div className="bg-black/60 rounded-lg p-4 mb-4">
              <p className="text-[#f39c12] text-sm">
                <strong className="text-[#ffff00]">Includes:</strong> 3000+ hours of top 1% content, Patented Immersion Method, AI analytics
              </p>
            </div>
          )}

          {productType === 'company' && (
            <div className="bg-black/60 rounded-lg p-4 mb-4">
              <p className="text-[#f39c12] text-sm">
                <strong className="text-[#ffff00]">Includes:</strong> All Individual benefits + Company optimization, In-house messaging & leaderboard, Gameified learning, Training data & optics, and more
              </p>
            </div>
          )}
        </>
      )}

      <div>
        <label className="text-[#f39c12] text-sm mb-2 block">Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="w-full bg-black/60 border border-[#f39c12]/50 text-white rounded px-4 py-2 focus:border-[#ffff00] focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[#f39c12] text-sm mb-2 block">Email *</label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          className="w-full bg-black/60 border border-[#f39c12]/50 text-white rounded px-4 py-2 focus:border-[#ffff00] focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[#f39c12] text-sm mb-2 block">Phone *</label>
        <input
          type="tel"
          required
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          className="w-full bg-black/60 border border-[#f39c12]/50 text-white rounded px-4 py-2 focus:border-[#ffff00] focus:outline-none"
        />
      </div>

      {productType === 'individual' && (
        <>
          <div>
            <label className="text-[#f39c12] text-sm mb-2 block">Industry *</label>
            <select
              value={formData.industry}
              onChange={(e) => setFormData({...formData, industry: e.target.value})}
              className="w-full bg-black/60 border border-[#f39c12]/50 text-white rounded px-4 py-2 focus:border-[#ffff00] focus:outline-none"
            >
              <option value="Pest">Pest</option>
              <option value="Roofing">Roofing</option>
              <option value="Solar">Solar</option>
              <option value="Fiber">Fiber</option>
            </select>
          </div>

          <div>
            <label className="text-[#f39c12] text-sm mb-2 block">Payment Plan *</label>
            <select
              value={formData.paymentPlan}
              onChange={(e) => setFormData({...formData, paymentPlan: e.target.value})}
              className="w-full bg-black/60 border border-[#f39c12]/50 text-white rounded px-4 py-2 focus:border-[#ffff00] focus:outline-none"
            >
              <option value="summer">$500 for the summer</option>
              <option value="monthly">$100 per month</option>
            </select>
          </div>
        </>
      )}

      <div>
        <label className="text-[#f39c12] text-sm mb-2 block">Additional Information</label>
        <textarea
          value={formData.message}
          onChange={(e) => setFormData({...formData, message: e.target.value})}
          rows={4}
          className="w-full bg-black/60 border border-[#f39c12]/50 text-white rounded px-4 py-2 focus:border-[#ffff00] focus:outline-none"
          placeholder="Any questions or special requests?"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#f39c12] hover:bg-[#ffff00] text-black font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
        style={{
          boxShadow: '0 0 20px rgba(243, 156, 18, 0.4)'
        }}
      >
        {submitting ? 'Submitting...' : 'Submit Request'}
      </button>

      <p className="text-[#f39c12] text-xs text-center">
        We'll contact you within 24 hours at the email or phone you provided
      </p>
    </form>
  );

  if (inline) {
    return <div className="space-y-4">{formContent}</div>;
  }

  return (
    <div className="w-full max-w-2xl">
      {onBack && (
        <button
          onClick={onBack}
          className="text-[#f39c12] hover:text-[#ffff00] mb-6 flex items-center gap-2 transition-colors"
        >
          ← Back to Store
        </button>
      )}
      <div className="bg-black/40 rounded-lg border-2 border-[#f39c12]/50 p-6">
        {formContent}
      </div>
    </div>
  );
}

function StoryContent() {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl py-4">
      {/* Video Placeholder */}
      <div className="relative w-full aspect-video max-w-3xl">
        {/* Orange glow effect */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255, 140, 0, 0.3) 0%, rgba(255, 120, 0, 0.15) 40%, transparent 70%)',
            filter: 'blur(30px)',
            transform: 'scale(1.05)',
          }}
        />
        {/* Video container */}
        <div className="relative w-full h-full bg-black/40 rounded-lg border-2 border-[#f39c12]/50 overflow-hidden backdrop-blur-sm">
          {/* Grainy texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              opacity: 0.2,
              mixBlendMode: 'overlay',
            }}
          />
          {/* Placeholder content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20">
            <div className="w-20 h-20 rounded-full border-4 border-[#f39c12]/50 flex items-center justify-center">
              <div className="w-0 h-0 border-l-[20px] border-l-[#f39c12] border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1"></div>
            </div>
            <p
              className="text-[#f39c12] text-xl font-medium tracking-wide"
              style={{
                textShadow: '0 0 10px rgba(243, 156, 18, 0.6), 0 0 20px rgba(243, 156, 18, 0.4)'
              }}
            >
              Video Coming Soon
            </p>
          </div>

          {/* When you have the video, replace the placeholder with this:
          <video
            loop
            muted
            playsInline
            autoPlay
            controls
            className="w-full h-full object-cover"
          >
            <source src="/story-video.mp4" type="video/mp4" />
          </video>
          */}
        </div>
      </div>

      {/* Optional: Story description text */}
      <div className="text-center max-w-2xl px-4">
        <p
          className="text-[#f39c12] text-lg leading-relaxed"
          style={{
            textShadow: '0 0 8px rgba(243, 156, 18, 0.5), 0 0 15px rgba(243, 156, 18, 0.3)'
          }}
        >
          Learn what sets Sales Lab apart from every other training regimine after studying and reverse-engineering how the best linguists in the world learn languages.
        </p>
      </div>
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
