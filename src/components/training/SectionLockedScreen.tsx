'use client'

import Link from 'next/link'

interface BlockingVideo {
  video_id: string
  video_title: string
  blocks_transcripts: boolean
  blocks_training_playlists: boolean
  has_passed: boolean
}

interface SectionLockedScreenProps {
  section: 'transcripts' | 'training_playlists'
  blockingVideos: BlockingVideo[]
  companySlug: string
}

export function SectionLockedScreen({ section, blockingVideos, companySlug }: SectionLockedScreenProps) {
  const sectionTitles = {
    transcripts: 'Transcripts',
    training_playlists: 'Training Playlists'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {sectionTitles[section]} Locked
          </h1>
          <p className="text-gray-600">
            Complete the required training quiz{blockingVideos.length > 1 ? 'zes' : ''} to unlock this section
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <h2 className="font-semibold text-gray-900">Required Quiz{blockingVideos.length > 1 ? 'zes' : ''}:</h2>
          {blockingVideos.map((video) => (
            <div key={video.video_id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{video.video_title}</h3>
                <p className="text-sm text-gray-600">Score 80% or higher to unlock</p>
              </div>
              <Link
                href={`/c/${companySlug}/training`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium transition-colors"
              >
                Take Quiz →
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center pt-6 border-t border-gray-200">
          <Link
            href={`/c/${companySlug}/dashboard`}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
