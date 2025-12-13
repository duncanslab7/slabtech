import * as fs from 'fs'

// Type declarations for @ricky0123/vad-node
interface VADUtils {
  audioFileToArray: (buffer: Buffer) => Promise<Float32Array>
  arrayToWavBuffer: (data: Float32Array, sampleRate: number) => Buffer
  minFramesForTargetMS: (targetDuration: number, frameSamples: number, sr: number) => number
}

interface VADSegment {
  start: number
  end: number
  confidence: number
}

interface NonRealTimeVAD {
  run: (audioData: Float32Array, sampleRate: number) => Promise<VADSegment[]>
  destroy: () => void
}

interface NonRealTimeVADClass {
  new: () => Promise<NonRealTimeVAD>
}

export interface SpeechSegment {
  start: number // seconds
  end: number // seconds
  duration: number // seconds
}

export interface SegmentGroup {
  segments: SpeechSegment[]
  groupStart: number
  groupEnd: number
  totalDuration: number
}

/**
 * Detect speech segments in an audio file using Silero VAD
 * @param audioBuffer Audio file as Buffer or path to file
 * @param minSilenceDuration Minimum silence duration in seconds to consider as a gap (default: 180s = 3min)
 * @returns Array of speech segments with timestamps
 */
export async function detectSpeechSegments(
  audioBuffer: Buffer | string,
  minSilenceDuration: number = 180
): Promise<SpeechSegment[]> {
  try {
    console.log('[VAD] Starting speech detection...')

    // Use require for better CommonJS compatibility in Next.js
    const vad = require('@ricky0123/vad-node')
    const utils = vad.utils as VADUtils
    const NonRealTimeVAD = vad.NonRealTimeVAD as NonRealTimeVADClass

    console.log('[VAD] Library loaded:', { hasUtils: !!utils, hasVAD: !!NonRealTimeVAD, utilsKeys: Object.keys(utils || {}) })

    // Load audio buffer if path is provided
    let buffer: Buffer
    if (typeof audioBuffer === 'string') {
      buffer = fs.readFileSync(audioBuffer)
    } else {
      buffer = audioBuffer
    }

    // Convert audio to array format for VAD
    const audioData = await utils.audioFileToArray(buffer)
    console.log(`[VAD] Audio loaded: ${(audioData.length / 16000).toFixed(2)} seconds`)

    // Use NonRealTimeVAD for file processing
    const myvad = await NonRealTimeVAD.new()

    // Detect speech segments
    const rawSegments = await myvad.run(audioData, 16000) // 16kHz sample rate
    console.log(`[VAD] Detected ${rawSegments.length} raw speech segments`)

    // Convert to our format
    const segments: SpeechSegment[] = rawSegments.map((segment: VADSegment) => ({
      start: segment.start / 16000, // Convert samples to seconds
      end: segment.end / 16000,
      duration: (segment.end - segment.start) / 16000
    }))

    myvad.destroy()

    if (segments.length === 0) {
      console.log('[VAD] No speech detected')
      return []
    }

    // Merge segments that are close together (less than minSilenceDuration apart)
    const mergedSegments: SpeechSegment[] = []
    let current = segments[0]

    for (let i = 1; i < segments.length; i++) {
      const gap = segments[i].start - current.end

      if (gap < minSilenceDuration) {
        // Merge with current segment
        current = {
          start: current.start,
          end: segments[i].end,
          duration: segments[i].end - current.start
        }
      } else {
        // Save current segment and start new one
        mergedSegments.push(current)
        current = segments[i]
      }
    }
    mergedSegments.push(current)

    console.log(`[VAD] Merged into ${mergedSegments.length} segments after grouping`)

    return mergedSegments
  } catch (error: any) {
    console.error('[VAD] Error detecting speech segments:', error)
    throw new Error(`Failed to detect speech segments: ${error.message}`)
  }
}

/**
 * Group nearby speech segments together (segments within threshold are considered same activity)
 * @param segments Array of speech segments
 * @param groupingThreshold Maximum gap between segments to group them (default: 180s = 3min)
 * @returns Array of segment groups
 */
export function groupSpeechSegments(
  segments: SpeechSegment[],
  groupingThreshold: number = 180
): SegmentGroup[] {
  if (segments.length === 0) return []

  const groups: SegmentGroup[] = []
  let currentGroup: SpeechSegment[] = [segments[0]]

  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end

    if (gap <= groupingThreshold) {
      // Add to current group
      currentGroup.push(segments[i])
    } else {
      // Finalize current group and start new one
      groups.push({
        segments: currentGroup,
        groupStart: currentGroup[0].start,
        groupEnd: currentGroup[currentGroup.length - 1].end,
        totalDuration: currentGroup.reduce((sum, seg) => sum + seg.duration, 0)
      })
      currentGroup = [segments[i]]
    }
  }

  // Add last group
  if (currentGroup.length > 0) {
    groups.push({
      segments: currentGroup,
      groupStart: currentGroup[0].start,
      groupEnd: currentGroup[currentGroup.length - 1].end,
      totalDuration: currentGroup.reduce((sum, seg) => sum + seg.duration, 0)
    })
  }

  return groups
}

/**
 * Extract audio segment from buffer
 * @param sourceBuffer Source audio buffer
 * @param startTime Start time in seconds
 * @param endTime End time in seconds
 * @returns Audio buffer containing only the specified segment
 */
export async function extractAudioSegment(
  sourceBuffer: Buffer,
  startTime: number,
  endTime: number
): Promise<Buffer> {
  try {
    // Use require for better CommonJS compatibility
    const { utils } = require('@ricky0123/vad-node')
    const typedUtils = utils as VADUtils

    const audioData = await typedUtils.audioFileToArray(sourceBuffer)
    const sampleRate = 16000 // Silero VAD uses 16kHz

    const startSample = Math.floor(startTime * sampleRate)
    const endSample = Math.floor(endTime * sampleRate)

    const segmentData = audioData.slice(startSample, endSample)

    // Convert back to audio buffer (WAV format)
    return typedUtils.arrayToWavBuffer(segmentData, sampleRate)
  } catch (error: any) {
    console.error('Error extracting audio segment:', error)
    throw new Error(`Failed to extract audio segment: ${error.message}`)
  }
}

/**
 * Analyze audio file and provide segmentation statistics
 * @param audioBuffer Audio file as Buffer or path to file
 * @returns Statistics about the audio segmentation
 */
export async function analyzeAudioSegmentation(audioBuffer: Buffer | string) {
  const segments = await detectSpeechSegments(audioBuffer)
  const groups = groupSpeechSegments(segments)

  const totalSpeechDuration = segments.reduce((sum, seg) => sum + seg.duration, 0)

  // Get total duration from audio data
  let buffer: Buffer
  if (typeof audioBuffer === 'string') {
    buffer = fs.readFileSync(audioBuffer)
  } else {
    buffer = audioBuffer
  }

  // Use require for better CommonJS compatibility
  const { utils } = require('@ricky0123/vad-node')
  const typedUtils = utils as VADUtils

  const audioData = await typedUtils.audioFileToArray(buffer)
  const totalDuration = audioData.length / 16000 // 16kHz sample rate

  return {
    totalDuration,
    totalSpeechDuration,
    totalSilenceDuration: totalDuration - totalSpeechDuration,
    speechPercentage: (totalSpeechDuration / totalDuration) * 100,
    segmentCount: segments.length,
    groupCount: groups.length,
    segments,
    groups
  }
}
