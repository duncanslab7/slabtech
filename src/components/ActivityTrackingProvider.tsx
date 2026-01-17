'use client';

import { useActivityTracking } from '@/hooks/useActivityTracking';

interface ActivityTrackingProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that enables activity tracking for all child components
 * Add this to layouts where you want to track user activity
 */
export function ActivityTrackingProvider({ children }: ActivityTrackingProviderProps) {
  // Initialize activity tracking for all authenticated pages
  useActivityTracking({
    heartbeatInterval: 30000, // 30 seconds
    inactivityThreshold: 120000, // 2 minutes
    enabled: true,
  });

  // This component doesn't render anything, just enables tracking
  return <>{children}</>;
}
