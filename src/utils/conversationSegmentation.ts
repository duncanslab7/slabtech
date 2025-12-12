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
  silenceThresholdSeconds: number = 30
): ConversationSegment[] {
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
