'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogOut, Library, BookOpen, Tag, HelpCircle, User, Settings, ChevronLeft, ChevronRight, CreditCard, Mail } from 'lucide-react'

interface SidebarNavProps {
  isMinimized: boolean
  onNavigate?: () => void
}

export function SidebarNav({ isMinimized, onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav className="space-y-0.5 h-full flex flex-col pt-4">
        <NavLink href="/app/library" pathname={pathname} isMinimized={isMinimized} onNavigate={onNavigate} router={router}>
          <Library className={isMinimized ? "h-5 w-5 flex-shrink-0" : "mr-3 h-4 w-4 flex-shrink-0"} />
          {!isMinimized && <span>Library</span>}
        </NavLink>
        <NavLink href="/app/stories" pathname={pathname} isMinimized={isMinimized} onNavigate={onNavigate} router={router}>
          <BookOpen className={isMinimized ? "h-5 w-5 flex-shrink-0" : "mr-3 h-4 w-4 flex-shrink-0"} />
          {!isMinimized && <span>Stories</span>}
        </NavLink>

        {/* Spacing gap between primary and secondary */}
        {!isMinimized && <div className="h-4" />}

        {/* Secondary Navigation - Reduced emphasis */}
        <NavLink href="/app/workspace-settings" pathname={pathname} secondary isMinimized={isMinimized} onNavigate={onNavigate} router={router}>
          <Settings className={isMinimized ? "h-5 w-5 flex-shrink-0" : "mr-3 h-3.5 w-3.5 flex-shrink-0"} />
          {!isMinimized && <span>Workspaces</span>}
        </NavLink>
        <NavLink href="/app/tags" pathname={pathname} secondary isMinimized={isMinimized} onNavigate={onNavigate} router={router}>
          <Tag className={isMinimized ? "h-5 w-5 flex-shrink-0" : "mr-3 h-3.5 w-3.5 flex-shrink-0"} />
          {!isMinimized && <span>Tags</span>}
        </NavLink>
        <NavLink href="/app/subscription" pathname={pathname} secondary isMinimized={isMinimized} onNavigate={onNavigate} router={router}>
          <CreditCard className={isMinimized ? "h-5 w-5 flex-shrink-0" : "mr-3 h-3.5 w-3.5 flex-shrink-0"} />
          {!isMinimized && <span>Subscriptions</span>}
        </NavLink>
        
        {/* Spacing gap before profile section */}
        {!isMinimized && <div className="h-4" />}
        
        <NavLink href="/app/profile" pathname={pathname} secondary isMinimized={isMinimized} onNavigate={onNavigate} router={router}>
          <User className={isMinimized ? "h-5 w-5 flex-shrink-0" : "mr-3 h-3.5 w-3.5 flex-shrink-0"} />
          {!isMinimized && <span>Profile</span>}
        </NavLink>
        <NavLink href="/app/contact" pathname={pathname} secondary support isMinimized={isMinimized} onNavigate={onNavigate} router={router}>
          <Mail className={isMinimized ? "h-5 w-5 flex-shrink-0" : "mr-3 h-3.5 w-3.5 flex-shrink-0"} />
          {!isMinimized && <span>Contact Us</span>}
        </NavLink>
      </nav>
  )
}

// NavLink component - Aligned with app design system
function NavLink({
  href,
  pathname,
  children,
  secondary = false,
  support = false,
  isMinimized = false,
  onNavigate,
  router,
}: {
  href: string
  pathname: string
  children: React.ReactNode
  secondary?: boolean
  support?: boolean
  isMinimized?: boolean
  onNavigate?: () => void
  router?: ReturnType<typeof useRouter>
}) {
  const isActive = pathname === href || 
                   (href === '/app/library' && pathname === '/app/library') ||
                   (href === '/app/stories' && pathname.startsWith('/app/stories')) ||
                   (href === '/app/contact' && pathname === '/app/contact')
  
  // Use app's standard spacing and typography
  // Consistent height for all nav items when minimized
  const navHeight = isMinimized ? 'h-10' : (secondary ? 'h-9' : 'h-10')
  let className = `w-full ${isMinimized ? 'justify-center' : 'justify-start'} ${isMinimized ? 'px-0' : 'px-3'} text-sm rounded-md transition-all duration-200 ease-out group cursor-pointer relative ${navHeight}`
  
  if (secondary) {
    className += ' font-normal'
    if (support) {
      className += ' text-gray-500 hover:text-gray-700 hover:bg-gray-100/60'
    } else {
      className += ' text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
    }
  } else {
    className += ' font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100'
  }
  
  // Active state using app's accent color
  if (isActive) {
    className += ' bg-accent/10 text-gray-900 font-semibold'
  }

  const tooltipText = isMinimized 
    ? (href.includes('library') ? 'Library' 
      : href.includes('stories') ? 'Stories' 
      : href.includes('workspace-settings') ? 'Workspaces'
      : href.includes('tags') ? 'Tags' 
      : href.includes('subscription') ? 'Subscriptions'
      : href.includes('profile') ? 'Profile'
      : href.includes('contact') ? 'Contact Us'
      : undefined)
    : undefined

  const handleClick = (e: React.MouseEvent) => {
    if (onNavigate && router) {
      // Let navigation happen first, then close the sheet after a small delay
      e.preventDefault()
      // Use router.push for client-side navigation, then close sheet
      router.push(href)
      // Close sheet after navigation starts (small delay to allow transition)
      setTimeout(() => {
        onNavigate()
      }, 150)
    }
  }

  return (
    <Link href={href} className="block relative" title={tooltipText} onClick={onNavigate ? handleClick : undefined}>
      {/* Active indicator using app's accent color */}
      {isActive && (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 ${isMinimized ? 'w-1 h-8 rounded-r-full' : 'w-[3px] h-[18px] rounded-r-full'} bg-accent`} />
      )}
      <Button variant="ghost" className={className}>
        {children}
      </Button>
    </Link>
  )
}
