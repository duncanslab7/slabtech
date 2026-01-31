import { useState, useEffect } from 'react'

interface BlockingVideo {
  video_id: string
  video_title: string
  blocks_transcripts: boolean
  blocks_training_playlists: boolean
  has_passed: boolean
}

interface LockedSectionsData {
  transcripts: {
    locked: boolean
    blockingVideos: BlockingVideo[]
  }
  trainingPlaylists: {
    locked: boolean
    blockingVideos: BlockingVideo[]
  }
}

export function useLockedSections() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LockedSectionsData>({
    transcripts: { locked: false, blockingVideos: [] },
    trainingPlaylists: { locked: false, blockingVideos: [] }
  })

  useEffect(() => {
    fetchLockedSections()
  }, [])

  const fetchLockedSections = async () => {
    try {
      const response = await fetch('/api/user/locked-sections')
      const result = await response.json()

      if (response.ok) {
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching locked sections:', error)
    } finally {
      setLoading(false)
    }
  }

  return { ...data, loading, refresh: fetchLockedSections }
}
