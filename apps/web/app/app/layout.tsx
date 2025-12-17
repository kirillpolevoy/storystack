import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogOut, Library, BookOpen, Tag, HelpCircle, User } from 'lucide-react'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const handleLogout = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r border-gray-200 bg-white">
        <div className="flex h-full flex-col px-4 py-6">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              StoryStack
            </h2>
            <p className="text-xs text-gray-500 font-medium">Content Management</p>
          </div>
          <nav className="flex-1 space-y-1">
            <Link href="/app/library">
              <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <Library className="mr-3 h-4 w-4" />
                Library
              </Button>
            </Link>
            <Link href="/app/stories">
              <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <BookOpen className="mr-3 h-4 w-4" />
                Stories
              </Button>
            </Link>
            <Link href="/app/tags">
              <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <Tag className="mr-3 h-4 w-4" />
                Tag Management
              </Button>
            </Link>
            <Link href="/app/how-to">
              <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <HelpCircle className="mr-3 h-4 w-4" />
                How To
              </Button>
            </Link>
            <Link href="/app/profile">
              <Button variant="ghost" className="w-full justify-start h-10 px-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <User className="mr-3 h-4 w-4" />
                Profile
              </Button>
            </Link>
          </nav>
          <form action={handleLogout} className="pt-4 border-t border-gray-200">
            <Button type="submit" variant="ghost" className="w-full justify-start h-10 px-3 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <LogOut className="mr-3 h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden bg-background">{children}</main>
    </div>
  )
}

