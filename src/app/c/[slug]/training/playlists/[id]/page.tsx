'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Video {
  id: string
  title: string
  description: string | null
  video_type: 'youtube' | 'upload'
  youtube_url: string | null
  storage_path: string | null
  thumbnail_url: string | null
  duration: number | null
  position: number
  video_completions: { user_id: string; completed_at: string }[]
}

interface Playlist {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default function PlaylistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string
  const playlistId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [playlistId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
      }

      // Fetch playlist with videos
      const response = await fetch(`/api/company/playlists/${playlistId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load playlist')
      }

      setPlaylist(data.playlist)
      setVideos(data.videos || [])
    } catch (error: any) {
      console.error('Error fetching playlist:', error)
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  const isVideoCompleted = (video: Video): boolean => {
    if (!currentUser) return false
    return video.video_completions?.some(c => c.user_id === currentUser.id) || false
  }

  const handleToggleCompletion = async (videoId: string, currentlyCompleted: boolean) => {
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

      fetchData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const extractYouTubeId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
    return match ? match[1] : null
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Loading playlist...</p>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="p-8">
        <p className="text-red-400">Playlist not found</p>
        <Link href={`/c/${slug}/training`} className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
          ← Back to Training Library
        </Link>
      </div>
    )
  }

  const completedVideos = videos.filter(v => isVideoCompleted(v)).length
  const totalVideos = videos.length
  const completionPercentage = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href={`/c/${slug}/training`} className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
        ← Back to Training Library
      </Link>

      {/* Playlist Header */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{playlist.name}</h1>
        {playlist.description && (
          <p className="text-gray-400 mb-4">{playlist.description}</p>
        )}
        <p className="text-sm text-gray-500">
          {completedVideos} of {totalVideos} videos completed ({completionPercentage}%)
        </p>

        {/* Progress Bar */}
        {totalVideos > 0 && (
          <div className="mt-4">
            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Videos List */}
      <div className="space-y-4">
        {videos.map((video, index) => {
          const completed = isVideoCompleted(video)
          return (
            <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden flex">
              <div className="w-16 bg-gray-700 flex items-center justify-center text-gray-400 font-medium">
                {index + 1}
              </div>

              <div
                className="flex-1 flex cursor-pointer hover:bg-gray-750 transition-colors"
                onClick={() => setSelectedVideo(video)}
              >
                {video.thumbnail_url && (
                  <img src={video.thumbnail_url} alt={video.title} className="w-40 h-24 object-cover" />
                )}

                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-medium text-lg mb-1">{video.title}</h3>
                      {video.description && (
                        <p className="text-gray-400 text-sm line-clamp-1">{video.description}</p>
                      )}
                    </div>
                    {completed && (
                      <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium ml-4">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center px-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleCompletion(video.id, completed)
                  }}
                  className={`text-sm px-4 py-2 rounded transition-colors ${
                    completed
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {completed ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {videos.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-gray-800 rounded-lg">
          <p>No videos in this playlist yet.</p>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedVideo(null)}>
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">{selectedVideo.title}</h2>
                <button onClick={() => setSelectedVideo(null)} className="text-gray-400 hover:text-white text-2xl">
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
                    handleToggleCompletion(selectedVideo.id, isVideoCompleted(selectedVideo))
                    setSelectedVideo(null)
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
    </div>
  )
}
