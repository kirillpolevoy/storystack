'use client'

import { useState, createContext, useContext, ReactNode } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Sidebar } from './Sidebar'

// Context for sharing mobile menu state
const MobileMenuContext = createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => {},
})

export const useMobileMenu = () => useContext(MobileMenuContext)

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <MobileMenuContext.Provider value={{ isOpen: mobileMenuOpen, setIsOpen: setMobileMenuOpen }}>
      {children}
    </MobileMenuContext.Provider>
  )
}

