import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

import Anthropic from '@anthropic-ai/sdk'
import { validatePiiRanges, detectPiiMatches } from '@/utils/pii'
import type { PiiMatch } from '@/utils/pii'
import { mergeRanges, runFfmpegBleep } from '@/utils/ffmpegRedaction'
import { createClient } from '@/utils/supabase/server'
import { checkRateLimit } from '@/utils/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import {
  segmentConversationsHybrid,
  getConversationText,
  countPiiInConversation,
  findTextTimestamp
} from '@/utils/conversationSegmentation'
import { analyzeConversation } from '@/utils/conversationAnalysis'

// Route segment config to allow large file uploads
export const maxDuration = 300 // 5 minutes max execution time
export const dynamic = 'force-dynamic'
export const bodyParser = {
  sizeLimit: '400mb',
}

type AssemblyAIWord = {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string
}

type AssemblyAIEntity = {
  entity_type: string
  text: string
  start: number  // milliseconds
  end: number    // milliseconds
}

type AssemblyAITranscript = {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error' | 'terminated'
  text: string
  words: AssemblyAIWord[]
  entities?: AssemblyAIEntity[]
  error?: string
}

const DEFAULT_FETCH_TIMEOUT_MS = 600_000 // 10 minutes
const POLLING_INTERVAL_MS = 3000 // 3 seconds

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal })
    return resp
  } finally {
    clearTimeout(timer)
  }
}

async function uploadToAssemblyAI(audioUrl: string, apiKey: string): Promise<string> {
  // Upload audio file to AssemblyAI
  const uploadResponse = await fetchWithTimeout(
    'https://api.assemblyai.com/v2/upload',
    {
      method: 'POST',
      headers: {
        authorization: apiKey,
      },
      body: await (await fetch(audioUrl)).arrayBuffer(),
    },
    60_000
  )

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text()
    throw new Error(`AssemblyAI upload failed: ${error}`)
  }

  const { upload_url } = await uploadResponse.json()
  return upload_url
}

async function createTranscript(
  audioUrl: string,
  apiKey: string
): Promise<string> {
  const response = await fetchWithTimeout(
    'https://api.assemblyai.com/v2/transcript',
    {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speaker_labels: true,
        // AssemblyAI ML-based PII redaction — replaces detected PII in transcript text/words
        // with [ENTITY_TYPE] labels (e.g. [CREDIT_CARD_NUMBER]) so we know exact timestamps
        redact_pii: true,
        redact_pii_sub: 'entity_name',
        redact_pii_policies: [
          'credit_card_number',
          'credit_card_cvv',
          'credit_card_expiration',
          'phone_number',
          'us_social_security_number',
          'banking_information',
          'email_address',
          'location',
        ],
      }),
    },
    30_000
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AssemblyAI transcript creation failed: ${error}`)
  }

  const { id } = await response.json()
  return id
}

async function pollTranscript(transcriptId: string, apiKey: string): Promise<AssemblyAITranscript> {
  while (true) {
    const response = await fetchWithTimeout(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        method: 'GET',
        headers: {
          authorization: apiKey,
        },
      },
      30_000
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AssemblyAI polling failed: ${error}`)
    }

    const transcript: AssemblyAITranscript = await response.json()

    if (transcript.status === 'completed') {
      return transcript
    } else if (transcript.status === 'error' || transcript.status === 'terminated') {
      const errorMsg = transcript.error || 'Transcription was terminated by AssemblyAI'
      throw new Error(`AssemblyAI transcription failed: ${errorMsg}. This may happen if the audio format is unsupported or corrupted.`)
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS))
  }
}

// Pattern that matches AssemblyAI entity labels like [CREDIT_CARD_NUMBER], [phone_number], etc.
// Case-insensitive — AssemblyAI may return uppercase or lowercase entity names
const ASSEMBLY_PII_PATTERN = /^\[([A-Za-z_]+)\]$/

type WordEntry = { word: string; start: number; end: number; speaker?: string }

// Extract PII timestamp ranges from AssemblyAI's entities array (most reliable source).
// AssemblyAI returns detected PII entities with exact start/end timestamps in milliseconds.
function extractEntityPiiMatches(entities: AssemblyAIEntity[]): PiiMatch[] {
  return entities.map(e => ({
    start: e.start / 1000,
    end: e.end / 1000,
    label: e.entity_type,
  }))
}

// Extract PII timestamp ranges from AssemblyAI's word array (fallback).
// When redact_pii is enabled, AssemblyAI replaces PII words with [ENTITY_TYPE] labels.
// Strip trailing punctuation first — AssemblyAI sometimes appends "." or "," to the label.
function extractAssemblyPiiMatches(words: WordEntry[]): PiiMatch[] {
  const matches: PiiMatch[] = []
  for (const word of words) {
    const clean = word.word.replace(/[^[\]A-Za-z_]/g, '') // strip everything except letters, underscores, brackets
    if (ASSEMBLY_PII_PATTERN.test(clean)) {
      matches.push({ start: word.start, end: word.end, label: clean.slice(1, -1).toLowerCase() })
    }
  }
  return matches
}

// Spoken number words — used to detect spoken credit card / phone / SSN sequences
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

// Catch any sequence of 3+ consecutive number words (spoken credit cards, phone numbers, etc.)
// Fallback for when AssemblyAI's ML model misses spoken PII
function findNumberSequences(words: WordEntry[], minLength = 3): PiiMatch[] {
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

// Find where a phrase appears in the words array (for mapping Claude findings to timestamps).
// Returns the start/end timestamps of the matched word sequence.
function findPhraseTimestamps(phrase: string, words: WordEntry[]): { start: number; end: number } | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
  const phraseTokens = normalize(phrase).split(' ').filter(Boolean)
  if (!phraseTokens.length) return null

  for (let i = 0; i <= words.length - phraseTokens.length; i++) {
    // Skip words that are AssemblyAI PII placeholders — they won't match real text
    if (ASSEMBLY_PII_PATTERN.test(words[i].word)) continue

    let matched = 0
    for (let j = 0; j < phraseTokens.length; j++) {
      if (normalize(words[i + j]?.word || '') === phraseTokens[j]) matched++
    }
    // Require 85% match to handle minor transcription inconsistencies
    if (matched / phraseTokens.length >= 0.85) {
      return { start: words[i].start, end: words[i + phraseTokens.length - 1].end }
    }
  }
  return null
}

// Rule-based: detect spelled-out emails/info (e.g. "A N G E L dot com" or "dot com" preceded by letters)
// A sequence of 4+ single-letter words (possibly interleaved with short words like "dot") signals spelled-out PII
function findSpelledOutMatches(words: WordEntry[]): PiiMatch[] {
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
      // Start of a potential spelled-out sequence — scan forward
      const seqStart = i
      let letterCount = isSingleLetter ? 1 : 0

      while (i < words.length) {
        const next = words[i].word.toLowerCase().replace(/[^a-z0-9]/g, '')
        const isLetter = next.length === 1 && /[a-z]/.test(next)
        const isFill = FILLER.has(words[i].word.toLowerCase().replace(/[^a-z]/g, ''))
        const isDC = ['com', 'net', 'org', 'io'].includes(next)

        if (isLetter) letterCount++
        if (isLetter || isFill || isDC) {
          i++
        } else {
          break
        }
      }

      // Only flag if we saw 4+ individual letters — avoids false positives on "A" "the" etc.
      if (letterCount >= 4) {
        matches.push({ start: words[seqStart].start, end: words[i - 1].end, label: 'spelled_pii' })
      }
    } else {
      i++
    }
  }

  return matches
}

// Claude secondary pass — reviews the already-partially-redacted transcript text
// and catches anything AssemblyAI's models missed.
async function claudeSecondaryPiiCheck(
  redactedText: string,
  words: WordEntry[],
  anthropicApiKey: string
): Promise<PiiMatch[]> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey })

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filePath, originalFilename, salespersonId, metadata } = body

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }
    if (!originalFilename) {
      return NextResponse.json({ error: 'Original filename is required' }, { status: 400 })
    }
    if (!salespersonId) {
      return NextResponse.json({ error: 'Salesperson is required' }, { status: 400 })
    }

    const assemblyaiKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyaiKey) {
      return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not configured' }, { status: 500 })
    }

    const supabase = await createClient()

    // Check authentication and get user role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check if admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Apply rate limiting for non-admin users (10 uploads per hour)
    if (!isAdmin) {
      const rateLimitResult = checkRateLimit(user.id, 10, 60 * 60 * 1000) // 10 requests per hour

      if (!rateLimitResult.allowed) {
        const minutes = Math.ceil(rateLimitResult.retryAfter! / 60)
        return NextResponse.json(
          {
            error: `Upload limit reached. You can upload again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
            retryAfter: rateLimitResult.retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter!.toString(),
              'X-RateLimit-Limit': '10',
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            },
          }
        )
      }
    }

    // 1) Signed URL for the uploaded audio
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(filePath, 3600)

    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error:', signedUrlError)
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
    }

    const signedUrl = signedUrlData.signedUrl

    // 2) Download audio for local processing
    const audioResp = await fetch(signedUrl)
    if (!audioResp.ok) {
      const text = await audioResp.text()
      console.error('Audio download error:', text)
      return NextResponse.json({ error: 'Failed to download audio for processing' }, { status: 500 })
    }
    const audioBuffer = Buffer.from(await audioResp.arrayBuffer())
    const contentType = audioResp.headers.get('content-type') || 'audio/mpeg'

    // 4) Transcribe with AssemblyAI (synchronous polling)
    console.log('Uploading to AssemblyAI...')
    const uploadUrl = await uploadToAssemblyAI(signedUrl, assemblyaiKey)

    console.log('Creating transcript...')
    const transcriptId = await createTranscript(uploadUrl, assemblyaiKey)

    console.log('Polling for transcript completion...')
    const transcript = await pollTranscript(transcriptId, assemblyaiKey)

    // Convert AssemblyAI words to our format
    const words = transcript.words.map((w) => ({
      word: w.text,
      start: w.start / 1000,
      end: w.end / 1000,
      speaker: w.speaker,
    }))

    // 5) PII detection — five passes for maximum coverage:
    //    Pass 1a: AssemblyAI entities array (definitive PII timestamps from ML model)
    //    Pass 1b: AssemblyAI words array fallback ([ENTITY_TYPE] labels)
    //    Pass 2: Original regex-based detection (phones, credit cards, addresses, emails, SSNs)
    //    Pass 3: Rule-based number sequences (catches spoken credit cards/phones)
    //    Pass 4: Rule-based spelled-out sequences (catches "A N G E L dot com" patterns)
    //    Pass 5: Claude secondary review for anything still missed

    // DIAGNOSTIC: log raw entities and any bracket-looking words so we can see exact format
    console.log(`AssemblyAI entities field: ${JSON.stringify(transcript.entities?.slice(0, 3) ?? 'UNDEFINED')}`)
    const bracketWords = words.filter(w => w.word.includes('[') || w.word.includes(']'))
    console.log(`Words with brackets (${bracketWords.length} total): ${JSON.stringify(bracketWords.slice(0, 5))}`)

    // Pass 1a: entities array is the most reliable — direct PII timestamps from AssemblyAI
    const entityMatches = transcript.entities?.length
      ? extractEntityPiiMatches(transcript.entities)
      : []
    console.log(`Pass 1a - AssemblyAI entities: ${entityMatches.length} matches`)

    // Pass 1b: fallback — scan word array for [ENTITY_TYPE] labels
    const assemblyWordMatches = extractAssemblyPiiMatches(words)
    console.log(`Pass 1b - AssemblyAI words: ${assemblyWordMatches.length} matches`)

    const regexMatches = detectPiiMatches(words, 'all')
    console.log(`Pass 2 - Regex PII: ${regexMatches.length} matches`)

    const numberMatches = findNumberSequences(words)
    console.log(`Pass 3 - Number sequences: ${numberMatches.length} matches`)

    const spelledMatches = findSpelledOutMatches(words)
    console.log(`Pass 4 - Spelled-out: ${spelledMatches.length} matches`)

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    let claudeMatches: PiiMatch[] = []
    if (anthropicKey) {
      claudeMatches = await claudeSecondaryPiiCheck(transcript.text, words, anthropicKey)
      console.log(`Pass 5 - Claude secondary: ${claudeMatches.length} matches`)
    } else {
      console.error('WARNING: ANTHROPIC_API_KEY not set — Claude PII check AND objection detection will be skipped')
    }

    const allPiiMatches = mergeRanges([
      ...entityMatches,
      ...assemblyWordMatches,
      ...regexMatches,
      ...numberMatches,
      ...spelledMatches,
      ...claudeMatches,
    ])

    // 5.5) Validate ranges are within audio bounds
    const audioDuration = words.length > 0 ? words[words.length - 1].end : 0
    const validatedPiiMatches = validatePiiRanges(allPiiMatches, audioDuration)

    console.log(`PII TOTAL: ${entityMatches.length} entities + ${assemblyWordMatches.length} words + ${regexMatches.length} regex + ${numberMatches.length} numbers + ${spelledMatches.length} spelled + ${claudeMatches.length} claude = ${validatedPiiMatches.length} validated`)

    // 6) Redact audio locally with FFmpeg (silence)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slab-redact-'))
    const inputPath = path.join(tmpDir, 'input.mp3')
    const outputPath = path.join(tmpDir, 'redacted.mp3')

    try {
      await fs.writeFile(inputPath, audioBuffer)
      await runFfmpegBleep(inputPath, outputPath, validatedPiiMatches)
      const redactedBuffer = await fs.readFile(outputPath)

      console.log(`Redacted audio size: ${(redactedBuffer.length / 1024 / 1024).toFixed(1)}MB (original: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB)`)

      // 7) Upload redacted audio to Supabase
      const redactedFilePath = `redacted/${filePath}`
      const { error: redactedUploadError } = await supabase.storage
        .from('call-recordings')
        .upload(redactedFilePath, redactedBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        })

      if (redactedUploadError) {
        console.error('Redacted audio upload error:', redactedUploadError)
        console.error(`File size was: ${(redactedBuffer.length / 1024 / 1024).toFixed(1)}MB`)
        // Redacted audio is critical - if upload fails, we should not proceed
        // Otherwise users could get unredacted audio with PII exposed
        return NextResponse.json(
          {
            error: `Failed to upload redacted audio (${(redactedBuffer.length / 1024 / 1024).toFixed(1)}MB). The file may be too large. Please try again with a shorter recording.`,
            details: redactedUploadError.message
          },
          { status: 500 }
        )
      }

      console.log(`Successfully uploaded redacted audio to: ${redactedFilePath}`)

      // 8) Get salesperson name
      const { data: salespersonData } = await supabase
        .from('salespeople')
        .select('name')
        .eq('id', salespersonId)
        .single()

      const salespersonName = salespersonData?.name || 'Unknown'

      // Get user's company_id for multi-tenancy
      const { data: uploaderProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      // 9) Save transcript + redaction metadata + upload metadata
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('transcripts')
        .insert({
          salesperson_id: salespersonId,
          salesperson_name: salespersonName,
          original_filename: originalFilename,
          file_storage_path: filePath,
          transcript_redacted: {
            text: transcript.text,
            words,
            pii_matches: validatedPiiMatches,
            redacted_file_storage_path: redactedFilePath,
          },
          redaction_config_used: 'assemblyai+claude',
          uploaded_by: user.id,
          company_id: uploaderProfile?.company_id,
          // Metadata fields
          actual_sales_count: metadata?.actualSalesCount,
          expected_customer_count: metadata?.expectedCustomerCount,
          area_type: metadata?.areaType,
          estimated_duration_hours: metadata?.estimatedDurationHours,
          upload_notes: metadata?.uploadNotes,
        })
        .select()
        .single()

      if (transcriptError) {
        console.error('Database insert error:', transcriptError)

        // Cleanup: Delete redacted audio since we failed to save transcript
        // This prevents orphaned files in storage
        await supabase.storage
          .from('call-recordings')
          .remove([redactedFilePath])
          .catch(err => console.error('Failed to cleanup redacted audio:', err))

        return NextResponse.json(
          {
            error: 'Failed to save transcript to database',
            details: transcriptError.message
          },
          { status: 500 }
        )
      }

      console.log(`Successfully created transcript record: ${transcriptData.id}`)

      // 10) Segment conversations and analyze them
      try {
        console.log('Segmenting conversations...')
        const conversations = segmentConversationsHybrid(words, 'A', 30)
        console.log(`Found ${conversations.length} conversations`)

        const anthropicKey = process.env.ANTHROPIC_API_KEY

        // First pass: analyze all conversations and collect PII counts
        const conversationsWithAnalysis: Array<{
          conversation: any
          conversationText: string
          piiCount: number
          analysis: any
        }> = []

        for (const conversation of conversations) {
          const conversationText = getConversationText(conversation)
          const piiCount = countPiiInConversation(validatedPiiMatches, conversation)

          const analysis = await analyzeConversation(
            conversationText,
            piiCount,
            anthropicKey,
            metadata
          )

          conversationsWithAnalysis.push({
            conversation,
            conversationText,
            piiCount,
            analysis
          })
        }

        // Log per-conversation diagnostics to help debug issues
        conversationsWithAnalysis.forEach(({ conversation, piiCount, analysis }) => {
          console.log(`Conv ${conversation.conversationNumber}: words=${conversation.wordCount}, pii=${piiCount}, price=${analysis.hasPriceMention}, category=${analysis.category}, error=${analysis.analysisError || 'none'}`)
        })

        // Second pass: Calibrate sales using actual sales count from metadata
        let finalConversations = conversationsWithAnalysis
        if (metadata?.actualSalesCount !== undefined && metadata.actualSalesCount > 0) {
          console.log(`Calibrating sales count: Rep reported ${metadata.actualSalesCount} sales`)

          // Primary: conversations with price mention, sorted by PII count (credit cards)
          const priceConversations = conversationsWithAnalysis
            .filter(c => c.analysis.hasPriceMention)
            .sort((a, b) => b.piiCount - a.piiCount)

          // Fallback: if fewer price conversations than reported sales, also use PII-only conversations
          // (credit card was collected even if price keywords weren't captured)
          let salesPool = [...priceConversations]
          if (salesPool.length < metadata.actualSalesCount) {
            const piiOnlyConversations = conversationsWithAnalysis
              .filter(c => c.piiCount > 0 && !c.analysis.hasPriceMention)
              .sort((a, b) => b.piiCount - a.piiCount)
            salesPool = [...salesPool, ...piiOnlyConversations]
            console.log(`Not enough price conversations (${priceConversations.length}), expanded pool with ${piiOnlyConversations.length} PII-only conversations`)
          }

          // Last resort: if still not enough, take the longest conversations (most likely to be sales)
          if (salesPool.length < metadata.actualSalesCount) {
            const remaining = conversationsWithAnalysis
              .filter(c => !salesPool.includes(c))
              .sort((a, b) => b.conversation.durationSeconds - a.conversation.durationSeconds)
            salesPool = [...salesPool, ...remaining]
            console.log(`Still not enough, expanded pool to ${salesPool.length} conversations by duration`)
          }

          // Mark top N conversations as sales
          const salesConversations = new Set(
            salesPool
              .slice(0, metadata.actualSalesCount)
              .map(c => c.conversation.conversationNumber)
          )

          console.log(`Marking conversations as sales: ${Array.from(salesConversations).join(', ')}`)

          // Update categories: top N = sale, rest with price = pitch, no price = interaction
          finalConversations = conversationsWithAnalysis.map(item => {
            let category = item.analysis.category

            if (salesConversations.has(item.conversation.conversationNumber)) {
              category = 'sale'
            } else if (item.analysis.hasPriceMention) {
              category = 'pitch'
            } else {
              category = 'interaction'
            }

            return {
              ...item,
              analysis: {
                ...item.analysis,
                category
              }
            }
          })
        }

        // Third pass: Save to database
        for (const { conversation, analysis } of finalConversations) {

          const objectionTimestamps = analysis.objectionsWithText.map((objection: { type: string; text: string }) => {
            const timestamp = findTextTimestamp(objection.text, conversation.words)
            return {
              type: objection.type,
              text: objection.text,
              timestamp: timestamp !== null ? timestamp : conversation.startTime
            }
          })

          // Save all conversations — even "interaction" ones with no objections.
          // The old hasMeaningfulContent gate was silently dropping everything when
          // Claude's objection detection failed, leaving users with zero data.
          // Short/empty conversations (< 10 words) are the only thing we skip.
          if (conversation.wordCount < 10) {
            console.log(`Skipping conversation ${conversation.conversationNumber}: too short (${conversation.wordCount} words)`)
            continue
          }

          await supabase.from('conversations').insert({
            transcript_id: transcriptData.id,
            conversation_number: conversation.conversationNumber,
            start_time: conversation.startTime,
            end_time: conversation.endTime,
            speakers: conversation.speakers,
            sales_rep_speaker: 'A',
            word_count: conversation.wordCount,
            duration_seconds: conversation.durationSeconds,
            category: analysis.category,
            objections: analysis.objections,
            objections_with_text: analysis.objectionsWithText,
            objection_timestamps: objectionTimestamps,
            has_price_mention: analysis.hasPriceMention,
            pii_redaction_count: analysis.piiRedactionCount,
            analysis_completed: analysis.analysisCompleted,
            analysis_error: analysis.analysisError
          })
        }

        console.log('Conversation processing completed')
      } catch (error) {
        console.error('Conversation processing error (non-fatal):', error)
      }

      const warnings: string[] = []
      if (!anthropicKey) warnings.push('ANTHROPIC_API_KEY not set — objections will not be detected')
      if (validatedPiiMatches.length === 0) warnings.push('No PII detected — audio was not redacted')

      return NextResponse.json({
        success: true,
        transcriptId: transcriptData.id,
        message: 'Audio processed and redacted successfully',
        piiMatchCount: validatedPiiMatches.length,
        warnings: warnings.length > 0 ? warnings : undefined,
      })
    } finally {
      // Clean up temp files
      await fs.rm(tmpDir, { recursive: true, force: true }).catch((err) => {
        console.error('Failed to clean up temp directory:', err)
      })
    }
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
