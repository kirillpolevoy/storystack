'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Something went wrong!</h2>
            <p className="text-gray-600 mb-6">{error.message || 'An unexpected error occurred'}</p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}


