'use client';

import { useState, useEffect, useRef } from 'react';

interface VideoIntroProps {
  videoUrl: string;
  onComplete: () => void;
}

export const VideoIntro = ({ videoUrl, onComplete }: VideoIntroProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [splitAnimation, setSplitAnimation] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      // Start split animation when video ends
      setSplitAnimation(true);
      // Wait for animation to complete before calling onComplete
      setTimeout(() => {
        onComplete();
      }, 1000); // 1 second for the split animation
    };

    video.addEventListener('ended', handleEnded);

    // Auto-play the video
    video.play().catch((error) => {
      console.error('Video autoplay failed:', error);
      // If autoplay fails, skip to the homepage
      onComplete();
    });

    return () => {
      video.removeEventListener('ended', handleEnded);
    };
  }, [onComplete]);

  if (!isPlaying) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Video container */}
      <div className={`absolute inset-0 flex items-center justify-center transition-transform duration-1000 ${
        splitAnimation ? 'scale-110' : ''
      }`}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="auto"
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Split animation overlay */}
      {splitAnimation && (
        <>
          {/* Left half sliding left */}
          <div
            className="absolute top-0 left-0 w-1/2 h-full bg-black animate-slide-left overflow-hidden"
            style={{
              animation: 'slideLeft 1s ease-in-out forwards',
            }}
          >
            <div className="absolute top-0 right-0 w-[200%] h-full">
              <video
                className="w-full h-full object-cover"
                muted
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            </div>
          </div>

          {/* Right half sliding right */}
          <div
            className="absolute top-0 right-0 w-1/2 h-full bg-black overflow-hidden"
            style={{
              animation: 'slideRight 1s ease-in-out forwards',
            }}
          >
            <div className="absolute top-0 left-[-100%] w-[200%] h-full">
              <video
                className="w-full h-full object-cover"
                muted
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            </div>
          </div>
        </>
      )}

      {/* CSS animations */}
      <style jsx>{`
        @keyframes slideLeft {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-100%);
          }
        }

        @keyframes slideRight {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};
