'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'
import { createClient } from '@/lib/supabase/client'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteParam = searchParams?.get('invite')
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(inviteParam ? 'signup' : 'login')

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.push('/app/library')
        }
      } catch (error) {
        // Continue to show login page on error
        console.error('[LoginPage] Error checking auth:', error)
      }
    }
    checkAuth()
  }, [router])

  // Update active tab when invite parameter changes
  useEffect(() => {
    if (inviteParam) {
      setActiveTab('signup')
    }
  }, [inviteParam])

  return (
    <div className="flex min-h-screen bg-white antialiased">
      {/* Left Side - Visual/Image Section (Airbnb-style) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Stronger visual background - subtle gradient with brand gold */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#faf8f5] via-[#fefcf8] to-[#faf8f5]">
          {/* Gold gradient accents */}
          <div className="absolute top-0 left-0 w-full h-2/5 bg-gradient-to-b from-accent/8 via-accent/4 to-transparent" />
          <div className="absolute bottom-0 right-0 w-full h-1/3 bg-gradient-to-t from-accent/6 via-accent/3 to-transparent" />
        </div>
        
        {/* Abstract shape referencing stacked assets/stories */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent rounded-3xl rotate-12 blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-accent rounded-2xl -rotate-12 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-accent rounded-xl rotate-45 blur-2xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-20 py-20 min-h-screen">
          {/* Logo and Header - More confident branding */}
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-20 h-20 bg-accent rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-4xl font-bold text-white">S</span>
              </div>
              <span className="text-2xl font-semibold text-gray-950 tracking-tight">StoryStack</span>
            </div>
            <h1 className="text-[48px] font-semibold text-gray-950 mb-6 tracking-[-0.02em] leading-[1.08]">
              Welcome to StoryStack
            </h1>
            <p className="text-[20px] font-medium text-gray-950 leading-[1.4] max-w-md">
              Where assets become stories
            </p>
          </div>

          {/* Feature highlights - refined spacing */}
          <div className="space-y-8">
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-gray-950 mb-1.5 tracking-tight">Smart Asset Organization</h3>
                <p className="text-[15px] text-gray-700 leading-[1.5]">Automatically tag and organize assets so your team can quickly find what's ready to post.</p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-gray-950 mb-1.5 tracking-tight">Story-Based Workflow</h3>
                <p className="text-[15px] text-gray-700 leading-[1.5]">Group assets into reusable stories for social campaigns and launches.</p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-gray-950 mb-1.5 tracking-tight">Built for Small Teams</h3>
                <p className="text-[15px] text-gray-700 leading-[1.5]">A focused workspace for staging social content together.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div className="flex-1 flex items-center justify-center px-8 py-20 bg-gray-50 min-h-screen">
        <div className="w-full max-w-md">
          {/* Product Card Container */}
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.08)] border border-gray-200/60 p-12">
            {/* Mobile Logo - Only visible on small screens */}
            <div className="lg:hidden mb-8 text-center">
              <div className="inline-flex w-16 h-16 bg-accent rounded-2xl items-center justify-center shadow-lg mb-4">
                <span className="text-3xl font-bold text-white">S</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">StoryStack</h1>
              <p className="text-gray-600">Sign in or create an account</p>
            </div>

            {/* Desktop Header - Aligned with left side */}
            <div className="hidden lg:block mb-10">
              <h2 
                key={activeTab}
                className="text-[32px] font-semibold text-gray-950 mb-3 leading-[1.2] tracking-[-0.01em] animate-in fade-in slide-in-from-top-1 duration-300"
              >
                {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p 
                key={`${activeTab}-desc`}
                className="text-[15px] text-gray-700 leading-[1.5] animate-in fade-in slide-in-from-top-1 duration-300 delay-75"
              >
                {activeTab === 'login'
                  ? 'Sign in to your StoryStack workspace'
                  : 'Start organizing your photos with AI-powered tagging'}
              </p>
            </div>

          {/* Refined Switcher */}
          <div className="mb-10">
            <div className="relative flex items-center justify-center gap-20 border-b border-gray-200/80">
              <button
                onClick={() => setActiveTab('login')}
                className="relative px-0 py-4 text-[15px] font-normal transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 rounded-t-sm -mb-px"
                aria-pressed={activeTab === 'login'}
              >
                <span className={`transition-colors duration-200 ${
                  activeTab === 'login' 
                    ? 'text-gray-950 font-medium' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                  Sign In
                </span>
                {/* Underline indicator */}
                {activeTab === 'login' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent transition-all duration-300 ease-out" />
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('signup')}
                className="relative px-0 py-4 text-[15px] font-normal transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 rounded-t-sm -mb-px"
                aria-pressed={activeTab === 'signup'}
              >
                <span className={`transition-colors duration-200 ${
                  activeTab === 'signup' 
                    ? 'text-gray-950 font-medium' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                  Sign Up
                </span>
                {/* Underline indicator */}
                {activeTab === 'signup' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent transition-all duration-300 ease-out" />
                )}
              </button>
            </div>
          </div>

            {/* Form Content with Smooth Transition */}
            <div className="relative min-h-[400px]">
              <div 
                key="login"
                className={`transition-all duration-300 ease-out ${
                  activeTab === 'login' 
                    ? 'opacity-100 translate-x-0 pointer-events-auto' 
                    : 'opacity-0 -translate-x-2 pointer-events-none absolute inset-0'
                }`}
              >
                <LoginForm />
              </div>
              <div 
                key="signup"
                className={`transition-all duration-300 ease-out ${
                  activeTab === 'signup' 
                    ? 'opacity-100 translate-x-0 pointer-events-auto' 
                    : 'opacity-0 translate-x-2 pointer-events-none absolute inset-0'
                }`}
              >
                <SignupForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-white antialiased items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}

