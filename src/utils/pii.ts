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
  // Accept 7-15 digit phone patterns with separators (handles malformed numbers)
  phone:
    /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4,5}|\d{3}[\s.-]?\d{4,5}|\d{7,15})\b/,
  ssn: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/,
  credit_card: /\b(?:\d[ -]*?){13,16}\b/,
  url: /\bhttps?:\/\/[^\s]+/i,
  // Match number + street name (with or without suffix)
  // Examples: "1908 Cottonwood", "123 Main Street"
  address:
    /\b\d{1,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|cir|circle|way|pkwy|parkway|terrace|ter|pl|place))?\b/i,
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

  // Multi-word phone detection: scan 2-8 word windows and test combined strings
  if (shouldUseField('phone', piiConfig)) {
    const maxWindow = 8
    for (let i = 0; i < words.length; i++) {
      let combined = ''
      let start = words[i].start
      let end = words[i].end
      let digitsOnly = ''

      for (let w = 0; w < maxWindow && i + w < words.length; w++) {
        const segment = (words[i + w].word || '').trim()
        if (segment) {
          combined = combined ? `${combined} ${segment}` : segment
          end = words[i + w].end
        }

        digitsOnly = combined.replace(/\D/g, '')

        // Check if we have 7-15 digits (flexible phone number detection)
        if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
          // Test if it matches phone pattern OR just has enough digits in sequence
          if (regexes.phone.test(combined) || digitsOnly.length >= 10) {
            addMatch(start, end, 'phone')
            i += w // Skip past this match
            break
          }
        }

        // Stop if too many digits
        if (digitsOnly.length > 15) {
          break
        }
      }
    }
  }

  // Multi-word credit card detection: scan 10-20 word windows for digit sequences
  if (shouldUseField('credit_card', piiConfig)) {
    const maxWindow = 20 // Credit cards can be spoken slowly with filler words
    for (let i = 0; i < words.length; i++) {
      let start = words[i].start
      let end = words[i].end
      let digitsOnly = ''

      for (let w = 0; w < maxWindow && i + w < words.length; w++) {
        const segment = (words[i + w].word || '').trim()
        end = words[i + w].end

        // Extract digits from this word
        const wordDigits = segment.replace(/\D/g, '')
        if (wordDigits) {
          digitsOnly += wordDigits
        }

        // Check if we have a valid credit card length (13-16 digits)
        if (digitsOnly.length >= 13 && digitsOnly.length <= 16) {
          addMatch(start, end, 'credit_card')
          // Skip past this match
          i += w
          break
        }

        // Stop if we've gone too far without enough digits
        if (digitsOnly.length > 16) {
          break
        }
      }
    }
  }

  // Multi-word address/location detection: scan 2-6 word windows
  // Catches patterns like "1908 Cottonwood" or "123 Main Street"
  if (shouldUseField('address', piiConfig)) {
    const maxWindow = 6
    for (let i = 0; i < words.length; i++) {
      // Skip if this word doesn't start with a number
      const firstWord = (words[i].word || '').trim()
      if (!/^\d{1,6}$/.test(firstWord)) {
        continue
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

        // Check if matches address pattern
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
