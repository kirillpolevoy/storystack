'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { SidebarNav } from './SidebarNav'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useMobileMenu } from './MobileMenuProvider'

export function Sidebar() {
  const [isMinimized, setIsMinimized] = useState(false)
  const { isOpen: mobileMenuOpen, setIsOpen: setMobileMenuOpen } = useMobileMenu()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full min-h-0 px-4 relative z-10 pb-4">
      {/* Header: Logo + Toggle - Aligned with main content header */}
      <div className="flex-shrink-0 pt-5 pb-4 border-b border-gray-200/50">
        <div className={`flex items-center ${isMinimized && !isMobile ? 'justify-center' : 'justify-between'}`}>
          {isMinimized && !isMobile ? (
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
                    Social Content Workspace
                  </p>
                </div>
              </div>
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="h-7 w-7 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 active:bg-gray-100/70 flex-shrink-0 rounded-md transition-all duration-200 ease-out"
                  title="Minimize sidebar"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>
              )}
            </>
          )}
        </div>
        <div className={isMinimized && !isMobile ? "mt-4 flex justify-center" : "mt-4"}>
          <WorkspaceSwitcher isMinimized={isMinimized && !isMobile} />
        </div>
      </div>

      {/* Navigation - Takes remaining space */}
      <div className="flex-1 min-h-0">
        <SidebarNav isMinimized={isMinimized && !isMobile} onNavigate={isMobile ? () => setMobileMenuOpen(false) : undefined} />
      </div>

      {/* Logout - Fixed at bottom */}
      <div className="flex-shrink-0 pt-4 mt-auto border-t border-gray-200/60">
        {isMinimized && !isMobile ? (
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
            onClick={() => {
              handleLogout()
              if (isMobile) setMobileMenuOpen(false)
            }}
            variant="ghost" 
            className="w-full justify-start h-9 px-3 text-sm font-normal text-gray-500 hover:text-gray-700 hover:bg-gray-100/60 rounded-md transition-all duration-200 ease-out cursor-pointer"
          >
            <LogOut className="mr-3 h-3.5 w-3.5 flex-shrink-0" />
            <span>Logout</span>
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex ${isMinimized ? 'w-16' : 'w-64'} border-r border-gray-200 bg-[#f7f7f7] relative transition-all duration-300 ease-out flex-col h-screen`}>
        <div className="absolute inset-y-0 right-0 w-px bg-gray-200/50 pointer-events-none" />
        <SidebarContent />
      </aside>

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-[#f7f7f7] flex flex-col overflow-hidden">
          <div className="flex flex-col h-full overflow-y-auto pb-4">
            <SidebarContent isMobile={true} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}


