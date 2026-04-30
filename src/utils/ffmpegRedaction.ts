import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

export type { PiiMatch } from '@/utils/pii'
import type { PiiMatch } from '@/utils/pii'

export function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH
  }

  try {
    // @ts-ignore
    const ffmpegStatic = require('ffmpeg-static')
    let ffmpegPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.path
    console.log('FFmpeg static path (raw):', ffmpegPath)

    if (!ffmpegPath) {
      throw new Error('ffmpeg-static did not return a path')
    }

    // Handle placeholder path (e.g., \ROOT\node_modules\...)
    if (ffmpegPath.includes('\\ROOT\\') || ffmpegPath.includes('/ROOT/')) {
      const parts = ffmpegPath.split(/[\\\/]ROOT[\\\/]/)
      if (parts.length > 1) {
        const resolved = path.resolve(process.cwd(), parts[1])
        console.log('Resolved from ROOT placeholder:', resolved)
        return resolved
      }
    }

    if (path.isAbsolute(ffmpegPath)) {
      return ffmpegPath
    }

    const resolved = path.resolve(process.cwd(), ffmpegPath)
    console.log('Resolved FFmpeg path:', resolved)
    return resolved
  } catch (error) {
    console.error('Failed to load ffmpeg-static:', error)
  }

  return 'ffmpeg'
}

export function mergeRanges(ranges: PiiMatch[]): PiiMatch[] {
  if (!ranges.length) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged: PiiMatch[] = []

  for (const r of sorted) {
    const last = merged[merged.length - 1]
    if (!last) {
      merged.push({ ...r })
      continue
    }
    if (r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
    } else {
      merged.push({ ...r })
    }
  }

  let coalesced = merged
  const MAX_GAP_SECONDS = 2.0

  while (coalesced.length > 180) {
    const next: PiiMatch[] = []
    let i = 0

    while (i < coalesced.length) {
      const first = coalesced[i]
      const second = coalesced[i + 1]

      if (!second) {
        next.push(first)
        i++
      } else {
        const gap = second.start - first.end
        if (gap <= MAX_GAP_SECONDS) {
          next.push({
            start: first.start,
            end: second.end,
            label: 'pii',
          })
          i += 2
        } else {
          next.push(first)
          i++
        }
      }
    }

    if (next.length === coalesced.length) {
      break
    }

    coalesced = next
  }

  return coalesced
}

// ─── Chunked processing ───────────────────────────────────────────────────────

function spawnFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, args, { stdio: 'pipe' })
    let stderr = ''
    ff.stderr?.on('data', (d) => { stderr += d.toString() })
    ff.on('error', reject)
    ff.on('close', (code) => code === 0
      ? resolve()
      : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`))
    )
  })
}

// Process a single time-bounded segment of the source file, applying PII
// silencing with timestamps already adjusted to be relative to chunkStart.
async function runFfmpegChunk(
  inputPath: string,
  outputPath: string,
  piiRanges: PiiMatch[],
  startSeconds: number,
  endSeconds: number,
): Promise<void> {
  const ffmpegPath = getFfmpegPath()
  const args = [
    '-y',
    '-ss', startSeconds.toFixed(3),
    '-to', endSeconds.toFixed(3),
    '-i', inputPath,
  ]

  if (piiRanges.length > 0) {
    const merged = mergeRanges(piiRanges)
    const expr = merged
      .map(r => `between(t,${r.start.toFixed(3)},${r.end.toFixed(3)})`)
      .join('+')
    args.push('-af', `volume=enable='${expr}':volume=0`)
  }

  args.push('-b:a', '64k', '-ac', '1', outputPath)
  await spawnFfmpeg(ffmpegPath, args)
}

async function runFfmpegConcat(fileListPath: string, outputPath: string): Promise<void> {
  const ffmpegPath = getFfmpegPath()
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', fileListPath, '-c', 'copy', outputPath]
  await spawnFfmpeg(ffmpegPath, args)
}

/**
 * Split audio into fixed-size chunks, apply PII silencing in parallel, then
 * concatenate. For large files this keeps each FFmpeg call well under Vercel's
 * 5-minute function limit.
 *
 * @param inputPath     Temp file path of the source audio
 * @param outputPath    Desired output file path
 * @param piiMatches    PII ranges in *absolute* seconds (relative to full file)
 * @param totalDuration Duration of the source audio in seconds
 * @param chunkSecs     Target duration per chunk (default 20 min)
 */
export async function processAudioInChunks(
  inputPath: string,
  outputPath: string,
  piiMatches: PiiMatch[],
  totalDuration: number,
  chunkSecs = 1200,
): Promise<void> {
  const tmpDir = path.dirname(outputPath)
  const numChunks = Math.max(1, Math.ceil(totalDuration / chunkSecs))

  // Short files: just use the existing single-pass function
  if (numChunks === 1) {
    return runFfmpegBleep(inputPath, outputPath, piiMatches)
  }

  console.log(`Processing audio in ${numChunks} chunks (${chunkSecs}s each, 4 concurrent)`)

  const chunkPaths: string[] = new Array(numChunks)
  const CONCURRENT = 4

  for (let i = 0; i < numChunks; i += CONCURRENT) {
    const batch = Array.from(
      { length: Math.min(CONCURRENT, numChunks - i) },
      (_, j) => i + j,
    )

    await Promise.all(batch.map(async (ci) => {
      const start = ci * chunkSecs
      const end   = Math.min((ci + 1) * chunkSecs, totalDuration)
      const out   = path.join(tmpDir, `chunk_${ci}.mp3`)

      // Clip PII ranges to this chunk's window and make them chunk-relative
      const chunkPii = piiMatches
        .filter(r => r.end > start && r.start < end)
        .map(r => ({
          ...r,
          start: Math.max(0, r.start - start),
          end: Math.min(end - start, r.end - start),
        }))

      await runFfmpegChunk(inputPath, out, chunkPii, start, end)
      chunkPaths[ci] = out
      console.log(`Chunk ${ci + 1}/${numChunks} done`)
    }))
  }

  // Concatenate (stream copy — no re-encode, sub-second)
  const fileList = path.join(tmpDir, 'filelist.txt')
  await fs.writeFile(
    fileList,
    chunkPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'),
  )
  await runFfmpegConcat(fileList, outputPath)
  console.log(`Chunked concat complete → ${outputPath}`)
}

// ─── Original single-pass function (kept for short files / admin reprocess) ──

export async function runFfmpegBleep(inputPath: string, outputPath: string, ranges: PiiMatch[]) {
  const ffmpegPath = getFfmpegPath()

  if (!ranges.length) {
    // Still re-encode at lower bitrate to reduce file size for storage upload
    const ffmpegPathNoRanges = getFfmpegPath()
    const compressArgs = ['-y', '-i', inputPath, '-b:a', '64k', '-ac', '1', outputPath]
    await new Promise<void>((resolve, reject) => {
      const ff = spawn(ffmpegPathNoRanges, compressArgs, { stdio: 'pipe' })
      ff.on('error', reject)
      ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg compress exited ${code}`)))
    })
    return
  }

  const mergedRanges = mergeRanges(ranges)

  console.log('PII ranges before merge:', ranges.length)
  console.log('PII ranges after merge:', mergedRanges.length)
  console.log('Merged ranges:', mergedRanges.map(r => `${r.start.toFixed(2)}-${r.end.toFixed(2)}`).join(', '))

  const enableExpression = mergedRanges
    .map((range) => `between(t,${range.start.toFixed(2)},${range.end.toFixed(2)})`)
    .join('+')

  const volumeFilter = `volume=enable='${enableExpression}':volume=0`

  console.log('FFmpeg volume filter:', volumeFilter)

  // -b:a 64k -ac 1: compress to 64kbps mono — voice audio sounds fine and keeps
  // file size small enough for Supabase storage upload (avoids 413/gateway errors)
  const args = ['-y', '-i', inputPath, '-af', volumeFilter, '-b:a', '64k', '-ac', '1', outputPath]

  await new Promise<void>((resolve, reject) => {
    const ff = spawn(ffmpegPath, args, { stdio: 'pipe' })
    let stderr = ''

    ff.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        console.error('FFmpeg stderr:', stderr)
        console.error('FFmpeg args:', args)
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
      }
    })
  })
}
