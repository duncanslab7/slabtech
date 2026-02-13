import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/admin/users/[id]/quiz-progress
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

    // Get current user's role and company
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!adminProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { id: userId } = await params

    // Get target user's profile to check company
    const { data: targetProfile } = await supabase
      .from('user_profiles')
      .select('company_id, email, display_name')
      .eq('id', userId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions: super_admin can see all, company_admin can see their company
    const canView =
      adminProfile.role === 'super_admin' ||
      (adminProfile.role === 'company_admin' && adminProfile.company_id === targetProfile.company_id)

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch quiz attempts with video details
    const { data: quizAttempts, error: attemptsError } = await supabase
      .from('video_quiz_attempts')
      .select(`
        id,
        video_id,
        score,
        total_questions,
        correct_answers,
        passed,
        attempt_number,
        completed_at,
        training_videos (
          id,
          title,
          duration
        )
      `)
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })

    if (attemptsError) {
      console.error('Error fetching quiz attempts:', attemptsError)
      return NextResponse.json({ error: attemptsError.message }, { status: 500 })
    }

    // Fetch video completions
    const { data: videoCompletions, error: completionsError } = await supabase
      .from('video_completions')
      .select(`
        video_id,
        completed,
        last_watched_at,
        training_videos (
          id,
          title,
          duration
        )
      `)
      .eq('user_id', userId)

    if (completionsError) {
      console.error('Error fetching video completions:', completionsError)
    }

    // Get videos with quizzes that user hasn't attempted
    const { data: videosWithQuizzes, error: quizzesError } = await supabase
      .from('video_quiz_settings')
      .select(`
        video_id,
        quiz_required,
        passing_score,
        blocks_transcripts,
        blocks_training_playlists,
        training_videos (
          id,
          title,
          company_id
        )
      `)
      .eq('training_videos.company_id', targetProfile.company_id)

    if (quizzesError) {
      console.error('Error fetching videos with quizzes:', quizzesError)
    }

    // Calculate summary stats
    const totalAttempts = quizAttempts?.length || 0
    const uniqueVideos = new Set(quizAttempts?.map(a => a.video_id) || []).size
    const passedVideos = new Set(
      quizAttempts?.filter(a => a.passed).map(a => a.video_id) || []
    ).size
    const averageScore = quizAttempts && quizAttempts.length > 0
      ? quizAttempts.reduce((sum, a) => sum + a.score, 0) / quizAttempts.length
      : 0

    // Group attempts by video
    const attemptsByVideo = new Map()
    quizAttempts?.forEach(attempt => {
      const videoId = attempt.video_id
      if (!attemptsByVideo.has(videoId)) {
        attemptsByVideo.set(videoId, [])
      }
      attemptsByVideo.get(videoId).push(attempt)
    })

    // Format data for frontend
    const videoProgress = Array.from(attemptsByVideo.entries()).map(([videoId, attempts]) => {
      const sortedAttempts = attempts.sort((a: any, b: any) =>
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      )
      const latestAttempt = sortedAttempts[0]
      const bestAttempt = attempts.reduce((best: any, current: any) =>
        current.score > best.score ? current : best
      )
      const hasPassed = attempts.some((a: any) => a.passed)

      return {
        video: latestAttempt.training_videos,
        totalAttempts: attempts.length,
        latestAttempt,
        bestAttempt,
        hasPassed,
        allAttempts: sortedAttempts
      }
    })

    return NextResponse.json({
      user: {
        id: userId,
        email: targetProfile.email,
        display_name: targetProfile.display_name
      },
      summary: {
        totalAttempts,
        uniqueVideos,
        passedVideos,
        averageScore: Math.round(averageScore)
      },
      videoProgress,
      videoCompletions: videoCompletions || [],
      videosWithQuizzes: videosWithQuizzes || []
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
