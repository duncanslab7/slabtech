import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/company/videos/[id]/quiz/questions - Get all questions (admin view with correct answers)
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

    // Verify admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['company_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { id: videoId } = await params

    const { data: questions, error } = await supabase
      .from('video_quiz_questions')
      .select('*')
      .eq('video_id', videoId)
      .order('position', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ questions: questions || [] })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/company/videos/[id]/quiz/questions - Bulk create/update questions (admin only)
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

    // Verify admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['company_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { id: videoId } = await params
    const body = await request.json()
    const { questions } = body

    if (!Array.isArray(questions)) {
      return NextResponse.json({ error: 'Questions must be an array' }, { status: 400 })
    }

    // Validate questions
    for (const q of questions) {
      if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_answer) {
        return NextResponse.json({
          error: 'Each question must have question_text, all options (a-d), and correct_answer'
        }, { status: 400 })
      }
      if (!['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
        return NextResponse.json({
          error: 'correct_answer must be A, B, C, or D'
        }, { status: 400 })
      }
    }

    // Delete existing questions
    await supabase
      .from('video_quiz_questions')
      .delete()
      .eq('video_id', videoId)

    // Insert new questions
    const questionsToInsert = questions.map((q, index) => ({
      video_id: videoId,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      position: index
    }))

    const { data: newQuestions, error: insertError } = await supabase
      .from('video_quiz_questions')
      .insert(questionsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting questions:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, questions: newQuestions })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/company/videos/[id]/quiz/questions - Delete all questions (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['company_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { id: videoId } = await params

    const { error } = await supabase
      .from('video_quiz_questions')
      .delete()
      .eq('video_id', videoId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
