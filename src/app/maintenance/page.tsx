export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <svg className="mx-auto h-16 w-16 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Temporarily Unavailable</h1>
        <p className="text-gray-400 text-base leading-relaxed">
          We're performing scheduled maintenance to improve your experience. We'll be back shortly.
        </p>
        <p className="text-gray-600 text-sm mt-6">Please check back soon.</p>
      </div>
    </div>
  )
}
