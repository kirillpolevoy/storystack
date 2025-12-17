import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">404 - Page Not Found</h2>
        <p className="text-gray-600 mb-6">The page you're looking for doesn't exist.</p>
        <Link href="/app/library">
          <Button>Go to Library</Button>
        </Link>
      </div>
    </div>
  )
}

