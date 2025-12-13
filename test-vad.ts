/**
 * Test script for Voice Activity Detection
 *
 * Usage: npm run test-vad <path-to-audio-file>
 * Example: npm run test-vad "./test-audio.mp3"
 */

import { analyzeAudioSegmentation } from './src/utils/audioSegmentation'
import fs from 'fs'

async function testVAD() {
  const audioPath = process.argv[2]

  if (!audioPath) {
    console.error('❌ Please provide an audio file path')
    console.log('Usage: node test-vad.js <path-to-audio-file>')
    console.log('Example: node test-vad.js "./test-audio.mp3"')
    process.exit(1)
  }

  if (!fs.existsSync(audioPath)) {
    console.error(`❌ File not found: ${audioPath}`)
    process.exit(1)
  }

  console.log('\n🎤 Voice Activity Detection Test\n')
  console.log(`📁 File: ${audioPath}`)
  console.log(`📊 File size: ${(fs.statSync(audioPath).size / 1024 / 1024).toFixed(2)} MB\n`)

  try {
    console.log('⏳ Analyzing audio (this may take a minute for large files)...\n')

    const analysis = await analyzeAudioSegmentation(audioPath)

    console.log('✅ Analysis Complete!\n')
    console.log('📈 SUMMARY')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Total Duration:     ${formatTime(analysis.totalDuration)}`)
    console.log(`Speech Duration:    ${formatTime(analysis.totalSpeechDuration)} (${analysis.speechPercentage.toFixed(1)}%)`)
    console.log(`Silence Duration:   ${formatTime(analysis.totalSilenceDuration)} (${(100 - analysis.speechPercentage).toFixed(1)}%)`)
    console.log(`Speech Segments:    ${analysis.segmentCount}`)
    console.log(`Grouped Segments:   ${analysis.groupCount}`)
    console.log('')

    console.log('🎯 SPEECH SEGMENTS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    analysis.segments.forEach((segment, index) => {
      console.log(`Segment ${index + 1}: ${formatTime(segment.start)} → ${formatTime(segment.end)} (${formatTime(segment.duration)})`)
    })
    console.log('')

    console.log('📦 GROUPED SEGMENTS (for processing)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    analysis.groups.forEach((group, index) => {
      console.log(`Group ${index + 1}: ${formatTime(group.groupStart)} → ${formatTime(group.groupEnd)}`)
      console.log(`  ├─ Total speech: ${formatTime(group.totalDuration)}`)
      console.log(`  └─ Sub-segments: ${group.segments.length}`)
    })
    console.log('')

    console.log('💰 COST SAVINGS ESTIMATE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    const fullCost = (analysis.totalDuration / 3600) * 0.37 // $0.37 per hour
    const optimizedCost = (analysis.totalSpeechDuration / 3600) * 0.37
    const savings = fullCost - optimizedCost
    const savingsPercent = (savings / fullCost) * 100

    console.log(`Full file cost:     $${fullCost.toFixed(2)}`)
    console.log(`With VAD cost:      $${optimizedCost.toFixed(2)}`)
    console.log(`💵 Savings:          $${savings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`)
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error))
    console.error(error)
    process.exit(1)
  }
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

testVAD()
