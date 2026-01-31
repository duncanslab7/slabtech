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
  created_at: string
}

interface Playlist {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default function ManageTrainingPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState<Video[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activeTab, setActiveTab] = useState<'videos' | 'playlists'>('videos')

  // Video form state
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoType, setVideoType] = useState<'youtube' | 'upload'>('youtube')
  const [videoTitle, setVideoTitle] = useState('')
  const [videoDescription, setVideoDescription] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)

  // Playlist form state
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistDescription, setPlaylistDescription] = useState('')

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch videos
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

  const extractYouTubeThumbnail = (url: string): string | null => {
    try {
      const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
      if (videoIdMatch && videoIdMatch[1]) {
        return `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`
      }
    } catch (e) {
      console.error('Error extracting YouTube thumbnail:', e)
    }
    return null
  }

  const handleCreateVideo = async () => {
    if (!videoTitle) {
      setMessage({ type: 'error', text: 'Video title is required' })
      return
    }

    if (videoType === 'youtube' && !youtubeUrl) {
      setMessage({ type: 'error', text: 'YouTube URL is required' })
      return
    }

    if (videoType === 'upload' && !uploadFile) {
      setMessage({ type: 'error', text: 'Please select a video file' })
      return
    }

    setSaveLoading(true)
    setMessage(null)
    setUploadProgress('')

    try {
      let storagePath = null
      let thumbnailUrl = null

      if (videoType === 'upload') {
        // Upload file first
        setUploadProgress('Uploading video...')
        const formData = new FormData()
        formData.append('file', uploadFile!)

        const uploadResponse = await fetch('/api/company/training-videos/upload', {
          method: 'POST',
          body: formData,
        })

        const uploadData = await uploadResponse.json()
        if (!uploadResponse.ok) {
          throw new Error(uploadData.error || 'Failed to upload video')
        }

        storagePath = uploadData.storage_path
        // For uploaded videos, thumbnail will need to be generated or uploaded separately
      } else {
        // YouTube video - extract thumbnail
        thumbnailUrl = extractYouTubeThumbnail(youtubeUrl)
      }

      // Create video record
      setUploadProgress('Creating video record...')
      const response = await fetch('/api/company/training-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoTitle,
          description: videoDescription || null,
          video_type: videoType,
          youtube_url: videoType === 'youtube' ? youtubeUrl : null,
          storage_path: storagePath,
          thumbnail_url: thumbnailUrl,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create video')
      }

      setMessage({ type: 'success', text: 'Video added successfully!' })
      setShowVideoModal(false)
      resetVideoForm()
      fetchData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaveLoading(false)
      setUploadProgress('')
    }
  }

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video? This will remove it from all playlists.')) {
      return
    }

    try {
      const response = await fetch(`/api/company/training-videos/${videoId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete video')
      }

      setMessage({ type: 'success', text: 'Video deleted successfully' })
      fetchData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handleCreatePlaylist = async () => {
    if (!playlistName) {
      setMessage({ type: 'error', text: 'Playlist name is required' })
      return
    }

    setSaveLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/company/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playlistName,
          description: playlistDescription || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create playlist')
      }

      setMessage({ type: 'success', text: 'Playlist created successfully!' })
      setShowPlaylistModal(false)
      resetPlaylistForm()
      fetchData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist? Videos will not be deleted.')) {
      return
    }

    try {
      const response = await fetch(`/api/company/playlists/${playlistId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete playlist')
      }

      setMessage({ type: 'success', text: 'Playlist deleted successfully' })
      fetchData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const resetVideoForm = () => {
    setVideoTitle('')
    setVideoDescription('')
    setYoutubeUrl('')
    setUploadFile(null)
    setVideoType('youtube')
  }

  const resetPlaylistForm = () => {
    setPlaylistName('')
    setPlaylistDescription('')
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Manage Training Videos</h1>
          <Link href={`/c/${slug}/training`} className="text-blue-400 hover:text-blue-300">
            ← Back to Training Library
          </Link>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-700">
        <button
          className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'videos' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setActiveTab('videos')}
        >
          Videos ({videos.length})
        </button>
        <button
          className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'playlists' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setActiveTab('playlists')}
        >
          Playlists ({playlists.length})
        </button>
      </div>

      {/* Videos Tab */}
      {activeTab === 'videos' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => setShowVideoModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium"
            >
              + Add Video
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden">
                {video.thumbnail_url && (
                  <img src={video.thumbnail_url} alt={video.title} className="w-full h-48 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-white font-medium text-lg">{video.title}</h3>
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded shrink-0">
                      {video.video_type === 'youtube' ? 'YouTube' : 'Upload'}
                    </span>
                  </div>
                  {video.description && (
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{video.description}</p>
                  )}
                  <div className="flex gap-3">
                    <Link
                      href={`/c/${slug}/training/videos/${video.id}/quiz`}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Manage Quiz
                    </Link>
                    <button
                      onClick={() => handleDeleteVideo(video.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {videos.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No videos yet. Add your first training video!</p>
            </div>
          )}
        </div>
      )}

      {/* Playlists Tab */}
      {activeTab === 'playlists' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => setShowPlaylistModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium"
            >
              + Create Playlist
            </button>
          </div>

          <div className="space-y-4">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-white font-medium text-xl mb-2">{playlist.name}</h3>
                    {playlist.description && (
                      <p className="text-gray-400 mb-4">{playlist.description}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/c/${slug}/training/playlists/${playlist.id}/edit`}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeletePlaylist(playlist.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {playlists.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No playlists yet. Create your first playlist to organize videos!</p>
            </div>
          )}
        </div>
      )}

      {/* Add Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Add Training Video</h2>

            {/* Video Type Selection */}
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Video Type</label>
              <div className="flex gap-4">
                <label className="flex items-center text-white cursor-pointer">
                  <input
                    type="radio"
                    name="videoType"
                    value="youtube"
                    checked={videoType === 'youtube'}
                    onChange={() => setVideoType('youtube')}
                    className="mr-2"
                  />
                  YouTube
                </label>
                <label className="flex items-center text-white cursor-pointer">
                  <input
                    type="radio"
                    name="videoType"
                    value="upload"
                    checked={videoType === 'upload'}
                    onChange={() => setVideoType('upload')}
                    className="mr-2"
                  />
                  Upload File
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Title *</label>
              <input
                type="text"
                value={videoTitle || ''}
                onChange={(e) => setVideoTitle(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                placeholder="e.g., Sales Objection Handling"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Description</label>
              <textarea
                value={videoDescription || ''}
                onChange={(e) => setVideoDescription(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded h-24"
                placeholder="Brief description of the video"
              />
            </div>

            {videoType === 'youtube' ? (
              <div className="mb-4">
                <label className="block text-gray-300 mb-2">YouTube URL *</label>
                <input
                  type="url"
                  value={youtubeUrl || ''}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-gray-300 mb-2">Video File *</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                />
                {uploadFile && (
                  <p className="text-sm text-gray-400 mt-2">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            )}

            {uploadProgress && (
              <div className="mb-4 text-blue-400 text-sm">{uploadProgress}</div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowVideoModal(false)
                  resetVideoForm()
                }}
                className="px-4 py-2 text-gray-300 hover:text-white"
                disabled={saveLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVideo}
                disabled={saveLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50"
              >
                {saveLoading ? 'Adding...' : 'Add Video'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Create Playlist</h2>

            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Playlist Name *</label>
              <input
                type="text"
                value={playlistName || ''}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                placeholder="e.g., Onboarding Training"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Description</label>
              <textarea
                value={playlistDescription || ''}
                onChange={(e) => setPlaylistDescription(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded h-24"
                placeholder="What is this playlist about?"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPlaylistModal(false)
                  resetPlaylistForm()
                }}
                className="px-4 py-2 text-gray-300 hover:text-white"
                disabled={saveLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={saveLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50"
              >
                {saveLoading ? 'Creating...' : 'Create Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
