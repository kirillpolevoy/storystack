'use client'

import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { useMobileMenu } from './MobileMenuProvider'

export function MobileMenuButton() {
  const { isOpen, setIsOpen } = useMobileMenu()

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setIsOpen(!isOpen)}
      className="lg:hidden h-9 w-9 bg-white shadow-sm border-gray-200 hover:bg-gray-50"
    >
      <Menu className="h-4 w-4" />
    </Button>
  )
}

