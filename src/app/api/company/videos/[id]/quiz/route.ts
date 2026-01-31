import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/company/videos/[id]/quiz - Get quiz for taking (questions without correct answers for users)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: videoId } = await params

    // Get quiz settings
    const { data: settings, error: settingsError } = await supabase
      .from('video_quiz_settings')
      .select('*')
      .eq('video_id', videoId)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({ error: 'No quiz found for this video' }, { status: 404 })
    }

    // Get questions (without correct answers for non-admins)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'company_admin' || profile?.role === 'super_admin'

    const { data: questions, error: questionsError } = await supabase
      .from('video_quiz_questions')
      .select(isAdmin ? '*' : 'id, video_id, question_text, option_a, option_b, option_c, option_d, position')
      .eq('video_id', videoId)
      .order('position', { ascending: true })

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 })
    }

    // Get user's previous attempts
    const { data: attempts } = await supabase
      .from('video_quiz_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .order('attempt_number', { ascending: false })

    const bestAttempt = attempts?.find(a => a.passed) || attempts?.[0] || null

    return NextResponse.json({
      settings,
      questions,
      attempts: attempts || [],
      bestAttempt,
      nextAttemptNumber: (attempts?.length || 0) + 1
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/company/videos/[id]/quiz - Submit quiz attempt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: videoId } = await params
    const body = await request.json()
    const { answers } = body // { question_id: 'A' | 'B' | 'C' | 'D' }

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Invalid answers format' }, { status: 400 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get quiz settings
    const { data: settings } = await supabase
      .from('video_quiz_settings')
      .select('*')
      .eq('video_id', videoId)
      .single()

    if (!settings) {
      return NextResponse.json({ error: 'No quiz found' }, { status: 404 })
    }

    // Get all questions with correct answers
    const { data: questions } = await supabase
      .from('video_quiz_questions')
      .select('*')
      .eq('video_id', videoId)
      .order('position', { ascending: true })

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'No questions found' }, { status: 404 })
    }

    // Calculate score
    let correctAnswers = 0
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) {
        correctAnswers++
      }
    })

    const totalQuestions = questions.length
    const score = Math.round((correctAnswers / totalQuestions) * 100)
    const passed = score >= settings.passing_score

    // Get attempt number
    const { data: previousAttempts } = await supabase
      .from('video_quiz_attempts')
      .select('attempt_number')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .order('attempt_number', { ascending: false })
      .limit(1)

    const attemptNumber = (previousAttempts?.[0]?.attempt_number || 0) + 1

    // Save attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('video_quiz_attempts')
      .insert({
        user_id: user.id,
        video_id: videoId,
        company_id: profile.company_id,
        score,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        passed,
        attempt_number: attemptNumber,
        answers
      })
      .select()
      .single()

    if (attemptError) {
      console.error('Error saving attempt:', attemptError)
      return NextResponse.json({ error: attemptError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      attempt,
      score,
      passed,
      correctAnswers,
      totalQuestions,
      passingScore: settings.passing_score
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
