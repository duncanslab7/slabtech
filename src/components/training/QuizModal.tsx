'use client'

import { useState, useEffect } from 'react'

interface Question {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  position: number
}

interface QuizSettings {
  quiz_required: boolean
  blocks_next_videos: boolean
  blocks_transcripts: boolean
  blocks_training_playlists: boolean
  passing_score: number
}

interface QuizModalProps {
  videoId: string
  videoTitle: string
  onClose: () => void
  onPass: () => void
}

export function QuizModal({ videoId, videoTitle, onClose, onPass }: QuizModalProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [settings, setSettings] = useState<QuizSettings | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{
    score: number
    passed: boolean
    correctAnswers: number
    totalQuestions: number
    passingScore: number
  } | null>(null)
  const [attemptNumber, setAttemptNumber] = useState(1)

  useEffect(() => {
    fetchQuiz()
  }, [videoId])

  const fetchQuiz = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/company/videos/${videoId}/quiz`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load quiz')
      }

      setQuestions(data.questions || [])
      setSettings(data.settings)
      setAttemptNumber(data.nextAttemptNumber || 1)
    } catch (error) {
      console.error('Error fetching quiz:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer })
  }

  const handleSubmit = async () => {
    // Check all questions answered
    const unanswered = questions.filter(q => !answers[q.id])
    if (unanswered.length > 0) {
      alert('Please answer all questions before submitting')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/company/videos/${videoId}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit quiz')
      }

      setResult(data)

      if (data.passed) {
        // Call onPass after a short delay to show success message
        setTimeout(() => {
          onPass()
        }, 2000)
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetake = () => {
    setAnswers({})
    setResult(null)
    setAttemptNumber(attemptNumber + 1)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full">
          <p className="text-white text-center">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (!settings || questions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-2xl font-bold text-white mb-4">Quiz Not Available</h2>
          <p className="text-gray-300 mb-6">No quiz has been set up for this video.</p>
          <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-8 max-w-3xl w-full my-8" onClick={(e) => e.stopPropagation()}>
        {!result ? (
          <>
            {/* Quiz Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Quiz: {videoTitle}</h2>
              <p className="text-gray-400">
                Attempt #{attemptNumber} • Passing Score: {settings.passing_score}% • {questions.length} Questions
              </p>
            </div>

            {/* Questions */}
            <div className="space-y-6 mb-8">
              {questions.map((question, index) => (
                <div key={question.id} className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-white font-medium mb-4">
                    {index + 1}. {question.question_text}
                  </h3>

                  <div className="space-y-3">
                    {['A', 'B', 'C', 'D'].map((letter) => (
                      <label
                        key={letter}
                        className={`flex items-start gap-3 p-3 rounded cursor-pointer transition-colors ${
                          answers[question.id] === letter
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-600 text-gray-200 hover:bg-gray-550'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={letter}
                          checked={answers[question.id] === letter}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="mt-1 w-4 h-4"
                        />
                        <span className="flex-1">
                          {letter}. {question[`option_${letter.toLowerCase()}` as keyof Question]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-700 text-white rounded hover:bg-gray-600"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Results */}
            <div className="text-center mb-8">
              {result.passed ? (
                <>
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-3xl font-bold text-green-400 mb-2">Congratulations!</h2>
                  <p className="text-xl text-white mb-4">You passed the quiz!</p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">📝</div>
                  <h2 className="text-3xl font-bold text-yellow-400 mb-2">Try Again</h2>
                  <p className="text-xl text-white mb-4">You didn't pass this time</p>
                </>
              )}

              <div className="bg-gray-700 rounded-lg p-6 max-w-md mx-auto">
                <div className="text-5xl font-bold text-white mb-2">{result.score}%</div>
                <p className="text-gray-300">
                  {result.correctAnswers} out of {result.totalQuestions} correct
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Passing score: {result.passingScore}%
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              {result.passed ? (
                <button
                  onClick={onPass}
                  className="px-8 py-3 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                >
                  Continue
                </button>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-gray-700 text-white rounded hover:bg-gray-600"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleRetake}
                    className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Retake Quiz
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
