export type PiiMatch = {
  start: number
  end: number
  label: string
}

type WordLike = {
  word: string
  start: number
  end: number
}

const regexes: Record<string, RegExp> = {
  email: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  // Stricter phone pattern: must have clear structure with separators or parentheses
  // Matches: (555) 123-4567, 555-123-4567, +1 555-123-4567
  // Does NOT match: random 10 digit sequences like timestamps
  phone:
    /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})\b/,
  ssn: /\b\d{3}[- ]\d{2}[- ]\d{4}\b/,
  // More precise credit card: must start with known BIN prefix (4, 5, 37, 6) and have separators
  // Matches: 4532 1234 5678 9010, 5425-2334-3010-9903
  // Does NOT match: random 16 digit sequences
  credit_card: /\b(?:4\d{3}|5[1-5]\d{2}|37\d{2}|6\d{3})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  url: /\bhttps?:\/\/[^\s]+/i,
  // Stricter address: exclude year-like numbers (19xx, 20xx) to avoid false positives
  // Matches: "123 Main Street", "456 Oak Avenue"
  // Does NOT match: "2008 Main Street" (year reference)
  address:
    /\b(?!(?:19|20)\d{2}\b)\d{1,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|cir|circle|way|pkwy|parkway|terrace|ter|pl|place))?\b/i,
  // City, ST [ZIP]
  city_state: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?\b/,
}

const aliasMap: Record<string, Set<string>> = {
  phone: new Set(['phone', 'phone_number', 'phone-number', 'phone number']),
  credit_card: new Set(['credit_card', 'credit card', 'credit_card_number', 'credit card number']),
  address: new Set(['address', 'location', 'location_address', 'location address']),
  person_name: new Set(['person_name', 'name', 'person name']),
  email: new Set(['email', 'email_address', 'email address']),
  ssn: new Set(['ssn', 'social_security', 'us_social_security_number']),
  url: new Set(['url', 'link']),
}

function shouldUseField(field: string, piiConfig: string) {
  if (piiConfig === 'all') return true
  const parts = piiConfig
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  const aliases = aliasMap[field] || new Set([field])
  return parts.some((p) => aliases.has(p))
}

export function detectPiiMatches(words: WordLike[], piiConfig: string): PiiMatch[] {
  if (!words.length) return []

  const matches: PiiMatch[] = []

  const addMatch = (start: number, end: number, label: string) => {
    matches.push({ start, end, label })
  }

  for (const word of words) {
    const value = (word.word || '').trim()
    if (!value) continue

    if (shouldUseField('email', piiConfig) && regexes.email.test(value)) {
      addMatch(word.start, word.end, 'email')
      continue
    }
    if (shouldUseField('phone', piiConfig) && regexes.phone.test(value)) {
      addMatch(word.start, word.end, 'phone')
      continue
    }
    if (shouldUseField('ssn', piiConfig) && regexes.ssn.test(value)) {
      addMatch(word.start, word.end, 'ssn')
      continue
    }
    if (shouldUseField('credit_card', piiConfig) && regexes.credit_card.test(value)) {
      addMatch(word.start, word.end, 'credit_card')
      continue
    }
    if (shouldUseField('url', piiConfig) && regexes.url.test(value)) {
      addMatch(word.start, word.end, 'url')
      continue
    }
    if (shouldUseField('address', piiConfig) && regexes.address.test(value)) {
      addMatch(word.start, word.end, 'address')
      continue
    }
  }

  // Lightweight name detection: two consecutive capitalized words (e.g., "John Smith")
  if (shouldUseField('person_name', piiConfig)) {
    const isNameish = (w: string) => /^[A-Z][a-z]{2,}$/.test(w || '')
    for (let i = 0; i < words.length - 1; i++) {
      const first = words[i]
      const second = words[i + 1]
      if (isNameish(first.word) && isNameish(second.word)) {
        addMatch(first.start, second.end, 'person_name')
        i++ // skip overlapping pairs
      }
    }
  }

  // Multi-word phone detection: scan 2-6 word windows for structured phone patterns
  // Only matches if the combined text has clear phone structure (not just 10 random digits)
  if (shouldUseField('phone', piiConfig)) {
    const maxWindow = 6 // Reduced from 8 - phones shouldn't span that many words
    for (let i = 0; i < words.length; i++) {
      let combined = ''
      let start = words[i].start
      let end = words[i].end

      for (let w = 0; w < maxWindow && i + w < words.length; w++) {
        const segment = (words[i + w].word || '').trim()
        if (segment) {
          combined = combined ? `${combined} ${segment}` : segment
          end = words[i + w].end
        }

        // Only match if it has clear phone structure with separators
        if (regexes.phone.test(combined)) {
          addMatch(start, end, 'phone')
          i += w // Skip past this match
          break
        }

        // Stop early if we're accumulating too many characters without a match
        if (combined.length > 30) {
          break
        }
      }
    }
  }

  // Multi-word credit card detection: scan 8-12 word windows for structured card patterns
  // Requires first digit to be valid BIN prefix (4, 5, 37, 6) and consistent 4-digit grouping
  if (shouldUseField('credit_card', piiConfig)) {
    const maxWindow = 12 // Reduced from 20 - cards should be spoken in ~4 groups
    for (let i = 0; i < words.length; i++) {
      let combined = ''
      let start = words[i].start
      let end = words[i].end
      let digitGroups: string[] = []

      for (let w = 0; w < maxWindow && i + w < words.length; w++) {
        const segment = (words[i + w].word || '').trim()
        if (segment) {
          combined = combined ? `${combined} ${segment}` : segment
          end = words[i + w].end
        }

        // Extract digit groups (sequences of 3-4 digits)
        const wordDigits = segment.replace(/\D/g, '')
        if (wordDigits.length >= 3 && wordDigits.length <= 4) {
          digitGroups.push(wordDigits)
        }

        // Check if combined text matches credit card pattern
        if (regexes.credit_card.test(combined)) {
          addMatch(start, end, 'credit_card')
          i += w
          break
        }

        // Check if we have 4 groups of 4 digits (typical card format)
        if (digitGroups.length === 4 && digitGroups.every(g => g.length === 4)) {
          const firstDigit = digitGroups[0][0]
          // Validate BIN prefix (Visa=4, MC=5, Amex=3, Discover=6)
          if (['4', '5', '3', '6'].includes(firstDigit)) {
            addMatch(start, end, 'credit_card')
            i += w
            break
          }
        }

        // Stop if we've accumulated too many characters without a match
        if (combined.length > 50 || digitGroups.length > 5) {
          break
        }
      }
    }
  }

  // Multi-word address/location detection: scan 2-6 word windows
  // Catches patterns like "123 Main Street" but excludes year references like "2008 Main"
  if (shouldUseField('address', piiConfig)) {
    const maxWindow = 6
    for (let i = 0; i < words.length; i++) {
      const firstWord = (words[i].word || '').trim()

      // Skip if not a number, or if it's a year (19xx or 20xx)
      if (!/^\d{1,6}$/.test(firstWord)) {
        continue
      }

      const num = parseInt(firstWord, 10)
      if ((num >= 1900 && num <= 2099) || num > 99999) {
        continue // Skip years and unrealistic street numbers
      }

      let combined = ''
      let start = words[i].start
      let end = words[i].end

      for (let w = 0; w < maxWindow && i + w < words.length; w++) {
        const segment = (words[i + w].word || '').trim()
        if (segment) {
          combined = combined ? `${combined} ${segment}` : segment
          end = words[i + w].end
        }

        // Check if matches address pattern (already has year exclusion in regex)
        const hasStreet = regexes.address.test(combined)
        const hasCityState = regexes.city_state.test(combined)

        if (hasStreet || hasCityState) {
          addMatch(start, end, 'address')
          i += w // Skip past this match
          break
        }
      }
    }
  }

  return matches
}

/**
 * Validates and clamps PII ranges to ensure they're within audio bounds.
 * This prevents FFmpeg errors from attempting to process timestamps beyond audio duration.
 *
 * @param matches - Array of PII matches to validate
 * @param audioDuration - Total audio duration in seconds (typically from last word's end time)
 * @returns Validated array of PII matches with clamped timestamps
 */
export function validatePiiRanges(matches: PiiMatch[], audioDuration: number): PiiMatch[] {
  if (!matches.length || audioDuration <= 0) return matches

  const validated: PiiMatch[] = []

  for (const match of matches) {
    // Skip invalid ranges
    if (match.start < 0 || match.end < 0 || match.start >= match.end) {
      console.warn(`Skipping invalid PII range: ${match.start}-${match.end}`)
      continue
    }

    // Skip ranges that start beyond audio duration
    if (match.start >= audioDuration) {
      console.warn(`Skipping PII range beyond audio duration: ${match.start}-${match.end} (duration: ${audioDuration})`)
      continue
    }

    // Clamp end time to audio duration if it exceeds
    const clampedEnd = Math.min(match.end, audioDuration)

    if (clampedEnd !== match.end) {
      console.warn(`Clamping PII range end from ${match.end} to ${clampedEnd} (duration: ${audioDuration})`)
    }

    validated.push({
      ...match,
      end: clampedEnd
    })
  }

  return validated
}
