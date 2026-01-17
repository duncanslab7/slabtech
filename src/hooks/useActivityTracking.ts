'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface ActivityTrackingOptions {
  heartbeatInterval?: number; // milliseconds between heartbeats (default: 30000 = 30s)
  inactivityThreshold?: number; // milliseconds of inactivity before pausing (default: 120000 = 2min)
  enabled?: boolean; // whether tracking is enabled (default: true)
}

interface ActivityMetadata {
  scrollDepth?: number;
  audioPlaying?: boolean;
  transcriptId?: string;
  [key: string]: any;
}

/**
 * Hook to track user activity and engagement time on the platform
 *
 * Sends periodic heartbeat pings to track active time spent on pages.
 * Automatically pauses when user is inactive and resumes on activity.
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   const { trackEvent, updateMetadata } = useActivityTracking();
 *
 *   const handleAudioPlay = () => {
 *     trackEvent('audio_play', { transcriptId: '123' });
 *     updateMetadata({ audioPlaying: true });
 *   };
 * }
 * ```
 */
export function useActivityTracking(options: ActivityTrackingOptions = {}) {
  const {
    heartbeatInterval = 30000, // 30 seconds
    inactivityThreshold = 120000, // 2 minutes
    enabled = true,
  } = options;

  const pathname = usePathname();
  const supabase = createClient();

  const [isActive, setIsActive] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const metadataRef = useRef<ActivityMetadata>({});
  const isInitializedRef = useRef(false);

  /**
   * Send a heartbeat ping to the server
   */
  const sendHeartbeat = async (activityType?: string) => {
    if (!enabled || !sessionId) return;

    // Determine activity type based on current state
    const type = activityType || (isAudioPlaying ? 'audio_playing' : 'page_active');

    try {
      await fetch('/api/activity/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          pagePath: pathname,
          activityType: type,
          metadata: { ...metadataRef.current, audioPlaying: isAudioPlaying },
        }),
      });
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  };

  /**
   * Track a specific user activity event
   */
  const trackEvent = async (
    eventType: 'transcript_upload' | 'transcript_view' | 'audio_play' | 'audio_pause' | 'audio_complete' | 'page_view',
    eventData: Record<string, any> = {}
  ) => {
    if (!enabled) return;

    try {
      const response = await fetch('/api/activity/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          eventType,
          eventData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`❌ Event tracking failed (${eventType}):`, {
          status: response.status,
          error: errorData,
        });
      }
    } catch (error) {
      console.error(`❌ Event tracking error (${eventType}):`, error);
    }
  };

  /**
   * Update metadata for heartbeat tracking
   */
  const updateMetadata = (metadata: ActivityMetadata) => {
    metadataRef.current = { ...metadataRef.current, ...metadata };
  };

  /**
   * Reset the inactivity timer
   */
  const resetInactivityTimer = () => {
    lastActivityRef.current = Date.now();

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Set user as active if they were inactive
    if (!isActive) {
      setIsActive(true);
    }

    // Start new inactivity timer
    // Don't mark as inactive if audio is playing
    inactivityTimerRef.current = setTimeout(() => {
      if (!isAudioPlaying) {
        setIsActive(false);
      }
    }, inactivityThreshold);
  };

  /**
   * Handle user activity (mouse, keyboard, scroll, etc.)
   */
  const handleActivity = () => {
    resetInactivityTimer();
  };

  /**
   * Initialize or retrieve session
   */
  const initializeSession = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Check if we have a stored session
      const storedSessionId = sessionStorage.getItem('activity_session_id');
      const storedSessionTime = sessionStorage.getItem('activity_session_time');
      const storedUserId = sessionStorage.getItem('activity_user_id');

      // Only reuse session if it's recent AND belongs to current user
      if (storedSessionId && storedSessionTime && storedUserId === user.id) {
        const sessionAge = Date.now() - parseInt(storedSessionTime);
        if (sessionAge < 60 * 60 * 1000) {
          console.log('♻️ Reusing existing session:', storedSessionId);
          setSessionId(storedSessionId);
          return storedSessionId;
        } else {
          // Session expired - end it before creating new one
          console.log('⏰ Session expired, ending old session');
          try {
            await fetch('/api/activity/session', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: storedSessionId }),
            });
          } catch (error) {
            console.warn('Failed to end expired session:', error);
          }
        }
      }

      // Clear old session data if it belongs to a different user
      if (storedUserId && storedUserId !== user.id) {
        console.log('👤 Different user detected, ending old session');
        // End the old session before clearing
        if (storedSessionId) {
          try {
            await fetch('/api/activity/session', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: storedSessionId }),
            });
          } catch (error) {
            console.warn('Failed to end old user session:', error);
          }
        }
        sessionStorage.removeItem('activity_session_id');
        sessionStorage.removeItem('activity_session_time');
        sessionStorage.removeItem('activity_user_id');
      }

      // Create new session
      const response = await fetch('/api/activity/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const { sessionId: newSessionId } = await response.json();
        setSessionId(newSessionId);
        sessionStorage.setItem('activity_session_id', newSessionId);
        sessionStorage.setItem('activity_session_time', Date.now().toString());
        sessionStorage.setItem('activity_user_id', user.id); // Store user ID
        return newSessionId;
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
    }
    return null;
  };

  /**
   * End the current session
   */
  const endSession = async () => {
    // Get sessionId from state OR sessionStorage (in case state is stale during unmount)
    const currentSessionId = sessionId || sessionStorage.getItem('activity_session_id');

    if (!currentSessionId) {
      console.warn('No session ID to end');
      return;
    }

    console.log('🛑 Ending session:', currentSessionId);

    try {
      const response = await fetch('/api/activity/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId }),
      });

      if (!response.ok) {
        console.error('Failed to end session - server error:', await response.text());
      } else {
        console.log('✅ Session ended successfully');
      }
    } catch (error) {
      console.error('Failed to end session - network error:', error);
    } finally {
      // Always clear session data from storage, even if API call fails
      sessionStorage.removeItem('activity_session_id');
      sessionStorage.removeItem('activity_session_time');
      sessionStorage.removeItem('activity_user_id');
      console.log('🧹 Session storage cleared');
    }
  };

  // Initialize session on mount
  useEffect(() => {
    console.log('🚀 Session init effect:', { enabled, isInitialized: isInitializedRef.current });

    if (!enabled || isInitializedRef.current) return;

    isInitializedRef.current = true;
    console.log('📞 Calling initializeSession...');
    initializeSession().then(sid => {
      console.log('✅ Session initialized:', sid);
    });

    // End session when browser closes or tab navigates away
    const handleBeforeUnload = () => {
      const currentSessionId = sessionId || sessionStorage.getItem('activity_session_id');
      if (currentSessionId) {
        console.log('🚪 Browser closing/navigating, ending session with beacon');

        // Use sendBeacon for reliable delivery during page unload
        const data = JSON.stringify({ sessionId: currentSessionId });
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon('/api/activity/session', blob);

        // Clear storage
        sessionStorage.removeItem('activity_session_id');
        sessionStorage.removeItem('activity_session_time');
        sessionStorage.removeItem('activity_user_id');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on unmount
    return () => {
      console.log('👋 Component unmounting, ending session');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, [enabled]);

  // Set up heartbeat interval
  useEffect(() => {
    console.log('🔄 Heartbeat effect running:', { enabled, sessionId, isActive, isAudioPlaying });

    if (!enabled || !sessionId) {
      console.warn('⚠️ Heartbeat NOT starting:', { enabled, sessionId });
      return;
    }

    console.log('✅ Starting heartbeat timer (interval:', heartbeatInterval, 'ms)');

    // Start heartbeat timer
    heartbeatTimerRef.current = setInterval(() => {
      // Send heartbeat if user is active OR if audio is playing
      if (isActive || isAudioPlaying) {
        console.log('💓 Sending heartbeat...');
        sendHeartbeat();
      } else {
        console.log('⏸️ User inactive, skipping heartbeat');
      }
    }, heartbeatInterval);

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up heartbeat timer');
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [enabled, sessionId, isActive, isAudioPlaying, heartbeatInterval, pathname]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize inactivity timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });

      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [enabled]);

  // Track page views when pathname changes
  useEffect(() => {
    if (!enabled || !sessionId) return;

    // Track page view in background - don't block other tracking if this fails
    trackEvent('page_view', { path: pathname }).catch(err => {
      console.warn('Page view tracking failed (non-critical):', err);
    });
  }, [pathname, sessionId, enabled]);

  // Handle visibility change (tab switching)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsActive(false);
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
        }
      } else {
        setIsActive(true);
        resetInactivityTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  // Track audio playback
  useEffect(() => {
    if (!enabled) return;

    const handleAudioPlay = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      setIsAudioPlaying(true);
      setIsActive(true); // Keep user active during audio playback

      // Track audio play event
      if (sessionId) {
        trackEvent('audio_play', {
          audioSrc: audio.src,
          currentTime: audio.currentTime,
          duration: audio.duration,
        });
      }
    };

    const handleAudioPause = (e: Event) => {
      const audio = e.target as HTMLAudioElement;

      // Check if any other audio elements are still playing
      const allAudio = document.querySelectorAll('audio');
      const anyPlaying = Array.from(allAudio).some(a => !a.paused && a !== audio);

      if (!anyPlaying) {
        setIsAudioPlaying(false);
      }

      // Track audio pause event
      if (sessionId) {
        trackEvent('audio_pause', {
          audioSrc: audio.src,
          currentTime: audio.currentTime,
          duration: audio.duration,
        });
      }
    };

    const handleAudioEnded = (e: Event) => {
      const audio = e.target as HTMLAudioElement;

      // Check if any other audio elements are still playing
      const allAudio = document.querySelectorAll('audio');
      const anyPlaying = Array.from(allAudio).some(a => !a.paused && a !== audio);

      if (!anyPlaying) {
        setIsAudioPlaying(false);
      }

      // Track audio complete event
      if (sessionId) {
        trackEvent('audio_complete', {
          audioSrc: audio.src,
          duration: audio.duration,
        });
      }
    };

    // Listen for audio play/pause on all audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.addEventListener('play', handleAudioPlay);
      audio.addEventListener('pause', handleAudioPause);
      audio.addEventListener('ended', handleAudioEnded);
    });

    // Use MutationObserver to detect dynamically added audio elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLAudioElement) {
            node.addEventListener('play', handleAudioPlay);
            node.addEventListener('pause', handleAudioPause);
            node.addEventListener('ended', handleAudioEnded);
          } else if (node instanceof Element) {
            const audioElements = node.querySelectorAll('audio');
            audioElements.forEach(audio => {
              audio.addEventListener('play', handleAudioPlay);
              audio.addEventListener('pause', handleAudioPause);
              audio.addEventListener('ended', handleAudioEnded);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Cleanup
    return () => {
      audioElements.forEach(audio => {
        audio.removeEventListener('play', handleAudioPlay);
        audio.removeEventListener('pause', handleAudioPause);
        audio.removeEventListener('ended', handleAudioEnded);
      });
      observer.disconnect();
    };
  }, [enabled, sessionId]);

  // Keep user active while audio is playing
  useEffect(() => {
    if (isAudioPlaying) {
      setIsActive(true);
      resetInactivityTimer();
    }
  }, [isAudioPlaying]);

  // Listen for auth state changes and end session on logout
  useEffect(() => {
    if (!enabled) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        console.log('🔓 User signed out, ending session');
        endSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [enabled, sessionId]);

  return {
    isActive,
    sessionId,
    trackEvent,
    updateMetadata,
    sendHeartbeat,
    isAudioPlaying,
  };
}
