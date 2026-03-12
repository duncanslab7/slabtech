import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/utils/supabase/server'
import { mergeRanges, runFfmpegBleep } from '@/utils/ffmpegRedaction'
import { detectPiiMatches } from '@/utils/pii'
import type { PiiMatch } from '@/utils/pii'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

async function verifySuperAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return { error: 'Forbidden', status: 403 }

  return { user, profile }
}

type WordEntry = {
  word: string
  start: number
  end: number
  speaker?: string
}

// Spoken number words (individual digits and teens/tens)
const NUMBER_WORDS = new Set([
  'zero','one','two','three','four','five','six','seven','eight','nine',
  'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
  'seventeen','eighteen','nineteen','twenty','thirty','forty','fifty',
  'sixty','seventy','eighty','ninety','hundred','thousand',
  // Common digit transcription variants
  'oh', // spoken as zero
])

function isNumberWord(word: string): boolean {
  const cleaned = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  return NUMBER_WORDS.has(cleaned) || /^\d+$/.test(cleaned)
}

// Find any sequence of 3+ consecutive number words
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
  // Handle sequence at end of array
  if (seqStart !== -1 && words.length - seqStart >= minLength) {
    matches.push({ start: words[seqStart].start, end: words[words.length - 1].end, label: 'numbers' })
  }

  return matches
}

// Detect spelled-out emails/info (e.g. "A N G E L I Q U E dot com")
// A sequence of 4+ single-letter words (possibly with filler words like "dot") signals spelled-out PII
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

      if (letterCount >= 4) {
        matches.push({ start: words[seqStart].start, end: words[i - 1].end, label: 'spelled_pii' })
      }
    } else {
      i++
    }
  }

  return matches
}

// Find .com/.net/.org domains and surrounding email text (up to 8 words back)
function findDomainMatches(words: WordEntry[]): PiiMatch[] {
  const DOMAIN_SUFFIXES = ['.com', '.net', '.org', '.io', '.co']
  const matches: PiiMatch[] = []

  for (let i = 0; i < words.length; i++) {
    const w = words[i].word.toLowerCase()
    const isDomain =
      DOMAIN_SUFFIXES.some(s => w.includes(s)) ||
      (['com', 'net', 'org', 'io'].includes(w) && i > 0 && words[i - 1].word.toLowerCase() === 'dot')

    if (isDomain) {
      const lookback = Math.max(0, i - 8)
      matches.push({ start: words[lookback].start, end: words[i].end, label: 'email' })
    }
  }
  return matches
}

function findNewPii(words: WordEntry[], existingMatches: PiiMatch[]): PiiMatch[] {
  const candidates: PiiMatch[] = [
    ...findNumberSequences(words),
    ...findSpelledOutMatches(words),
    ...findDomainMatches(words),
    ...detectPiiMatches(words, 'all'),
  ]

  // Only keep matches that aren't already covered (>50% overlap with existing)
  return candidates.filter(candidate => {
    for (const ex of existingMatches) {
      const overlapStart = Math.max(candidate.start, ex.start)
      const overlapEnd = Math.min(candidate.end, ex.end)
      if (overlapEnd > overlapStart) {
        const duration = candidate.end - candidate.start
        if (duration > 0 && (overlapEnd - overlapStart) / duration > 0.5) return false
      }
    }
    return true
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const authCheck = await verifySuperAdmin(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const body = await request.json().catch(() => ({}))
    const salespersonName: string = body.salespersonName || 'Rylan'

    const { data: transcripts, error: fetchError } = await supabase
      .from('transcripts')
      .select('id, salesperson_name, file_storage_path, transcript_redacted')
      .ilike('salesperson_name', salespersonName)

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: 500 })
    }

    const results: { id: string; salesperson_name: string; newMatchCount: number; status: string }[] = []

    for (const transcript of transcripts || []) {
      const transcriptRedacted = transcript.transcript_redacted as any
      const words: WordEntry[] = transcriptRedacted?.words || []
      const existingMatches: PiiMatch[] = transcriptRedacted?.pii_matches || []

      if (!words.length) {
        results.push({ id: transcript.id, salesperson_name: transcript.salesperson_name, newMatchCount: 0, status: 'skipped_no_words' })
        continue
      }

      const newMatches = findNewPii(words, existingMatches)

      if (newMatches.length === 0) {
        results.push({ id: transcript.id, salesperson_name: transcript.salesperson_name, newMatchCount: 0, status: 'no_new_matches' })
        continue
      }

      console.log(`Transcript ${transcript.id}: found ${newMatches.length} new PII matches`)

      const mergedMatches = mergeRanges([...existingMatches, ...newMatches])

      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slab-reprocess-'))
      try {
        const { data: signedUrlData } = await supabase.storage
          .from('call-recordings')
          .createSignedUrl(transcript.file_storage_path, 300)

        if (!signedUrlData?.signedUrl) {
          results.push({ id: transcript.id, salesperson_name: transcript.salesperson_name, newMatchCount: newMatches.length, status: 'error_signed_url' })
          continue
        }

        const audioResp = await fetch(signedUrlData.signedUrl)
        if (!audioResp.ok) {
          results.push({ id: transcript.id, salesperson_name: transcript.salesperson_name, newMatchCount: newMatches.length, status: 'error_download' })
          continue
        }

        const audioBuffer = Buffer.from(await audioResp.arrayBuffer())
        const inputPath = path.join(tmpDir, 'input.mp3')
        const outputPath = path.join(tmpDir, 'redacted.mp3')

        await fs.writeFile(inputPath, audioBuffer)
        await runFfmpegBleep(inputPath, outputPath, mergedMatches)
        const redactedBuffer = await fs.readFile(outputPath)

        const redactedFilePath = transcriptRedacted?.redacted_file_storage_path
        if (!redactedFilePath) {
          results.push({ id: transcript.id, salesperson_name: transcript.salesperson_name, newMatchCount: newMatches.length, status: 'error_no_redacted_path' })
          continue
        }

        const { error: uploadError } = await supabase.storage
          .from('call-recordings')
          .upload(redactedFilePath, redactedBuffer, { contentType: 'audio/mpeg', upsert: true })

        if (uploadError) {
          results.push({ id: transcript.id, salesperson_name: transcript.salesperson_name, newMatchCount: newMatches.length, status: 'error_upload' })
          continue
        }

        const { error: updateError } = await supabase
          .from('transcripts')
          .update({
            transcript_redacted: {
              ...transcriptRedacted,
              pii_matches: mergedMatches,
            },
          })
          .eq('id', transcript.id)

        if (updateError) {
          console.error('DB update error for transcript', transcript.id, updateError)
          results.push({ id: transcript.id, salesperson_name: transcript.salesperson_name, newMatchCount: newMatches.length, status: 'error_db_update' })
          continue
        }

        results.push({ id: transcript.id, salesperson_name: transcript.salesperson_name, newMatchCount: newMatches.length, status: 'updated' })
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true, processed: results.length, transcripts: results })
  } catch (error: any) {
    console.error('Reprocess PII error:', error)
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
