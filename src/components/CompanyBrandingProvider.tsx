'use client'

import { useEffect } from 'react'

interface CompanyBrandingProviderProps {
  primaryColor: string
  secondaryColor: string
  children: React.ReactNode
}

export function CompanyBrandingProvider({
  primaryColor,
  secondaryColor,
  children,
}: CompanyBrandingProviderProps) {
  useEffect(() => {
    // Set CSS variables on mount and when colors change
    document.documentElement.style.setProperty('--company-primary', primaryColor)
    document.documentElement.style.setProperty('--company-secondary', secondaryColor)

    // Cleanup on unmount
    return () => {
      document.documentElement.style.removeProperty('--company-primary')
      document.documentElement.style.removeProperty('--company-secondary')
    }
  }, [primaryColor, secondaryColor])

  return <>{children}</>
}
