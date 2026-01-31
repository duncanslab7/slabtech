'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Video {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  video_type: 'youtube' | 'upload'
  position?: number
}

interface Playlist {
  id: string
  name: string
  description: string | null
}

export default function EditPlaylistPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string
  const playlistId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [playlistVideos, setPlaylistVideos] = useState<Video[]>([])
  const [allVideos, setAllVideos] = useState<Video[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchData()
  }, [playlistId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch playlist with videos
      const playlistResponse = await fetch(`/api/company/playlists/${playlistId}`)
      const playlistData = await playlistResponse.json()

      if (!playlistResponse.ok) {
        throw new Error(playlistData.error || 'Failed to load playlist')
      }

      setPlaylist(playlistData.playlist)
      setPlaylistVideos(playlistData.videos || [])

      // Fetch all available videos
      const videosResponse = await fetch('/api/company/training-videos')
      const videosData = await videosResponse.json()

      if (videosData.videos) {
        // Filter out videos already in playlist
        const playlistVideoIds = playlistData.videos.map((v: Video) => v.id)
        const availableVideos = videosData.videos.filter(
          (v: Video) => !playlistVideoIds.includes(v.id)
        )
        setAllVideos(availableVideos)
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleAddVideo = async (videoId: string) => {
    setSaveLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/company/playlists/${playlistId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add video')
      }

      setMessage({ type: 'success', text: 'Video added to playlist!' })
      setShowAddModal(false)
      fetchData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaveLoading(false)
    }
  }

  const handleRemoveVideo = async (videoId: string) => {
    if (!confirm('Remove this video from the playlist?')) {
      return
    }

    try {
      const response = await fetch(`/api/company/playlists/${playlistId}/videos?video_id=${videoId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove video')
      }

      setMessage({ type: 'success', text: 'Video removed from playlist' })
      fetchData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="p-8">
        <p className="text-red-400">Playlist not found</p>
        <Link href={`/c/${slug}/training/manage`} className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
          ← Back to Manage Training
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href={`/c/${slug}/training/manage`} className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
        ← Back to Manage Training
      </Link>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Edit Playlist: {playlist.name}</h1>
          {playlist.description && (
            <p className="text-gray-400">{playlist.description}</p>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium"
        >
          + Add Video
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Videos in Playlist */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white mb-4">Videos in Playlist ({playlistVideos.length})</h2>

        {playlistVideos.map((video, index) => (
          <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden flex items-center">
            <div className="w-12 bg-gray-700 h-full flex items-center justify-center text-gray-400 font-medium py-4">
              {index + 1}
            </div>

            {video.thumbnail_url && (
              <img src={video.thumbnail_url} alt={video.title} className="w-32 h-20 object-cover" />
            )}

            <div className="flex-1 p-4">
              <h3 className="text-white font-medium">{video.title}</h3>
              {video.description && (
                <p className="text-gray-400 text-sm line-clamp-1">{video.description}</p>
              )}
            </div>

            <div className="px-4">
              <button
                onClick={() => handleRemoveVideo(video.id)}
                className="text-red-400 hover:text-red-300 px-4 py-2"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {playlistVideos.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-gray-800 rounded-lg">
            <p>No videos in this playlist yet. Click "Add Video" to get started!</p>
          </div>
        )}
      </div>

      {/* Add Video Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Add Video to Playlist</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white text-2xl">
                ×
              </button>
            </div>

            <div className="space-y-3">
              {allVideos.map((video) => (
                <div key={video.id} className="bg-gray-700 rounded-lg p-4 flex items-center gap-4">
                  {video.thumbnail_url && (
                    <img src={video.thumbnail_url} alt={video.title} className="w-24 h-16 object-cover rounded" />
                  )}

                  <div className="flex-1">
                    <h3 className="text-white font-medium">{video.title}</h3>
                    {video.description && (
                      <p className="text-gray-400 text-sm line-clamp-1">{video.description}</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleAddVideo(video.id)}
                    disabled={saveLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              ))}

              {allVideos.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>All available videos are already in this playlist.</p>
                  <Link
                    href={`/c/${slug}/training/manage`}
                    className="text-blue-400 hover:text-blue-300 mt-2 inline-block"
                    onClick={() => setShowAddModal(false)}
                  >
                    Upload more videos
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
