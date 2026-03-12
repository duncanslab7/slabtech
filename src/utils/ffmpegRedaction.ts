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
