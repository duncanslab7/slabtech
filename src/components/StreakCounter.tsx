'use client';

import { useEffect, useState } from 'react';

interface StreakCounterProps {
  streak: number;
  className?: string;
}

/**
 * Get fire color based on week number
 * Week 1: Red, Week 2: Orange, Week 3: Blue, Week 4: Purple, etc.
 */
function getFireColorByWeek(streak: number): {
  color: string;
  glowColor: string;
  gradientFrom: string;
  gradientTo: string;
} {
  const weekNumber = Math.floor(streak / 7) % 6; // Cycle through 6 colors

  const colorSchemes = [
    {
      // Week 1: Red Fire
      color: '#ff0844',
      glowColor: 'rgba(255, 8, 68, 0.8)',
      gradientFrom: '#ff0844',
      gradientTo: '#ff5733',
    },
    {
      // Week 2: Orange Fire
      color: '#ff5733',
      glowColor: 'rgba(255, 87, 51, 0.8)',
      gradientFrom: '#ff5733',
      gradientTo: '#ffd700',
    },
    {
      // Week 3: Blue Fire
      color: '#00d9ff',
      glowColor: 'rgba(0, 217, 255, 0.8)',
      gradientFrom: '#00d9ff',
      gradientTo: '#0099cc',
    },
    {
      // Week 4: Purple Fire
      color: '#9d4edd',
      glowColor: 'rgba(157, 78, 221, 0.8)',
      gradientFrom: '#9d4edd',
      gradientTo: '#c77dff',
    },
    {
      // Week 5: Gold Fire
      color: '#ffd700',
      glowColor: 'rgba(255, 215, 0, 0.8)',
      gradientFrom: '#ffd700',
      gradientTo: '#ffdd00',
    },
    {
      // Week 6: Green Fire (rare)
      color: '#00ff88',
      glowColor: 'rgba(0, 255, 136, 0.8)',
      gradientFrom: '#00ff88',
      gradientTo: '#00cc66',
    },
  ];

  return colorSchemes[weekNumber];
}

export const StreakCounter: React.FC<StreakCounterProps> = ({
  streak,
  className = '',
}) => {
  const [mounted, setMounted] = useState(false);
  const fireColors = getFireColorByWeek(streak);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Fire Emblem Icon */}
      <div
        className="relative group cursor-pointer"
        style={{
          filter: `drop-shadow(0 0 8px ${fireColors.glowColor})`,
        }}
      >
        {/* Animated fire icon */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="animate-thermal-flicker group-hover:scale-110 transition-transform"
        >
          {/* Fire flame shape */}
          <defs>
            <linearGradient id={`fireGradient-${streak}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: fireColors.gradientFrom, stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: fireColors.gradientTo, stopOpacity: 1 }} />
            </linearGradient>

            {/* Glow filter */}
            <filter id={`fireGlow-${streak}`}>
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Main flame */}
          <path
            d="M12 2C12 2 8 6 8 10C8 13.31 10.69 16 14 16C17.31 16 20 13.31 20 10C20 6 16 2 16 2C16 2 15 4 14 6C13 4 12 2 12 2Z"
            fill={`url(#fireGradient-${streak})`}
            filter={`url(#fireGlow-${streak})`}
            className="animate-thermal-pulse"
          />

          {/* Inner flame (hotter core) */}
          <path
            d="M14 6C14 6 12 8 12 10C12 11.66 13.34 13 15 13C16.66 13 18 11.66 18 10C18 8 16 6 16 6C16 6 15 7 14 8C14 7 14 6 14 6Z"
            fill={fireColors.color}
            opacity="0.8"
            className="animate-thermal-pulse"
            style={{ animationDelay: '0.3s' }}
          />

          {/* Bottom embers */}
          <ellipse
            cx="14"
            cy="17"
            rx="6"
            ry="2"
            fill={fireColors.color}
            opacity="0.3"
            className="animate-thermal-pulse"
            style={{ animationDelay: '0.6s' }}
          />
        </svg>

        {/* Floating particles animation */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full opacity-70 animate-float-up"
              style={{
                backgroundColor: fireColors.color,
                left: `${30 + i * 15}%`,
                bottom: '0',
                animationDelay: `${i * 0.5}s`,
                boxShadow: `0 0 4px ${fireColors.glowColor}`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Streak Number */}
      <div
        className="font-bold text-xl thermal-text-glow transition-all group-hover:scale-110"
        style={{
          color: fireColors.color,
          textShadow: `0 0 10px ${fireColors.glowColor}, 0 0 20px ${fireColors.glowColor}`,
        }}
      >
        {streak}
      </div>

      {/* Tooltip on hover */}
      <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-thermal-dark/95 border-2 border-thermal-orange/50 rounded-lg px-3 py-2 whitespace-nowrap backdrop-blur-sm">
          <p className="text-thermal-yellow text-sm font-semibold">
            {streak} Day Streak! 🔥
          </p>
          <p className="text-thermal-cyan/70 text-xs">
            Week {Math.floor(streak / 7) + 1} - {getWeekColorName(streak)}
          </p>
        </div>
      </div>
    </div>
  );
};

function getWeekColorName(streak: number): string {
  const weekNumber = Math.floor(streak / 7) % 6;
  const colorNames = ['Red Fire', 'Orange Fire', 'Blue Fire', 'Purple Fire', 'Gold Fire', 'Green Fire'];
  return colorNames[weekNumber];
}
