'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Upload, Tag, BookOpen, ArrowRight } from 'lucide-react'

interface WelcomeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WELCOME_MODAL_KEY = '@storystack:welcome_shown'

export function WelcomeModal({ open, onOpenChange }: WelcomeModalProps) {
  const router = useRouter()

  const handleGetStarted = () => {
    // Mark welcome as shown
    localStorage.setItem(WELCOME_MODAL_KEY, 'true')
    onOpenChange(false)
    router.push('/app/how-to')
  }

  const handleSkip = () => {
    // Mark welcome as shown
    localStorage.setItem(WELCOME_MODAL_KEY, 'true')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header with accent background */}
        <div className="bg-accent/5 border-b border-accent/10 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Welcome to StoryStack
              </DialogTitle>
            </DialogHeader>
          </div>
          <DialogDescription className="text-sm text-gray-600 leading-relaxed">
            Your central hub for organizing photos and creating stories. Let's get you started.
          </DialogDescription>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Quick overview */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100/80 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Tag className="h-4 w-4 text-accent" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Set up your tags</h4>
                <p className="text-xs text-gray-500 mt-0.5">Create categories to organize your photos</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100/80 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Upload className="h-4 w-4 text-accent" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Upload your photos</h4>
                <p className="text-xs text-gray-500 mt-0.5">Import from your device or drag and drop</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100/80 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <BookOpen className="h-4 w-4 text-accent" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Create stories</h4>
                <p className="text-xs text-gray-500 mt-0.5">Group photos into reusable collections</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Button
              onClick={handleGetStarted}
              className="w-full h-11 gap-2"
            >
              See how it works
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="w-full text-gray-500 hover:text-gray-700"
            >
              Skip for now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook to manage welcome modal state
export function useWelcomeModal() {
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    // Check if this is a new user (welcome not yet shown)
    const welcomeShown = localStorage.getItem(WELCOME_MODAL_KEY)
    const isNewSignup = sessionStorage.getItem('@storystack:new_signup')

    if (!welcomeShown && isNewSignup) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setShowWelcome(true)
        // Clear the new signup flag
        sessionStorage.removeItem('@storystack:new_signup')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  return {
    showWelcome,
    setShowWelcome,
  }
}
