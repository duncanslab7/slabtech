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
// Pass `endSeconds = null` for the last chunk so FFmpeg reads to EOF — this
// avoids truncation when the word-derived duration is shorter than the file.
async function runFfmpegChunk(
  inputPath: string,
  outputPath: string,
  piiRanges: PiiMatch[],
  startSeconds: number,
  endSeconds: number | null,
): Promise<void> {
  const ffmpegPath = getFfmpegPath()
  const args = [
    '-y',
    '-loglevel', 'error',          // less stderr noise
    '-ss', startSeconds.toFixed(3),
  ]
  if (endSeconds !== null) {
    args.push('-to', endSeconds.toFixed(3))
  }
  args.push('-i', inputPath)

  if (piiRanges.length > 0) {
    const merged = mergeRanges(piiRanges)
    const expr = merged
      .map(r => `between(t,${r.start.toFixed(3)},${r.end.toFixed(3)})`)
      .join('+')
    args.push('-af', `volume=enable='${expr}':volume=0`)
  }

  // -compression_level 0: fastest LAME setting (~30-50% faster than default 5)
  // -ac 1 -b:a 64k: mono voice at 64 kbps — small files, quality unchanged for speech
  args.push('-c:a', 'libmp3lame', '-compression_level', '0', '-b:a', '64k', '-ac', '1', outputPath)
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

  // CONCURRENT=3: balance between Vercel's effective CPU (~1-2 vCPU on Pro)
  // and chunk parallelism. Higher values mostly cause CPU contention since
  // libmp3lame is single-threaded.
  const CONCURRENT = 3
  const overallStart = Date.now()
  console.log(
    `[chunked] starting: ${numChunks} chunks of ~${chunkSecs}s, ${CONCURRENT} concurrent, ${piiMatches.length} PII ranges`,
  )

  const chunkPaths: string[] = new Array(numChunks)

  for (let i = 0; i < numChunks; i += CONCURRENT) {
    const batch = Array.from(
      { length: Math.min(CONCURRENT, numChunks - i) },
      (_, j) => i + j,
    )

    await Promise.all(batch.map(async (ci) => {
      const isLast = ci === numChunks - 1
      const start  = ci * chunkSecs
      // Last chunk: omit `-to` so FFmpeg reads to EOF — handles cases where
      // word timestamps underestimate the actual audio duration.
      const end    = isLast ? null : (ci + 1) * chunkSecs
      const out    = path.join(tmpDir, `chunk_${ci}.mp3`)

      // Clip PII ranges to this chunk's window and make them chunk-relative.
      // For the last chunk we don't know the exact end, so use a generous
      // upper bound (any extra past EOF is harmless).
      const upper = end ?? totalDuration + 600
      const chunkPii = piiMatches
        .filter(r => r.end > start && r.start < upper)
        .map(r => ({
          ...r,
          start: Math.max(0, r.start - start),
          end: r.end - start,
        }))

      const chunkStart = Date.now()
      await runFfmpegChunk(inputPath, out, chunkPii, start, end)
      chunkPaths[ci] = out
      console.log(
        `[chunked] chunk ${ci + 1}/${numChunks} done in ${((Date.now() - chunkStart) / 1000).toFixed(1)}s` +
        ` (range ${start}s-${end ?? 'EOF'}, ${chunkPii.length} PII)`,
      )
    }))
  }

  // Concatenate with stream copy — no re-encode, sub-second
  const fileList = path.join(tmpDir, 'filelist.txt')
  await fs.writeFile(
    fileList,
    chunkPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'),
  )
  const concatStart = Date.now()
  await runFfmpegConcat(fileList, outputPath)
  console.log(
    `[chunked] concat done in ${((Date.now() - concatStart) / 1000).toFixed(1)}s,` +
    ` total ${((Date.now() - overallStart) / 1000).toFixed(1)}s for ${numChunks} chunks`,
  )
}

// ─── Original single-pass function (kept for short files / admin reprocess) ──

export async function runFfmpegBleep(inputPath: string, outputPath: string, ranges: PiiMatch[]) {
  const ffmpegPath = getFfmpegPath()

  // Encoder settings shared across both code paths.
  // -compression_level 0: fastest LAME setting (~30-50% faster than default 5;
  //   imperceptible quality difference at 64 kbps mono voice).
  // -ac 1 -b:a 64k: mono voice, small file, audio sounds fine.
  const encArgs = ['-c:a', 'libmp3lame', '-compression_level', '0', '-b:a', '64k', '-ac', '1']

  if (!ranges.length) {
    const compressArgs = ['-y', '-loglevel', 'error', '-i', inputPath, ...encArgs, outputPath]
    await spawnFfmpeg(ffmpegPath, compressArgs)
    return
  }

  const mergedRanges = mergeRanges(ranges)
  console.log(`runFfmpegBleep: ${ranges.length} ranges → ${mergedRanges.length} merged`)

  const expr = mergedRanges
    .map(r => `between(t,${r.start.toFixed(3)},${r.end.toFixed(3)})`)
    .join('+')

  const args = [
    '-y', '-loglevel', 'error',
    '-i', inputPath,
    '-af', `volume=enable='${expr}':volume=0`,
    ...encArgs,
    outputPath,
  ]

  const t0 = Date.now()
  await spawnFfmpeg(ffmpegPath, args)
  console.log(`runFfmpegBleep done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}
