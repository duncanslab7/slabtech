import Anthropic from '@anthropic-ai/sdk'
import { validatePiiRanges, detectPiiMatches } from '@/utils/pii'
import type { PiiMatch } from '@/utils/pii'
import { mergeRanges } from '@/utils/ffmpegRedaction'

export type { PiiMatch }

export type AssemblyAIEntity = {
  entity_type: string
  text: string
  start: number // milliseconds
  end: number   // milliseconds
}

export type WordEntry = {
  word: string
  start: number // seconds
  end: number   // seconds
  speaker?: string
}

// Matches AssemblyAI redaction labels like [CREDIT_CARD_NUMBER]
export const ASSEMBLY_PII_PATTERN = /^\[([A-Za-z_]+)\]$/

const NUMBER_WORDS = new Set([
  'zero','one','two','three','four','five','six','seven','eight','nine',
  'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
  'seventeen','eighteen','nineteen','twenty','thirty','forty','fifty',
  'sixty','seventy','eighty','ninety','hundred','thousand','oh',
])

function isNumberWord(word: string): boolean {
  const cleaned = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  return NUMBER_WORDS.has(cleaned) || /^\d+$/.test(cleaned)
}

// Pass 1a: use AssemblyAI's entities array (most reliable PII timestamps)
export function extractEntityPiiMatches(entities: AssemblyAIEntity[]): PiiMatch[] {
  return entities.map(e => ({
    start: e.start / 1000,
    end: e.end / 1000,
    label: e.entity_type,
  }))
}

// Pass 1b: scan word array for [ENTITY_TYPE] labels (fallback)
export function extractAssemblyPiiMatches(words: WordEntry[]): PiiMatch[] {
  const matches: PiiMatch[] = []
  for (const word of words) {
    const clean = word.word.replace(/[^[\]A-Za-z_]/g, '')
    if (ASSEMBLY_PII_PATTERN.test(clean)) {
      matches.push({ start: word.start, end: word.end, label: clean.slice(1, -1).toLowerCase() })
    }
  }
  return matches
}

// Pass 3: catch sequences of 3+ consecutive number words (spoken credit cards, phones, etc.)
export function findNumberSequences(words: WordEntry[], minLength = 3): PiiMatch[] {
  const matches: PiiMatch[] = []
  let seqStart = -1
  for (let i = 0; i < words.length; i++) {
    if (isNumberWord(words[i].word)) {
      if (seqStart === -1) seqStart = i
    } else {
      if (seqStart !== -1) {
        if (i - seqStart >= minLength) {
          matches.push({ start: words[seqStart].start, end: words[i - 1].end, label: 'numbers' })
        }
        seqStart = -1
      }
    }
  }
  if (seqStart !== -1 && words.length - seqStart >= minLength) {
    matches.push({ start: words[seqStart].start, end: words[words.length - 1].end, label: 'numbers' })
  }
  return matches
}

// Pass 4: detect spelled-out emails / addresses ("A N G E L dot com")
export function findSpelledOutMatches(words: WordEntry[]): PiiMatch[] {
  const matches: PiiMatch[] = []
  const FILLER = new Set(['dot', 'at', 'underscore', 'dash', 'hyphen', 'period'])

  let i = 0
  while (i < words.length) {
    const w = words[i].word.toLowerCase().replace(/[^a-z0-9]/g, '')
    const isSingleLetter = w.length === 1 && /[a-z]/.test(w)
    const isFiller = FILLER.has(words[i].word.toLowerCase().replace(/[^a-z]/g, ''))
    const isDotCom = ['com', 'net', 'org', 'io'].includes(w) && i > 0 &&
      FILLER.has(words[i - 1]?.word.toLowerCase().replace(/[^a-z]/g, '') || '')

    if (isSingleLetter || isFiller || isDotCom) {
      const seqStart = i
      let letterCount = isSingleLetter ? 1 : 0

      while (i < words.length) {
        const next = words[i].word.toLowerCase().replace(/[^a-z0-9]/g, '')
        const isLetter = next.length === 1 && /[a-z]/.test(next)
        const isFill = FILLER.has(words[i].word.toLowerCase().replace(/[^a-z]/g, ''))
        const isDC = ['com', 'net', 'org', 'io'].includes(next)

        if (isLetter) letterCount++
        if (isLetter || isFill || isDC) { i++ } else { break }
      }

      if (letterCount >= 4) {
        matches.push({ start: words[seqStart].start, end: words[i - 1].end, label: 'spelled_pii' })
      }
    } else {
      i++
    }
  }
  return matches
}

// For mapping Claude-detected phrases back to timestamps
export function findPhraseTimestamps(
  phrase: string,
  words: WordEntry[]
): { start: number; end: number } | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
  const phraseTokens = normalize(phrase).split(' ').filter(Boolean)
  if (!phraseTokens.length) return null

  for (let i = 0; i <= words.length - phraseTokens.length; i++) {
    if (ASSEMBLY_PII_PATTERN.test(words[i].word)) continue
    let matched = 0
    for (let j = 0; j < phraseTokens.length; j++) {
      if (normalize(words[i + j]?.word || '') === phraseTokens[j]) matched++
    }
    if (matched / phraseTokens.length >= 0.85) {
      return { start: words[i].start, end: words[i + phraseTokens.length - 1].end }
    }
  }
  return null
}

// Pass 5: Claude secondary review on the already-partially-redacted transcript
export async function claudeSecondaryPiiCheck(
  redactedText: string,
  words: WordEntry[],
  anthropicApiKey: string
): Promise<PiiMatch[]> {
  // Hard timeout + no retries: must never stall the pipeline. For very long
  // transcripts (3+ hours) this single call can hit token limits and stall.
  const anthropic = new Anthropic({
    apiKey: anthropicApiKey,
    timeout: 45 * 1000,
    maxRetries: 0,
  })

  const prompt = `You are a privacy compliance reviewer for a door-to-door sales call transcript. AssemblyAI already redacted obvious PII (shown as [ENTITY_TYPE] markers). Your job is to find anything else that slipped through.

TRANSCRIPT:
${redactedText}

Find ALL remaining sensitive info not already marked as [ENTITY_TYPE]:
- Phone numbers (full OR partial, e.g. "998-781-3" or "509")
- Email addresses — including when spelled letter by letter (e.g. "A N G E L I Q U E dot simone at gmail dot com")
- Street addresses (house number + street name, e.g. "71 Spring Haven" or "4521 Oak Drive")
- Credit card, SSN, bank account, routing numbers
- Any sequence of letters/numbers that looks like it's being spelled out character by character

CRITICAL: Return the EXACT VERBATIM text as it appears in the transcript above (including spaces between letters if spelled out). Do NOT normalize or interpret the spelling — copy it word-for-word.

Return ONLY valid JSON:
[{"phrase": "exact verbatim phrase from transcript", "label": "phone|email|address|credit_card|ssn|bank|other"}]

If nothing found: []`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ phrase: string; label: string }>
    const matches: PiiMatch[] = []

    for (const item of parsed) {
      if (!item.phrase) continue
      const timestamps = findPhraseTimestamps(item.phrase, words)
      if (timestamps) {
        matches.push({ start: timestamps.start, end: timestamps.end, label: item.label || 'pii' })
      } else {
        console.warn(`Claude found PII phrase but could not map to timestamp: "${item.phrase}"`)
      }
    }

    console.log(`Claude secondary check: found ${matches.length} additional PII matches`)
    return matches
  } catch (err) {
    console.error('Claude secondary PII check failed:', err)
    return []
  }
}

// Master function — runs all five passes and returns merged, validated ranges
export async function runFullPiiDetection(
  transcriptText: string,
  words: WordEntry[],
  entities: AssemblyAIEntity[] | undefined,
  anthropicApiKey?: string
): Promise<PiiMatch[]> {
  const audioDuration = words.length > 0 ? words[words.length - 1].end : 0

  const entityMatches  = entities?.length ? extractEntityPiiMatches(entities) : []
  const wordMatches    = extractAssemblyPiiMatches(words)
  const regexMatches   = detectPiiMatches(words, 'all')
  const numberMatches  = findNumberSequences(words)
  const spelledMatches = findSpelledOutMatches(words)

  console.log(`PII passes — entities:${entityMatches.length} words:${wordMatches.length} regex:${regexMatches.length} numbers:${numberMatches.length} spelled:${spelledMatches.length}`)

  let claudeMatches: PiiMatch[] = []
  if (anthropicApiKey) {
    claudeMatches = await claudeSecondaryPiiCheck(transcriptText, words, anthropicApiKey)
    console.log(`Claude secondary: ${claudeMatches.length} matches`)
  }

  const merged = mergeRanges([
    ...entityMatches, ...wordMatches, ...regexMatches,
    ...numberMatches, ...spelledMatches, ...claudeMatches,
  ])
  const validated = validatePiiRanges(merged, audioDuration)
  console.log(`PII total: ${validated.length} validated ranges`)
  return validated
}
