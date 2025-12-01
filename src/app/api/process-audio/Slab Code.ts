import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 30

// Route segment config to allow large file uploads
export const maxDuration = 300 // 5 minutes max execution time
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    const body = await request.json()
    const { filePath, originalFilename, salespersonName, customerName } = body

    // Validate required fields
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    if (!originalFilename) {
      return NextResponse.json(
        { error: 'Original filename is required' },
        { status: 400 }
      )
    }

    if (!salespersonName) {
      return NextResponse.json(
        { error: 'Salesperson name is required' },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const supabase = await createClient()

    // Step 1: Get a signed URL for the uploaded file (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(filePath, 3600)

    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    const signedUrl = signedUrlData.signedUrl

    // Step 2: Fetch the current redaction config
    const { data: configData, error: configError } = await supabase
      .from('redaction_config')
      .select('pii_fields')
      .eq('id', 1)
      .single()

    if (configError) {
      console.error('Config fetch error:', configError)
      return NextResponse.json(
        { error: 'Failed to fetch redaction configuration' },
        { status: 500 }
      )
    }

    const piiFields = configData.pii_fields || 'all'

    // Convert config string into AssemblyAI redaction policies (AssemblyAI now requires explicit policies)
    const allowedPolicies = new Set<string>([
      'account_number',
      'banking_information',
      'blood_type',
      'credit_card_number',
      'credit_card_expiration',
      'credit_card_cvv',
      'date',
      'date_interval',
      'date_of_birth',
      'drivers_license',
      'drug',
      'duration',
      'email_address',
      'event',
      'filename',
      'gender_sexuality',
      'healthcare_number',
      'injury',
      'ip_address',
      'language',
      'location',
      'location_address',
      'location_address_street',
      'location_city',
      'location_coordinate',
      'location_country',
      'location_state',
      'location_zip',
      'marital_status',
      'medical_condition',
      'medical_process',
      'money_amount',
      'nationality',
      'number_sequence',
      'occupation',
      'organization',
      'passport_number',
      'password',
      'person_age',
      'person_name',
      'phone_number',
      'physical_attribute',
      'political_affiliation',
      'religion',
      'statistics',
      'time',
      'url',
      'us_social_security_number',
      'username',
      'vehicle_id',
      'zodiac_sign',
    ])

    const defaultPolicies = [
      'person_name',
      'organization',
      'email_address',
      'phone_number',
      'location',
    ]

    const redactionFields: string[] = (() => {
      const normalized = piiFields.toLowerCase().trim()
      if (normalized === 'all') return Array.from(allowedPolicies)
      const parsed = normalized
        .split(',')
        .map((field: string) => field.trim())
        .filter(Boolean)
        .filter((field: string) => allowedPolicies.has(field))
      return parsed.length ? parsed : defaultPolicies
    })()

    // Step 3: Process with AssemblyAI
    const assemblyAiApiKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyAiApiKey) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      )
    }

    // Create AssemblyAI transcription job
    const createJobResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: assemblyAiApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: signedUrl,
        redact_pii: true,
        // AssemblyAI now requires explicit policies
        redact_pii_policies: redactionFields,
        redact_pii_audio: true,
        // AssemblyAI expects quality here; 'mp3' returns playable redacted audio
        redact_pii_audio_quality: 'mp3',
        speaker_labels: false,
      }),
    })

    if (!createJobResponse.ok) {
      const errorText = await createJobResponse.text()
      console.error('AssemblyAI create job error:', errorText)
      return NextResponse.json(
        { error: 'AssemblyAI transcription request failed' },
        { status: 500 }
      )
    }

    const jobData = await createJobResponse.json()

    // Poll for completion
    let assemblyResult: any = null
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const statusResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${jobData.id}`,
        {
          headers: {
            authorization: assemblyAiApiKey,
          },
        }
      )

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.error('AssemblyAI status error:', errorText)
        return NextResponse.json(
          { error: 'Failed to fetch AssemblyAI transcript status' },
          { status: 500 }
        )
      }

      const statusData = await statusResponse.json()

      if (statusData.status === 'completed') {
        assemblyResult = statusData
        break
      }

      if (statusData.status === 'error') {
        console.error('AssemblyAI processing error:', statusData.error)
        return NextResponse.json(
          { error: `AssemblyAI transcription failed: ${statusData.error}` },
          { status: 500 }
        )
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    if (!assemblyResult) {
      return NextResponse.json(
        { error: 'AssemblyAI transcription timed out' },
        { status: 504 }
      )
    }

    // If AssemblyAI returned redacted audio, upload it to storage for playback/download
    let redactedFilePath: string | null = null

    // AssemblyAI may return either `redacted_audio_url` or `redact_pii_audio_url`
    const redactedAudioUrl = assemblyResult.redacted_audio_url || assemblyResult.redact_pii_audio_url
    // Fallback endpoint if URL not returned in payload
    const targetRedactedUrl =
      redactedAudioUrl ||
      `https://api.assemblyai.com/v2/transcript/${jobData.id}/redacted_audio?format=mp3`

    if (targetRedactedUrl) {
      try {
        const headers: Record<string, string> = {
          authorization: assemblyAiApiKey,
        }

        const redactedResponse = await fetch(targetRedactedUrl, { headers })
        if (!redactedResponse.ok) {
          const errText = await redactedResponse.text()
          throw new Error(`Failed to download redacted audio (${redactedResponse.status}): ${errText}`)
        }

        const arrayBuffer = await redactedResponse.arrayBuffer()
        const contentType = redactedResponse.headers.get('content-type') || 'audio/mpeg'

        redactedFilePath = `redacted/${filePath}`

        const { error: redactedUploadError } = await supabase.storage
          .from('call-recordings')
          .upload(redactedFilePath, Buffer.from(arrayBuffer), {
            contentType,
            upsert: true,
          })

        if (redactedUploadError) {
          console.error('Redacted audio upload error:', redactedUploadError)
          redactedFilePath = null
        }
      } catch (e) {
        console.error('Redacted audio handling error:', e)
        redactedFilePath = null
      }
    }

    // Step 4: Insert transcript into database
    const { data: transcriptData, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        salesperson_name: salespersonName,
        customer_name: customerName || null,
        original_filename: originalFilename,
        file_storage_path: filePath,
        transcript_redacted: {
          ...assemblyResult,
          ...(redactedFilePath ? { redacted_file_storage_path: redactedFilePath } : {}),
        },
        redaction_config_used: piiFields,
      })
      .select()
      .single()

    if (transcriptError) {
      console.error('Database insert error:', transcriptError)
      return NextResponse.json(
        { error: 'Failed to save transcript to database' },
        { status: 500 }
      )
    }

    // Return success response
    return NextResponse.json({
      success: true,
      transcriptId: transcriptData.id,
      message: 'Audio processed successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
