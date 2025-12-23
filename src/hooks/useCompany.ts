'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Company {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
}

/**
 * Hook to fetch and manage company data by slug
 *
 * @param companySlug - The URL-friendly company identifier
 * @returns Company data, loading state, and error
 */
export function useCompany(companySlug: string) {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadCompany() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('companies')
          .select('id, name, slug, logo_url, primary_color, secondary_color')
          .eq('slug', companySlug)
          .eq('is_active', true)
          .single()

        if (fetchError) {
          throw fetchError
        }

        if (data) {
          setCompany({
            id: data.id,
            name: data.name,
            slug: data.slug,
            logoUrl: data.logo_url,
            primaryColor: data.primary_color,
            secondaryColor: data.secondary_color,
          })
        }
      } catch (err) {
        console.error('Error loading company:', err)
        setError(err instanceof Error ? err.message : 'Failed to load company')
      } finally {
        setLoading(false)
      }
    }

    if (companySlug) {
      loadCompany()
    }
  }, [companySlug])

  return { company, loading, error }
}
