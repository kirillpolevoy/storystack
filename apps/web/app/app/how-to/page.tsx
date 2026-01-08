'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, ArrowRight, Check, Upload, Tags, Search, Users } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { MobileMenuButton } from '@/components/app/MobileMenuButton'
import { createClient } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=400&h=400&fit=crop&q=80',
]

type OnboardingState = 'loading' | 'welcome' | 'tags-created' | 'complete'

export default function HowToPage() {
  const [state, setState] = useState<OnboardingState>('loading')
  const [tagCount, setTagCount] = useState(0)
  const [photoCount, setPhotoCount] = useState(0)
  const { activeWorkspaceId } = useWorkspace()

  useEffect(() => {
    async function checkProgress() {
      if (!activeWorkspaceId) return

      const supabase = createClient()

      const { count: tags } = await supabase
        .from('tags')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', activeWorkspaceId)

      const { count: photos } = await supabase
        .from('assets')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', activeWorkspaceId)

      setTagCount(tags || 0)
      setPhotoCount(photos || 0)

      if ((photos || 0) > 0) {
        setState('complete')
      } else if ((tags || 0) > 0) {
        setState('tags-created')
      } else {
        setState('welcome')
      }
    }

    checkProgress()
  }, [activeWorkspaceId])

  return (
    <div className="flex h-full flex-col bg-[#FDFCFB]">
      {/* Header */}
      <div className="border-b border-gray-200/60 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <div className="px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <MobileMenuButton />
            <span className="text-sm font-medium text-gray-500">Getting Started</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 lg:px-8 py-12 sm:py-16">

          {state === 'loading' && <LoadingState />}
          {state === 'welcome' && <WelcomeState />}
          {state === 'tags-created' && <TagsCreatedState tagCount={tagCount} />}
          {state === 'complete' && <CompleteState tagCount={tagCount} photoCount={photoCount} />}

        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded-lg w-3/4" />
        <div className="h-6 bg-gray-200 rounded-lg w-full" />
        <div className="h-6 bg-gray-200 rounded-lg w-2/3" />
      </div>
      <div className="h-12 bg-gray-200 rounded-lg w-40" />
    </div>
  )
}

function WelcomeState() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-5">
        <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight leading-tight">
          Let's organize your photos.
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          Tell us how you categorize your content, upload your photos, and let AI handle the tagging.
          You'll go from scattered files to a searchable library in minutes.
        </p>
        <div className="pt-2">
          <Link href="/app/tags">
            <Button size="lg" className="h-12 px-6 text-base font-medium">
              Create your tags
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* How it works - Visual journey */}
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">How it works</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Step 1: Tags */}
        <div className="grid sm:grid-cols-2 gap-6 items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Create your tags</h3>
            </div>
            <p className="text-gray-600 pl-11">
              Define categories that match how your team thinks — product shots, campaigns, lifestyle, seasons.
            </p>
            <p className="text-gray-600 pl-11">
              <span className="font-medium text-gray-900">Enable AI tagging</span> by clicking the sparkle icon next to any tag. AI will then automatically apply that tag to matching photos.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="space-y-2">
              {['Product', 'Lifestyle', 'Campaign'].map((tag, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-900">{tag}</span>
                  <div className="flex items-center gap-1.5">
                    {i < 2 && <span className="text-xs text-accent font-medium">AI</span>}
                    <Sparkles className={`h-4 w-4 ${i < 2 ? 'text-accent' : 'text-gray-300'}`} />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-center py-2 px-3 border-2 border-dashed border-gray-300 rounded-lg">
                <span className="text-sm text-gray-400">+ Add more tags</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Gold sparkle = AI tagging enabled
            </p>
          </div>
        </div>

        {/* Step 2: Upload */}
        <div className="grid sm:grid-cols-2 gap-6 items-center">
          <div className="space-y-3 sm:order-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Upload your photos</h3>
            </div>
            <p className="text-gray-600 pl-11">
              Drag and drop as many photos as you want. They'll upload in the background while you keep working.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:order-1">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Drop photos here</p>
              <p className="text-xs text-gray-500 mt-1">or click to browse</p>
            </div>
          </div>
        </div>

        {/* Step 3: AI Magic - This is the hero moment */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-accent/10 to-accent/5 rounded-2xl" />
          <div className="relative grid sm:grid-cols-2 gap-6 items-center p-6 sm:p-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">AI tags everything</h3>
              </div>
              <p className="text-gray-600 pl-11">
                This is where the magic happens. AI analyzes each photo and applies relevant tags automatically.
                You can always edit or add more tags later.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="aspect-[4/3] relative">
                <Image src={DEMO_PHOTOS[0]} alt="" fill className="object-cover" unoptimized />
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span>Auto-tagged by AI</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Product', 'Lifestyle'].map((tag, i) => (
                    <span key={i} className="inline-flex items-center px-3 py-1.5 bg-accent/10 text-accent rounded-full text-sm font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Use it */}
        <div className="grid sm:grid-cols-2 gap-6 items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold">
                4
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Find anything instantly</h3>
            </div>
            <p className="text-gray-600 pl-11">
              Search by tag, combine filters, and find the exact photos you need.
              Create Stories to group photos for campaigns or share with your team.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
              <Search className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">Search by tag...</span>
            </div>
            <div className="flex gap-2">
              {['Product', 'Summer'].map((tag, i) => (
                <span key={i} className="px-3 py-1.5 bg-accent text-white rounded-full text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_PHOTOS.map((photo, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden">
                  <Image src={photo} alt="" width={100} height={100} className="object-cover w-full h-full" unoptimized />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="font-medium text-gray-900">Ready to get started?</p>
            <p className="text-sm text-gray-500">It only takes a few minutes to set up.</p>
          </div>
          <Link href="/app/tags">
            <Button>
              Create Tags
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function TagsCreatedState({ tagCount }: { tagCount: number }) {
  return (
    <div className="space-y-10">
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
          <Check className="h-4 w-4 text-green-600" />
        </div>
        <span className="text-sm font-medium text-green-700">
          {tagCount} {tagCount === 1 ? 'tag' : 'tags'} created
        </span>
      </div>

      {/* Hero */}
      <div className="space-y-5">
        <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight leading-tight">
          Now, add your photos.
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          Upload your first photos and watch AI tag them automatically.
          The more you upload, the faster your library grows.
        </p>
        <div className="pt-2">
          <Link href="/app/library">
            <Button size="lg" className="h-12 px-6 text-base font-medium">
              Go to Library
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* What to expect */}
      <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-accent" />
          <h3 className="text-lg font-semibold text-gray-900">What happens next</h3>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <Upload className="h-5 w-5 text-gray-600" />
            </div>
            <p className="font-medium text-gray-900">You upload</p>
            <p className="text-sm text-gray-600">Drag photos into the library or click Upload.</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <p className="font-medium text-gray-900">AI tags automatically</p>
            <p className="text-sm text-gray-600">Each photo is analyzed and tagged instantly.</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <Search className="h-5 w-5 text-gray-600" />
            </div>
            <p className="font-medium text-gray-900">You search & organize</p>
            <p className="text-sm text-gray-600">Find photos by tag or create stories.</p>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-600 text-sm font-bold">?</span>
        </div>
        <div>
          <p className="font-medium text-gray-900">Pro tip</p>
          <p className="text-sm text-gray-600 mt-1">
            Start with 10-20 photos to see how AI tagging works. You can always upload more later.
          </p>
        </div>
      </div>
    </div>
  )
}

function CompleteState({ tagCount, photoCount }: { tagCount: number; photoCount: number }) {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-5">
        <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight leading-tight">
          Your library is ready.
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          You've set up {tagCount} tags and uploaded {photoCount.toLocaleString()} photos.
          Everything is organized and searchable. Here's what to do next.
        </p>
      </div>

      {/* What you can do now */}
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">What you can do</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Search & Filter */}
        <div className="grid sm:grid-cols-2 gap-6 items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center">
                <Search className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Search your library</h3>
            </div>
            <p className="text-gray-600 pl-11">
              Find any photo instantly. Search by tag, combine multiple filters, or browse by location.
            </p>
            <div className="pl-11 pt-1">
              <Link href="/app/library">
                <Button variant="outline" size="sm">
                  Go to Library
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
              <Search className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">Search by tag...</span>
            </div>
            <div className="flex gap-2">
              {['Product', 'Summer'].map((tag, i) => (
                <span key={i} className="px-3 py-1.5 bg-accent text-white rounded-full text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_PHOTOS.map((photo, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden">
                  <Image src={photo} alt="" width={100} height={100} className="object-cover w-full h-full" unoptimized />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Create Stories */}
        <div className="grid sm:grid-cols-2 gap-6 items-center">
          <div className="space-y-3 sm:order-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center">
                <Tags className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Create stories</h3>
            </div>
            <p className="text-gray-600 pl-11">
              Group photos for campaigns, product launches, or social content. Drag to reorder and share with your team.
            </p>
            <div className="pl-11 pt-1">
              <Link href="/app/stories">
                <Button variant="outline" size="sm">
                  Go to Stories
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:order-1">
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Summer Campaign', count: 12 },
                { name: 'Product Launch', count: 8 },
              ].map((story, i) => (
                <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="aspect-video relative bg-gray-100">
                    <Image src={DEMO_PHOTOS[i]} alt="" fill className="object-cover" unoptimized />
                  </div>
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-900 truncate">{story.name}</span>
                    <span className="text-xs text-gray-500">{story.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Invite Team */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-blue-100/50 to-blue-50 rounded-2xl" />
          <div className="relative grid sm:grid-cols-2 gap-6 items-center p-6 sm:p-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Invite your team</h3>
              </div>
              <p className="text-gray-600 pl-11">
                Collaborate with teammates on your library. Everyone can upload, tag, and create stories together.
              </p>
              <div className="pl-11 pt-1">
                <Link href="/app/workspace-settings">
                  <Button size="sm">
                    Invite Teammates
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
                    Y
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">You</p>
                    <p className="text-xs text-gray-500">Owner</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 opacity-50">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border-2 border-dashed border-gray-300">
                    <span className="text-gray-400 text-sm">+</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Invite teammates...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="font-medium text-gray-900">Ready to explore?</p>
            <p className="text-sm text-gray-500">Click any photo to edit tags or add to a story.</p>
          </div>
          <Link href="/app/library">
            <Button>
              Browse Library
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
