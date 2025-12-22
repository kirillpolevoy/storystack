'use client'

import { MobileMenuButton } from '@/components/app/MobileMenuButton'

export default function SubscriptionPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header - Matching app structure */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          {/* Row 1: Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 pb-4">
            <div className="flex items-center gap-3">
              <MobileMenuButton />
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                Subscriptions
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-12">
        <div className="max-w-3xl mx-auto">
          {/* Primary Heading Section - Premium spacing */}
          <div className="mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-[-0.02em] mb-5 sm:mb-6 leading-[1.1]">
              Subscriptions coming soon
            </h2>
            
            {/* Supporting Description - Refined typography */}
            <div className="space-y-3 sm:space-y-4">
              <p className="text-base sm:text-lg text-gray-700 leading-[1.6] max-w-2xl">
                StoryStack will offer paid plans for teams that want to collaborate, manage larger libraries, and stage more social content in one shared workspace.
              </p>
              <p className="text-base sm:text-lg text-gray-600 leading-[1.6] max-w-2xl">
                You're early — and we'll notify you as soon as subscriptions are available.
              </p>
            </div>
          </div>

          {/* Value Bullets - Premium card-like treatment */}
          <div className="space-y-5 sm:space-y-6">
            <div className="group flex items-start gap-5 sm:gap-6 p-5 sm:p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200">
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-200">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 tracking-tight">
                  Shared Workspaces
                </h3>
                <p className="text-sm sm:text-base text-gray-700 leading-[1.6]">
                  Collaborate with your team in a single place to stage social content.
                </p>
              </div>
            </div>

            <div className="group flex items-start gap-5 sm:gap-6 p-5 sm:p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200">
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-200">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 tracking-tight">
                  Stories & Reuse
                </h3>
                <p className="text-sm sm:text-base text-gray-700 leading-[1.6]">
                  Group assets into reusable stories for campaigns and launches.
                </p>
              </div>
            </div>

            <div className="group flex items-start gap-5 sm:gap-6 p-5 sm:p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200">
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-200">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 tracking-tight">
                  Growing Libraries
                </h3>
                <p className="text-sm sm:text-base text-gray-700 leading-[1.6]">
                  Support larger asset collections as your content needs grow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

