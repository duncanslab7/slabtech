'use client'

import Link from 'next/link'
import { useState } from 'react'

interface CompanyNavProps {
  slug: string
  isCompanyAdmin: boolean
  primaryColor: string
  secondaryColor: string
}

export function CompanyNav({ slug, isCompanyAdmin, primaryColor, secondaryColor }: CompanyNavProps) {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)

  const getLinkStyle = (linkName: string) => ({
    color: hoveredLink === linkName ? primaryColor : secondaryColor,
    transition: 'color 0.2s',
  })

  return (
    <div className="hidden md:flex items-center gap-6">
      <Link
        href={`/c/${slug}/dashboard`}
        style={getLinkStyle('dashboard')}
        onMouseEnter={() => setHoveredLink('dashboard')}
        onMouseLeave={() => setHoveredLink(null)}
      >
        Dashboard
      </Link>
      {isCompanyAdmin && (
        <>
          <Link
            href={`/c/${slug}/users`}
            style={getLinkStyle('users')}
            onMouseEnter={() => setHoveredLink('users')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            Users
          </Link>
          <Link
            href={`/c/${slug}/usage`}
            style={getLinkStyle('usage')}
            onMouseEnter={() => setHoveredLink('usage')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            Usage
          </Link>
          <Link
            href={`/c/${slug}/leaderboard`}
            style={getLinkStyle('leaderboard')}
            onMouseEnter={() => setHoveredLink('leaderboard')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            Leaderboard
          </Link>
        </>
      )}
    </div>
  )
}
