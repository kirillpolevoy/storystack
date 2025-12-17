'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { SidebarNav } from './SidebarNav'
import { createClient } from '@/lib/supabase/client'

export function Sidebar() {
  const [isMinimized, setIsMinimized] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className={`${isMinimized ? 'w-16' : 'w-64'} border-r border-gray-200 bg-[#f7f7f7] relative transition-all duration-300 ease-out flex flex-col h-screen`}>
      {/* Subtle separator matching app design */}
      <div className="absolute inset-y-0 right-0 w-px bg-gray-200/50 pointer-events-none" />
      
      <div className="flex flex-col h-full px-4 relative z-10">
        {/* Header: Logo + Toggle - Aligned with main content header */}
        {/* Main content: pt-4 (16px) + title row pb-4 (16px) + tabs row pb-3 (12px) = 44px padding + content heights */}
        {/* Sidebar: pt-4 (16px) + logo content (~44px) + pb to match = need ~52px more to align borders */}
        <div className="flex-shrink-0 pt-5 pb-[52px] border-b border-gray-200/50">
          <div className={`flex items-center ${isMinimized ? 'justify-center' : 'justify-between'}`}>
            {isMinimized ? (
              <div className="flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="StoryStack"
                  width={24}
                  height={24}
                  className="rounded-[6px] shadow-sm"
                  priority
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative flex-shrink-0">
                    <Image
                      src="/logo.png"
                      alt="StoryStack"
                      width={32}
                      height={32}
                      className="rounded-[8px] shadow-sm"
                      priority
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[17px] font-semibold text-gray-900 tracking-[-0.01em] leading-[1.2]">
                      StoryStack
                    </h2>
                    <p className="text-[11px] text-gray-500 font-normal tracking-[0.01em] leading-[1.3] mt-[2px]">
                      Content Management
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="h-7 w-7 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 active:bg-gray-100/70 flex-shrink-0 rounded-md transition-all duration-200 ease-out"
                  title="Minimize sidebar"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Navigation - Takes remaining space */}
        <div className="flex-1 min-h-0">
          <SidebarNav isMinimized={isMinimized} />
        </div>

        {/* Logout - Fixed at bottom */}
        <div className="flex-shrink-0 pt-4 mt-auto border-t border-gray-200/60">
          {isMinimized ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(!isMinimized)}
              className="w-full h-9 text-gray-500 hover:text-gray-700 hover:bg-gray-100/60"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleLogout}
              variant="ghost" 
              className="w-full justify-start h-9 px-3 text-sm font-normal text-gray-500 hover:text-gray-700 hover:bg-gray-100/60 rounded-md transition-all duration-200 ease-out cursor-pointer"
            >
              <LogOut className="mr-3 h-3.5 w-3.5 flex-shrink-0" />
              <span>Logout</span>
            </Button>
          )}
        </div>
      </div>
    </aside>
  )
}

