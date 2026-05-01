import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  segmentConversationsHybrid,
  getConversationText,
  countPiiInConversation,
  findTextTimestamp,
} from '@/utils/conversationSegmentation'
import { analyzeConversation } from '@/utils/conversationAnalysis'
import type { UploadMetadata } from '@/utils/conversationAnalysis'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * POST body: { recordingType?: 'continuous' | 'edited_clips' }
 *
 * Re-runs conversation segmentation + analysis on an already-completed
 * transcript. Useful when the rep originally picked the wrong recording type
 * (or was uploaded before the toggle existed). Wipes existing rows in
 * `conversations` for this transcript and rebuilds them from the saved words
 * + pii_matches.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const authHeader = request.headers.get('Authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const { data: { user } } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: { recordingType?: 'continuous' | 'edited_clips' } = {}
    try { body = await request.json() } catch {}

    const sr = createServiceRoleClient()

    const { data: transcript, error: fetchError } = await sr
      .from('transcripts')
      .select('id, transcript_redacted, recording_type, expected_customer_count, actual_sales_count, area_type, estimated_duration_hours, upload_notes')
      .eq('id', id)
      .single()

    if (fetchError || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    const redacted = transcript.transcript_redacted as any
    const words = redacted?.words ?? []
    const piiMatches = redacted?.pii_matches ?? []

    if (!words.length) {
      return NextResponse.json({ error: 'Transcript has no word data — cannot re-segment' }, { status: 400 })
    }

    // Allow caller to override recording_type. If they do, persist it on the
    // transcript so future operations (and the UI) reflect the new mode.
    const recordingType: 'continuous' | 'edited_clips' =
      body.recordingType
        ?? (transcript.recording_type === 'edited_clips' ? 'edited_clips' : 'continuous')

    if (body.recordingType && body.recordingType !== transcript.recording_type) {
      await sr
        .from('transcripts')
        .update({ recording_type: body.recordingType })
        .eq('id', id)
    }

    // Wipe existing conversations
    const { error: deleteError } = await sr
      .from('conversations')
      .delete()
      .eq('transcript_id', id)
    if (deleteError) {
      return NextResponse.json({ error: `Failed to clear existing conversations: ${deleteError.message}` }, { status: 500 })
    }

    const conversations = segmentConversationsHybrid(words, 'A', 30, {
      recordingType,
      expectedCustomerCount: transcript.expected_customer_count ?? undefined,
      actualSalesCount: transcript.actual_sales_count ?? undefined,
    })

    console.log(`[re-segment] ${conversations.length} conversations (recordingType=${recordingType})`)

    if (!conversations.length) {
      return NextResponse.json({ status: 'completed', conversationCount: 0, recordingType })
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const metadata: UploadMetadata = {
      actualSalesCount:       transcript.actual_sales_count        ?? undefined,
      expectedCustomerCount:  transcript.expected_customer_count   ?? undefined,
      areaType:               transcript.area_type                 ?? undefined,
      estimatedDurationHours: transcript.estimated_duration_hours  ?? undefined,
      uploadNotes:            transcript.upload_notes              ?? undefined,
      recordingType,
    }

    // Same batched-Claude analysis as the main pipeline
    const BATCH = 5
    const analysed: Array<{ conversation: any; analysis: any; piiCount: number }> = []
    for (let i = 0; i < conversations.length; i += BATCH) {
      const batch = conversations.slice(i, i + BATCH)
      const results = await Promise.allSettled(
        batch.map(async (conv) => {
          const text     = getConversationText(conv)
          const piiCount = countPiiInConversation(piiMatches, conv)
          const analysis = await analyzeConversation(text, piiCount, anthropicKey, metadata)
          return { conversation: conv, analysis, piiCount }
        }),
      )
      for (const r of results) {
        if (r.status === 'fulfilled') analysed.push(r.value)
        else console.error('[re-segment] analysis failed:', r.reason)
      }
    }

    // Sales calibration (same logic as main pipeline)
    let finalAnalysed = analysed
    if (metadata.actualSalesCount !== undefined && metadata.actualSalesCount > 0) {
      const priceConvs = analysed
        .filter(c => c.analysis.hasPriceMention)
        .sort((a, b) => b.piiCount - a.piiCount)

      let salesPool = [...priceConvs]
      if (salesPool.length < metadata.actualSalesCount) {
        const piiOnly = analysed
          .filter(c => c.piiCount > 0 && !c.analysis.hasPriceMention)
          .sort((a, b) => b.piiCount - a.piiCount)
        salesPool = [...salesPool, ...piiOnly]
      }
      if (salesPool.length < metadata.actualSalesCount) {
        const remaining = analysed
          .filter(c => !salesPool.includes(c))
          .sort((a, b) => b.conversation.durationSeconds - a.conversation.durationSeconds)
        salesPool = [...salesPool, ...remaining]
      }

      const saleNumbers = new Set(
        salesPool.slice(0, metadata.actualSalesCount).map(c => c.conversation.conversationNumber),
      )

      finalAnalysed = analysed.map(item => {
        let category = item.analysis.category
        if (saleNumbers.has(item.conversation.conversationNumber)) category = 'sale'
        else if (item.analysis.hasPriceMention) category = 'pitch'
        else category = 'interaction'
        return { ...item, analysis: { ...item.analysis, category } }
      })
    }

    let inserted = 0
    for (const { conversation, analysis } of finalAnalysed) {
      if (conversation.wordCount < 10) continue

      const objectionTimestamps = analysis.objectionsWithText.map((obj: any) => ({
        type: obj.type,
        text: obj.text,
        timestamp: findTextTimestamp(obj.text, conversation.words) ?? conversation.startTime,
      }))

      const { error: insertError } = await sr.from('conversations').insert({
        transcript_id: id,
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
        analysis_error: analysis.analysisError,
      })
      if (insertError) console.error('[re-segment] insert failed:', insertError.message)
      else inserted++
    }

    return NextResponse.json({
      status: 'completed',
      conversationCount: inserted,
      recordingType,
    })
  } catch (error: any) {
    console.error('re-segment error:', error)
    return NextResponse.json({ error: error.message || 'Re-segmentation failed' }, { status: 500 })
  }
}
