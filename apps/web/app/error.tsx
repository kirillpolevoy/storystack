'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
    console.error('Error digest:', error.digest)
    console.error('Error stack:', error.stack)
  }, [error])

  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-6">
          {isDevelopment && error.message
            ? error.message
            : 'An unexpected error occurred'}
        </p>
        {isDevelopment && error.digest && (
          <p className="text-xs text-gray-500 mb-4">Digest: {error.digest}</p>
        )}
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}

