/**
 * Conversation Segmentation Utility
 *
 * Detects individual conversation boundaries within door-to-door sales audio
 * by analyzing speaker changes. Sales rep (Speaker A) talking to different
 * customers (B, C, D...) indicates separate conversations.
 */

export interface Word {
  word: string
  start: number
  end: number
  speaker?: string
}

export interface ConversationSegment {
  conversationNumber: number
  startTime: number
  endTime: number
  speakers: string[]
  words: Word[]
  wordCount: number
  durationSeconds: number
}

/**
 * Main segmentation algorithm - IMPROVED for door-to-door sales
 *
 * Strategy:
 * - Speaker A is the sales rep
 * - Conversations must be at least 20 seconds (filters noise)
 * - Conversations must have at least 2 speakers (filters sales rep talking to self)
 * - Large gaps (30+ seconds) always create new conversation (walking between doors)
 * - Small gaps (3-30 seconds) create new conversation only for new customer
 * - Allows multiple customers at same door (spouse joining conversation)
 *
 * @param words - Array of words with speaker labels from AssemblyAI
 * @param salesRepSpeaker - Speaker ID for the sales rep (default: 'A')
 * @returns Array of conversation segments
 */
export function segmentConversations(
  words: Word[],
  salesRepSpeaker: string = 'A'
): ConversationSegment[] {
  if (!words || words.length === 0) {
    return []
  }

  // Configuration
  const MIN_CONVERSATION_DURATION = 20 // seconds - filters out door slams and errors
  const TIME_GAP_THRESHOLD = 3 // seconds - pause within same conversation
  const LARGE_GAP_THRESHOLD = 30 // seconds - definitely a new door (walking between houses)

  const conversations: ConversationSegment[] = []
  let currentConversation: Word[] = []
  let currentCustomerSpeakers = new Set<string>() // Track ALL customers at current door
  let conversationNumber = 0
  let lastWordEndTime = 0

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const speaker = word.speaker || salesRepSpeaker

    // Calculate time gap since last word
    const timeGap = currentConversation.length > 0 ? word.start - lastWordEndTime : 0

    // Detect conversation boundary
    const isNewConversation =
      currentConversation.length > 0 && (
        // LARGE gap = definitely new door (regardless of speaker)
        timeGap > LARGE_GAP_THRESHOLD ||
        // OR small gap + new customer speaker
        (
          timeGap > TIME_GAP_THRESHOLD &&
          speaker !== salesRepSpeaker &&
          !currentCustomerSpeakers.has(speaker)
        )
      )

    if (isNewConversation) {
      // Save the previous conversation
      conversationNumber++
      const segment = createConversationSegmentFromGroup(
        currentConversation,
        conversationNumber,
        salesRepSpeaker,
        Array.from(currentCustomerSpeakers)
      )

      // Only save if it meets minimum duration AND has at least 2 speakers
      // (filters out sales rep talking to himself between doors)
      if (segment.durationSeconds >= MIN_CONVERSATION_DURATION && segment.speakers.length >= 2) {
        conversations.push(segment)
      }

      // Start new conversation
      currentConversation = [word]
      currentCustomerSpeakers = new Set()
      if (speaker !== salesRepSpeaker) {
        currentCustomerSpeakers.add(speaker)
      }
    } else {
      // Continue current conversation
      currentConversation.push(word)
      if (speaker !== salesRepSpeaker) {
        currentCustomerSpeakers.add(speaker)
      }
    }

    lastWordEndTime = word.end
  }

  // Don't forget the last conversation
  if (currentConversation.length > 0) {
    conversationNumber++
    const segment = createConversationSegmentFromGroup(
      currentConversation,
      conversationNumber,
      salesRepSpeaker,
      Array.from(currentCustomerSpeakers)
    )

    // Only save if it meets minimum duration AND has at least 2 speakers
    // (filters out sales rep talking to himself between doors)
    if (segment.durationSeconds >= MIN_CONVERSATION_DURATION && segment.speakers.length >= 2) {
      conversations.push(segment)
    }
  }

  // Renumber conversations after filtering
  return conversations.map((conv, idx) => ({
    ...conv,
    conversationNumber: idx + 1
  }))
}

/**
 * Alternative segmentation strategy using silence gaps
 *
 * This can be used for audio files that have silence between conversations
 * (e.g., time walking between doors that wasn't edited out)
 *
 * @param words - Array of words with timestamps
 * @param silenceThresholdSeconds - Minimum silence duration to indicate new conversation
 * @returns Array of conversation segments
 */
export function segmentConversationsBySilence(
  words: Word[],
  silenceThresholdSeconds: number = 30
): ConversationSegment[] {
  if (!words || words.length === 0) {
    return []
  }

  const conversations: ConversationSegment[] = []
  let currentConversation: Word[] = [words[0]]
  let conversationNumber = 1

  for (let i = 1; i < words.length; i++) {
    const prevWord = words[i - 1]
    const currentWord = words[i]
    const gap = currentWord.start - prevWord.end

    if (gap > silenceThresholdSeconds) {
      // Silence gap detected - save current conversation and start new one
      if (currentConversation.length > 0) {
        conversations.push(createConversationSegmentFromWords(
          currentConversation,
          conversationNumber
        ))
        conversationNumber++
      }
      currentConversation = [currentWord]
    } else {
      currentConversation.push(currentWord)
    }
  }

  // Don't forget the last conversation
  if (currentConversation.length > 0) {
    conversations.push(createConversationSegmentFromWords(
      currentConversation,
      conversationNumber
    ))
  }

  return conversations
}

/**
 * Hybrid segmentation: Uses speaker changes first, then silence gaps as fallback
 *
 * Best of both worlds for handling edited and non-edited audio
 */
export function segmentConversationsHybrid(
  words: Word[],
  salesRepSpeaker: string = 'A',
  silenceThresholdSeconds: number = 30,
  options?: SegmentationOptions
): ConversationSegment[] {
  // manual_timestamps mode: rep provided exact start/end ranges. No detection,
  // no greeting heuristic — just slice the words by the given boundaries.
  if (options?.recordingType === 'manual_timestamps' && options.manualTimestamps?.length) {
    return segmentByManualTimestamps(words, options.manualTimestamps)
  }

  // edited_clips mode: skip speaker-based segmentation entirely.
  // AssemblyAI's diarization fails on tightly concatenated clips (different
  // customers get clustered into 2-3 speaker labels), so speaker changes are
  // unreliable. Instead use gap+greeting detection.
  if (options?.recordingType === 'edited_clips') {
    return segmentConversationsByGreetings(words, salesRepSpeaker, options)
  }

  // First, try speaker-based segmentation
  const hasSpeakerLabels = words.some(w => w.speaker !== undefined)

  if (hasSpeakerLabels) {
    const speakerSegments = segmentConversations(words, salesRepSpeaker)

    // If speaker-based segmentation found multiple conversations, use it
    if (speakerSegments.length > 1) {
      return speakerSegments
    }
  }

  // Fallback to silence-based segmentation
  return segmentConversationsBySilence(words, silenceThresholdSeconds)
}

/**
 * Options for segmentation. Used when the rep tags the upload as
 * 'edited_clips' (pre-cut clips concatenated with tiny gaps).
 */
export interface SegmentationOptions {
  recordingType?: 'continuous' | 'edited_clips' | 'manual_timestamps'
  // Sanity-check / calibration hints from the upload form. We use these
  // mostly for logging right now (so Duncan can spot when segmentation is
  // off), but `expectedCustomerCount` also drives a fallback that loosens
  // the greeting requirement if we're way under target.
  expectedCustomerCount?: number
  actualSalesCount?: number
  // For 'manual_timestamps' mode: explicit conversation boundaries in seconds.
  manualTimestamps?: Array<{ start: number; end: number }>
}

/**
 * Build conversation segments directly from explicit start/end ranges
 * (rep-provided timestamps). Words whose midpoint falls inside a range are
 * assigned to that conversation. Words outside all ranges are dropped.
 */
export function segmentByManualTimestamps(
  words: Word[],
  ranges: Array<{ start: number; end: number }>,
): ConversationSegment[] {
  if (!words || !words.length || !ranges.length) return []

  // Sort ranges by start time (parser already does this, but be defensive)
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const buckets: Word[][] = sorted.map(() => [])

  // Two-pointer walk: words and ranges are both ordered, so this is O(n+m).
  let ri = 0
  for (const w of words) {
    const mid = (w.start + w.end) / 2

    // Advance to the first range whose end is past `mid`
    while (ri < sorted.length && sorted[ri].end < mid) ri++
    if (ri >= sorted.length) break

    if (mid >= sorted[ri].start && mid <= sorted[ri].end) {
      buckets[ri].push(w)
    }
    // otherwise word is in the gap between ranges — drop it
  }

  const result: ConversationSegment[] = []
  for (let i = 0; i < buckets.length; i++) {
    const slice = buckets[i]
    const range = sorted[i]
    if (slice.length < 3) {
      console.warn(
        `[segmenter:manual] range ${i + 1} (${range.start.toFixed(1)}s-${range.end.toFixed(1)}s) has only ${slice.length} words — keeping anyway`
      )
    }

    const speakers = new Set<string>()
    slice.forEach(w => { if (w.speaker) speakers.add(w.speaker) })

    const startTime = slice.length ? slice[0].start : range.start
    const endTime   = slice.length ? slice[slice.length - 1].end : range.end

    result.push({
      conversationNumber: i + 1,
      startTime,
      endTime,
      speakers: Array.from(speakers),
      words: slice,
      wordCount: slice.length,
      durationSeconds: parseFloat((endTime - startTime).toFixed(2)),
    })
  }

  console.log(`[segmenter:manual] built ${result.length} conversations from rep-provided timestamps`)
  return result
}

// Words that strongly indicate the start of a new door interaction.
// Kept aggressive — false positives just make smaller conversations, false
// negatives merge separate conversations (much worse).
const GREETING_TOKENS = new Set([
  'hi', 'hey', 'hello', 'howdy', 'morning', 'afternoon', 'evening',
  'sir', "ma'am", 'maam', 'folks', 'neighbor',
])

// Bigram intro phrases (normalized lowercase, punctuation stripped).
const INTRO_PHRASES: string[][] = [
  ['good', 'morning'],
  ['good', 'afternoon'],
  ['good', 'evening'],
  ['how', 'are'],         // "how are you / yall / things"
  ['how', "you're"],      // "how you're doing"
  ['how', 'you'],         // "how you doing"
  ['how', 'is'],          // "how is it going"
  ['how', 'goes'],        // "how goes it"
  ['my', 'name'],         // sales rep intro: "my name is"
  ["i'm", 'with'],        // "I'm with [company]"
  ['im', 'with'],
  ["i'm", 'from'],
  ['im', 'from'],
  ['quick', 'question'],
  ['just', 'wanted'],
  ['real', 'quick'],
  ['can', 'i'],           // "can i ask you / get a minute"
  ['do', 'you'],          // "do you have a minute / live here"
  ['are', 'you'],         // "are you the homeowner / the owner"
  ['is', 'this'],         // "is this your house"
  ['sorry', 'to'],        // "sorry to bother"
]

function normToken(w: string): string {
  return w.toLowerCase().replace(/[^a-z']/g, '')
}

/**
 * Look ahead from index `start` and decide whether the next few words
 * look like a fresh door greeting / sales intro. Window is short (8 words)
 * because a real greeting almost always comes in the first phrase.
 */
function looksLikeGreeting(words: Word[], start: number, windowSize = 8): boolean {
  const window = words.slice(start, start + windowSize).map(w => normToken(w.word))

  for (const tok of window) {
    if (GREETING_TOKENS.has(tok)) return true
  }

  for (let i = 0; i < window.length - 1; i++) {
    for (const phrase of INTRO_PHRASES) {
      if (window[i] === phrase[0] && window[i + 1] === phrase[1]) return true
    }
  }

  return false
}

/**
 * Segmentation tuned for edited / concatenated clips with very small dead
 * time between conversations. Splits when:
 *   - There's at least a 2s gap, AND
 *   - The next words look like a greeting/intro
 *
 * If the resulting count is way below `expectedCustomerCount`, we relax the
 * greeting requirement and re-run with gap-only splits as a fallback. That
 * way the rep's reported customer count actually informs the result.
 */
export function segmentConversationsByGreetings(
  words: Word[],
  salesRepSpeaker: string = 'A',
  options?: SegmentationOptions
): ConversationSegment[] {
  if (!words || words.length === 0) return []

  const GAP_SECONDS = 2.0
  const MIN_DURATION = 10 // shorter floor — pre-edited clips can be brief
  const MIN_WORDS = 8

  const splitIndices: number[] = [0]

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end
    if (gap >= GAP_SECONDS && looksLikeGreeting(words, i)) {
      splitIndices.push(i)
    }
  }

  let segments = buildSegmentsFromSplits(words, splitIndices, MIN_DURATION, MIN_WORDS)

  // Calibration: if we found way fewer than expected, fall back to gap-only
  // (skip the greeting check). Threshold: <60% of expected.
  const expected = options?.expectedCustomerCount
  if (expected && expected > 0 && segments.length < Math.floor(expected * 0.6)) {
    console.log(
      `[segmenter:edited_clips] only ${segments.length} segments vs expected ${expected} — relaxing to gap-only`
    )
    const relaxed: number[] = [0]
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].start - words[i - 1].end
      if (gap >= GAP_SECONDS) relaxed.push(i)
    }
    segments = buildSegmentsFromSplits(words, relaxed, MIN_DURATION, MIN_WORDS)
  }

  console.log(
    `[segmenter:edited_clips] ${segments.length} segments` +
    (expected ? ` (expected ~${expected})` : '') +
    (options?.actualSalesCount !== undefined ? ` (reported sales: ${options.actualSalesCount})` : '')
  )

  return segments
}

function buildSegmentsFromSplits(
  words: Word[],
  splitIndices: number[],
  minDurationSeconds: number,
  minWords: number,
): ConversationSegment[] {
  const result: ConversationSegment[] = []
  let conversationNumber = 0

  for (let s = 0; s < splitIndices.length; s++) {
    const start = splitIndices[s]
    const end = s + 1 < splitIndices.length ? splitIndices[s + 1] : words.length
    const slice = words.slice(start, end)
    if (slice.length < minWords) continue

    const duration = slice[slice.length - 1].end - slice[0].start
    if (duration < minDurationSeconds) continue

    conversationNumber++
    const speakers = new Set<string>()
    slice.forEach(w => { if (w.speaker) speakers.add(w.speaker) })

    result.push({
      conversationNumber,
      startTime: slice[0].start,
      endTime: slice[slice.length - 1].end,
      speakers: Array.from(speakers),
      words: slice,
      wordCount: slice.length,
      durationSeconds: parseFloat(duration.toFixed(2)),
    })
  }

  return result.map((c, i) => ({ ...c, conversationNumber: i + 1 }))
}

/**
 * Helper: Create a conversation segment from words array with speaker group
 */
function createConversationSegmentFromGroup(
  words: Word[],
  conversationNumber: number,
  salesRepSpeaker: string,
  customerSpeakers: string[]
): ConversationSegment {
  // Build complete speaker list
  const speakers = [salesRepSpeaker, ...customerSpeakers]

  // Get all unique speakers from the words (safety check)
  const uniqueSpeakers = new Set<string>(speakers)
  words.forEach(w => {
    if (w.speaker) {
      uniqueSpeakers.add(w.speaker)
    }
  })

  return {
    conversationNumber,
    startTime: words[0].start,
    endTime: words[words.length - 1].end,
    speakers: Array.from(uniqueSpeakers),
    words,
    wordCount: words.length,
    durationSeconds: parseFloat((words[words.length - 1].end - words[0].start).toFixed(2))
  }
}

/**
 * Helper: Create a conversation segment from words array (legacy)
 */
function createConversationSegment(
  words: Word[],
  conversationNumber: number,
  salesRepSpeaker: string,
  customerSpeaker: string
): ConversationSegment {
  return createConversationSegmentFromGroup(
    words,
    conversationNumber,
    salesRepSpeaker,
    [customerSpeaker]
  )
}

/**
 * Helper: Create conversation segment without speaker info
 */
function createConversationSegmentFromWords(
  words: Word[],
  conversationNumber: number
): ConversationSegment {
  const uniqueSpeakers = new Set<string>()
  words.forEach(w => {
    if (w.speaker) {
      uniqueSpeakers.add(w.speaker)
    }
  })

  return {
    conversationNumber,
    startTime: words[0].start,
    endTime: words[words.length - 1].end,
    speakers: Array.from(uniqueSpeakers),
    words,
    wordCount: words.length,
    durationSeconds: parseFloat((words[words.length - 1].end - words[0].start).toFixed(2))
  }
}

/**
 * Utility: Get conversation text from segment
 */
export function getConversationText(segment: ConversationSegment): string {
  return segment.words.map(w => w.word).join(' ')
}

/**
 * Utility: Check if a PII match falls within conversation timeframe
 */
export function isPiiInConversation(
  piiMatch: { start: number; end: number },
  conversation: ConversationSegment
): boolean {
  // Check if there's any overlap
  return piiMatch.start < conversation.endTime && piiMatch.end > conversation.startTime
}

/**
 * Utility: Count PII redactions within a conversation
 */
export function countPiiInConversation(
  piiMatches: Array<{ start: number; end: number }>,
  conversation: ConversationSegment
): number {
  return piiMatches.filter(pii => isPiiInConversation(pii, conversation)).length
}

/**
 * Utility: Find the timestamp where a specific text snippet occurs in a conversation
 * Returns the start time of the first word in the matching phrase, or null if not found
 */
export function findTextTimestamp(
  textSnippet: string,
  conversationWords: Word[]
): number | null {
  if (!textSnippet || !conversationWords || conversationWords.length === 0) {
    return null
  }

  // Normalize text for comparison (lowercase, trim)
  const normalizedSnippet = textSnippet.toLowerCase().trim()
  const snippetWords = normalizedSnippet.split(/\s+/)

  // Try to find a sequence of words that matches the snippet
  for (let i = 0; i <= conversationWords.length - snippetWords.length; i++) {
    const windowWords = conversationWords.slice(i, i + snippetWords.length)
    const windowText = windowWords.map(w => w.word.toLowerCase().replace(/[^\w\s]/g, '')).join(' ')
    const snippetText = snippetWords.join(' ')

    // Check if this window matches the snippet (fuzzy match - allows punctuation differences)
    if (windowText.includes(snippetText) || snippetText.includes(windowText)) {
      // Return timestamp 2 seconds before the objection for better context
      // This helps ensure we don't miss the beginning of the objection
      return Math.max(0, windowWords[0].start - 2000)
    }
  }

  // Fallback: try a simpler word-by-word match
  const firstSnippetWord = snippetWords[0]
  for (let i = 0; i < conversationWords.length; i++) {
    const word = conversationWords[i].word.toLowerCase().replace(/[^\w\s]/g, '')
    if (word.includes(firstSnippetWord) || firstSnippetWord.includes(word)) {
      // Also add buffer for fallback match
      return Math.max(0, conversationWords[i].start - 2000)
    }
  }

  return null
}
