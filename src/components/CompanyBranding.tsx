'use client'

import { useEffect } from 'react'
import { useCompany } from '@/hooks/useCompany'

/**
 * CompanyBrandingProvider injects company-specific CSS variables
 * for theming the application based on the company's branding.
 *
 * Usage:
 * <CompanyBrandingProvider companySlug="acme-corp">
 *   <YourAppContent />
 * </CompanyBrandingProvider>
 */
export function CompanyBrandingProvider({
  companySlug,
  children,
}: {
  companySlug: string
  children: React.ReactNode
}) {
  const { company, loading } = useCompany(companySlug)

  useEffect(() => {
    if (company) {
      // Inject CSS variables for company branding
      document.documentElement.style.setProperty('--company-primary', company.primaryColor)
      document.documentElement.style.setProperty('--company-secondary', company.secondaryColor)
    }

    // Cleanup on unmount
    return () => {
      document.documentElement.style.removeProperty('--company-primary')
      document.documentElement.style.removeProperty('--company-secondary')
    }
  }, [company])

  // Render children immediately - CSS variables will update when company loads
  return <>{children}</>
}
