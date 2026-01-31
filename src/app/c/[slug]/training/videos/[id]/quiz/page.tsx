'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Question {
  id?: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: 'A' | 'B' | 'C' | 'D'
  position?: number
}

interface QuizSettings {
  quiz_required: boolean
  blocks_next_videos: boolean
  blocks_transcripts: boolean
  blocks_training_playlists: boolean
  passing_score: number
}

export default function ManageQuizPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string
  const videoId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [videoTitle, setVideoTitle] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [settings, setSettings] = useState<QuizSettings>({
    quiz_required: false,
    blocks_next_videos: false,
    blocks_transcripts: false,
    blocks_training_playlists: false,
    passing_score: 80
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchData()
  }, [videoId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch video info
      const videoResponse = await fetch('/api/company/training-videos')
      const videoData = await videoResponse.json()
      const video = videoData.videos?.find((v: any) => v.id === videoId)
      if (video) {
        setVideoTitle(video.title)
      }

      // Fetch quiz settings
      const settingsResponse = await fetch(`/api/company/videos/${videoId}/quiz/settings`)
      const settingsData = await settingsResponse.json()
      if (settingsData.settings) {
        setSettings(settingsData.settings)
      }

      // Fetch questions
      const questionsResponse = await fetch(`/api/company/videos/${videoId}/quiz/questions`)
      const questionsData = await questionsResponse.json()
      if (questionsData.questions && questionsData.questions.length > 0) {
        setQuestions(questionsData.questions)
      }
    } catch (error) {
      console.error('Error fetching quiz data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A'
    }])
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    // Validate
    if (settings.quiz_required && questions.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one question if quiz is required' })
      return
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d) {
        setMessage({ type: 'error', text: `Question ${i + 1} is incomplete` })
        return
      }
    }

    setSaving(true)
    setMessage(null)

    try {
      // Save settings
      const settingsResponse = await fetch(`/api/company/videos/${videoId}/quiz/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (!settingsResponse.ok) {
        throw new Error('Failed to save quiz settings')
      }

      // Save questions if quiz is required
      if (settings.quiz_required && questions.length > 0) {
        const questionsResponse = await fetch(`/api/company/videos/${videoId}/quiz/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions })
        })

        if (!questionsResponse.ok) {
          throw new Error('Failed to save questions')
        }
      } else if (!settings.quiz_required) {
        // Delete questions if quiz is not required
        await fetch(`/api/company/videos/${videoId}/quiz/questions`, {
          method: 'DELETE'
        })
      }

      setMessage({ type: 'success', text: 'Quiz saved successfully!' })
      setTimeout(() => {
        router.push(`/c/${slug}/training/manage`)
      }, 1500)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href={`/c/${slug}/training/manage`} className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
        ← Back to Manage Training
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">Manage Quiz</h1>
      <p className="text-gray-400 mb-8">{videoTitle}</p>

      {message && (
        <div className={`mb-6 p-4 rounded ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Quiz Settings */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-4">Quiz Settings</h2>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.quiz_required}
              onChange={(e) => setSettings({ ...settings, quiz_required: e.target.checked })}
              className="w-5 h-5"
            />
            <div>
              <span className="text-white font-medium">Require Quiz</span>
              <p className="text-sm text-gray-400">Users must pass the quiz to mark this video as complete</p>
            </div>
          </label>

          {settings.quiz_required && (
            <>
              <div className="pl-8 space-y-4 border-l-2 border-blue-500">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.blocks_next_videos}
                    onChange={(e) => setSettings({ ...settings, blocks_next_videos: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <div>
                    <span className="text-white font-medium">Block Next Videos in Playlist</span>
                    <p className="text-sm text-gray-400">Users must pass this quiz to unlock subsequent videos in the playlist</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.blocks_transcripts}
                    onChange={(e) => setSettings({ ...settings, blocks_transcripts: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <div>
                    <span className="text-white font-medium">Block Transcripts Access</span>
                    <p className="text-sm text-gray-400">Users must pass this quiz to access the Transcripts section</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.blocks_training_playlists}
                    onChange={(e) => setSettings({ ...settings, blocks_training_playlists: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <div>
                    <span className="text-white font-medium">Block Training Playlists</span>
                    <p className="text-sm text-gray-400">Users must pass this quiz to access Training Playlists (objection handling)</p>
                  </div>
                </label>

                <div>
                  <label className="block text-white font-medium mb-2">Passing Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.passing_score}
                    onChange={(e) => setSettings({ ...settings, passing_score: parseInt(e.target.value) || 80 })}
                    className="bg-gray-700 text-white px-4 py-2 rounded w-32"
                  />
                  <span className="text-gray-400 ml-2">%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Questions */}
      {settings.quiz_required && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Questions</h2>
            <button
              onClick={addQuestion}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              + Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No questions yet. Add your first question!</p>
          ) : (
            <div className="space-y-6">
              {questions.map((q, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-white">Question {index + 1}</h3>
                    <button
                      onClick={() => removeQuestion(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 mb-2">Question Text</label>
                      <textarea
                        value={q.question_text}
                        onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                        className="w-full bg-gray-600 text-white px-4 py-2 rounded"
                        rows={2}
                        placeholder="Enter your question..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {['A', 'B', 'C', 'D'].map((letter) => (
                        <div key={letter}>
                          <label className="flex items-center gap-2 mb-2">
                            <input
                              type="radio"
                              name={`correct-${index}`}
                              checked={q.correct_answer === letter}
                              onChange={() => updateQuestion(index, 'correct_answer', letter)}
                              className="w-4 h-4"
                            />
                            <span className="text-gray-300">Option {letter} (Correct Answer)</span>
                          </label>
                          <input
                            value={q[`option_${letter.toLowerCase()}` as keyof Question] as string}
                            onChange={(e) => updateQuestion(index, `option_${letter.toLowerCase()}` as keyof Question, e.target.value)}
                            className="w-full bg-gray-600 text-white px-4 py-2 rounded"
                            placeholder={`Option ${letter}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="flex gap-3 justify-end">
        <Link
          href={`/c/${slug}/training/manage`}
          className="px-6 py-3 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Quiz'}
        </button>
      </div>
    </div>
  )
}
