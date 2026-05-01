/**
 * Parsing for user-provided conversation timestamp ranges.
 *
 * Accepts formats like:
 *   00:00 - 02:30
 *   2:35-4:50
 *   01:05:12 - 01:08:45
 *   125 - 240          (plain seconds)
 *
 * Lines that are blank or start with '#' are ignored. One range per line.
 */

export interface TimestampRange {
  start: number // seconds
  end: number   // seconds
}

export interface ParseResult {
  ranges: TimestampRange[]
  errors: Array<{ line: number; raw: string; reason: string }>
}

/** Parse a single time string ("MM:SS", "HH:MM:SS", or plain seconds) → seconds. */
function parseTime(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null

  // Plain seconds (integer or float)
  if (/^\d+(\.\d+)?$/.test(s)) {
    return parseFloat(s)
  }

  // MM:SS or HH:MM:SS
  const parts = s.split(':').map(p => p.trim())
  if (parts.length < 2 || parts.length > 3) return null
  for (const p of parts) {
    if (!/^\d+(\.\d+)?$/.test(p)) return null
  }
  const nums = parts.map(parseFloat)

  if (nums.length === 2) {
    const [m, sec] = nums
    return m * 60 + sec
  }
  // 3 parts: hours, minutes, seconds
  const [h, m, sec] = nums
  return h * 3600 + m * 60 + sec
}

export function parseTimestampInput(input: string): ParseResult {
  const ranges: TimestampRange[] = []
  const errors: ParseResult['errors'] = []

  const lines = input.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Allow comma as separator too
    const cleaned = trimmed.replace(/,/g, '-')

    // Split on dash, em-dash, or "to"
    const parts = cleaned.split(/\s*(?:-|–|—|to)\s*/i).filter(Boolean)
    if (parts.length !== 2) {
      errors.push({ line: i + 1, raw, reason: 'Expected "start - end" on this line' })
      continue
    }

    const start = parseTime(parts[0])
    const end   = parseTime(parts[1])

    if (start === null || end === null) {
      errors.push({ line: i + 1, raw, reason: 'Could not parse time format (use MM:SS or HH:MM:SS)' })
      continue
    }
    if (end <= start) {
      errors.push({ line: i + 1, raw, reason: 'End must be after start' })
      continue
    }

    ranges.push({ start, end })
  }

  // Sort by start time
  ranges.sort((a, b) => a.start - b.start)

  return { ranges, errors }
}

/** Format seconds back as MM:SS or HH:MM:SS for display. */
export function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${m}:${String(sec).padStart(2, '0')}`
}
