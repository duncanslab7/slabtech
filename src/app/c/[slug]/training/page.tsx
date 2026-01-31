'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { QuizModal } from '@/components/training/QuizModal'

interface Video {
  id: string
  title: string
  description: string | null
  video_type: 'youtube' | 'upload'
  youtube_url: string | null
  storage_path: string | null
  thumbnail_url: string | null
  duration: number | null
  created_at: string
  video_completions: { user_id: string; completed_at: string }[]
}

interface Playlist {
  id: string
  name: string
  description: string | null
  created_at: string
  playlist_videos: { count: number }[]
}

export default function TrainingPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState<Video[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'playlists'>('all')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [quizVideoId, setQuizVideoId] = useState<string | null>(null)
  const [quizVideoTitle, setQuizVideoTitle] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)

        // Check if user is admin
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        setIsAdmin(profile?.role === 'company_admin' || profile?.role === 'super_admin')
      }

      // Fetch videos with completion status
      const videosResponse = await fetch('/api/company/training-videos')
      const videosData = await videosResponse.json()
      if (videosData.videos) {
        setVideos(videosData.videos)
      }

      // Fetch playlists
      const playlistsResponse = await fetch('/api/company/playlists')
      const playlistsData = await playlistsResponse.json()
      if (playlistsData.playlists) {
        setPlaylists(playlistsData.playlists)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const isVideoCompleted = (video: Video): boolean => {
    if (!currentUser) return false
    return video.video_completions?.some(c => c.user_id === currentUser.id) || false
  }

  const handleToggleCompletion = async (videoId: string, videoTitle: string, currentlyCompleted: boolean) => {
    // If trying to mark as complete, check if quiz is required
    if (!currentlyCompleted) {
      try {
        const quizResponse = await fetch(`/api/company/videos/${videoId}/quiz/settings`)
        const quizData = await quizResponse.json()

        if (quizData.settings?.quiz_required) {
          // Check if user has passed the quiz
          const quizAttemptResponse = await fetch(`/api/company/videos/${videoId}/quiz`)
          const quizAttemptData = await quizAttemptResponse.json()

          const hasPassed = quizAttemptData.bestAttempt?.passed || false

          if (!hasPassed) {
            // Show quiz modal
            setQuizVideoId(videoId)
            setQuizVideoTitle(videoTitle)
            setShowQuizModal(true)
            return
          }
        }
      } catch (error) {
        console.error('Error checking quiz:', error)
      }
    }

    try {
      const method = currentlyCompleted ? 'DELETE' : 'POST'
      const response = await fetch(`/api/company/videos/${videoId}/complete`, {
        method,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update completion status')
      }

      setMessage({
        type: 'success',
        text: currentlyCompleted ? 'Video marked as incomplete' : 'Video marked as complete!'
      })

      // Refresh data to update completion status
      fetchData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handleQuizPass = async () => {
    setShowQuizModal(false)
    setMessage({ type: 'success', text: 'Quiz passed! Video marked as complete.' })

    // Mark video as complete
    if (quizVideoId) {
      await fetch(`/api/company/videos/${quizVideoId}/complete`, {
        method: 'POST'
      })
    }

    fetchData()
  }

  const extractYouTubeId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
    return match ? match[1] : null
  }

  const handleWatchVideo = (video: Video) => {
    setSelectedVideo(video)
  }

  const closeVideoModal = () => {
    setSelectedVideo(null)
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Loading training library...</p>
      </div>
    )
  }

  const completedVideos = videos.filter(v => isVideoCompleted(v)).length
  const totalVideos = videos.length
  const completionPercentage = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Training Library</h1>
          <p className="text-gray-400">
            {completedVideos} of {totalVideos} videos completed ({completionPercentage}%)
          </p>
        </div>
        {isAdmin && (
          <Link
            href={`/c/${slug}/training/manage`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium"
          >
            Manage Videos
          </Link>
        )}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Progress Bar */}
      {totalVideos > 0 && (
        <div className="mb-8">
          <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-700">
        <button
          className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'all' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setActiveTab('all')}
        >
          All Videos ({videos.length})
        </button>
        <button
          className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'playlists' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setActiveTab('playlists')}
        >
          Playlists ({playlists.length})
        </button>
      </div>

      {/* All Videos Tab */}
      {activeTab === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => {
            const completed = isVideoCompleted(video)
            return (
              <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden relative group">
                {completed && (
                  <div className="absolute top-3 right-3 z-10 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    ✓ Completed
                  </div>
                )}

                <div
                  className="cursor-pointer relative"
                  onClick={() => handleWatchVideo(video)}
                >
                  {video.thumbnail_url ? (
                    <div className="relative">
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-48 object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                          <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-gray-800 border-b-8 border-b-transparent ml-1"></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-500 text-4xl">🎥</span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="text-white font-medium text-lg mb-2">{video.title}</h3>
                  {video.description && (
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{video.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                      {video.video_type === 'youtube' ? 'YouTube' : 'Upload'}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleCompletion(video.id, video.title, completed)
                      }}
                      className={`text-sm px-3 py-1 rounded transition-colors ${
                        completed
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {completed ? 'Mark Incomplete' : 'Mark Complete'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Playlists Tab */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          {playlists.map((playlist) => (
            <Link
              key={playlist.id}
              href={`/c/${slug}/training/playlists/${playlist.id}`}
              className="block bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white font-medium text-xl mb-2">{playlist.name}</h3>
                  {playlist.description && (
                    <p className="text-gray-400 mb-2">{playlist.description}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    {playlist.playlist_videos?.[0]?.count || 0} videos
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </Link>
          ))}

          {playlists.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No playlists yet.</p>
            </div>
          )}
        </div>
      )}

      {videos.length === 0 && activeTab === 'all' && (
        <div className="text-center py-12 text-gray-400">
          <p>No training videos available yet.</p>
          {isAdmin && (
            <Link href={`/c/${slug}/training/manage`} className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
              Add your first training video
            </Link>
          )}
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={closeVideoModal}>
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">{selectedVideo.title}</h2>
                <button onClick={closeVideoModal} className="text-gray-400 hover:text-white text-2xl">
                  ×
                </button>
              </div>

              <div className="aspect-video bg-black">
                {selectedVideo.video_type === 'youtube' && selectedVideo.youtube_url ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(selectedVideo.youtube_url)}`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : selectedVideo.storage_path ? (
                  <video
                    controls
                    className="w-full h-full"
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/training-videos/${selectedVideo.storage_path}`}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    Video not available
                  </div>
                )}
              </div>

              {selectedVideo.description && (
                <div className="p-4 border-t border-gray-700">
                  <p className="text-gray-300">{selectedVideo.description}</p>
                </div>
              )}

              <div className="p-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    handleToggleCompletion(selectedVideo.id, selectedVideo.title, isVideoCompleted(selectedVideo))
                    closeVideoModal()
                  }}
                  className={`px-6 py-2 rounded font-medium transition-colors ${
                    isVideoCompleted(selectedVideo)
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isVideoCompleted(selectedVideo) ? '✓ Mark as Incomplete' : 'Mark as Complete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {showQuizModal && quizVideoId && (
        <QuizModal
          videoId={quizVideoId}
          videoTitle={quizVideoTitle}
          onClose={() => setShowQuizModal(false)}
          onPass={handleQuizPass}
        />
      )}
    </div>
  )
}
