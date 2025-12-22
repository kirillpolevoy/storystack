import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay> & {
    variant?: 'default' | 'subtle' // Variant for different overlay styles
  }
>(({ className, variant = 'default', style, ...props }, ref) => {
  const overlayStyle = variant === 'subtle' ? {
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // More visible for debugging
    backdropFilter: 'blur(8px)', // Stronger blur for debugging
    WebkitBackdropFilter: 'blur(8px)',
    MozBackdropFilter: 'blur(8px)', // Firefox support
    pointerEvents: 'none' as const,
    ...style
  } : style

  // Use a callback ref to debug when overlay mounts
  const overlayRef = React.useCallback((node: HTMLElement | null) => {
    console.log('[SheetOverlay] Ref callback called, node:', node, 'variant:', variant)
    if (node && variant === 'subtle') {
      console.log('[SheetOverlay] Overlay mounted:', node)
      const computed = window.getComputedStyle(node)
      console.log('[SheetOverlay] Computed backdropFilter:', computed.backdropFilter)
      console.log('[SheetOverlay] Computed WebkitBackdropFilter:', computed.webkitBackdropFilter)
      console.log('[SheetOverlay] Computed backgroundColor:', computed.backgroundColor)
      console.log('[SheetOverlay] Computed zIndex:', computed.zIndex)
      console.log('[SheetOverlay] Computed position:', computed.position)
      console.log('[SheetOverlay] Inline style backdropFilter:', node.style.backdropFilter)
      console.log('[SheetOverlay] Inline style WebkitBackdropFilter:', node.style.webkitBackdropFilter)
      console.log('[SheetOverlay] Inline style backgroundColor:', node.style.backgroundColor)
      
      // Check if backdrop-filter is actually applied
      if (!computed.backdropFilter && !computed.webkitBackdropFilter && !node.style.backdropFilter && !node.style.webkitBackdropFilter) {
        console.error('[SheetOverlay] ⚠️ BACKDROP-FILTER NOT APPLIED! Styles:', overlayStyle)
      }
    }
    // Forward ref if provided
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLElement | null>).current = node
    }
  }, [variant, ref, overlayStyle])

  console.log('[SheetOverlay] Rendering with variant:', variant, 'style:', overlayStyle)

  return (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        variant === 'subtle' 
          ? "pointer-events-none" // Airbnb-style: subtle overlay, styles applied via inline styles
          : "bg-black/80", // Default dark overlay for modals
        className
      )}
      style={overlayStyle}
      data-state={props['data-state']} // Ensure data-state is passed through for animations
      {...props}
      ref={overlayRef}
    />
  )
})
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-[51] gap-4 bg-white border border-gray-200 p-6 shadow-lg transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-200",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  showOverlay?: boolean // Allow controlling overlay visibility
  overlayVariant?: 'default' | 'subtle' // Control overlay style
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, showOverlay = true, overlayVariant = 'default', ...props }, ref) => {
  const overlayRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node && overlayVariant === 'subtle') {
      // Force the background color and backdrop filter using !important
      node.style.setProperty('background-color', 'rgba(0, 0, 0, 0.12)', 'important')
      node.style.setProperty('backdrop-filter', 'blur(2px) saturate(0.95) brightness(0.98)', 'important')
      node.style.setProperty('-webkit-backdrop-filter', 'blur(2px) saturate(0.95) brightness(0.98)', 'important')
      node.style.setProperty('pointer-events', 'none', 'important')
    }
  }, [overlayVariant])

  return (
  <SheetPortal>
    {showOverlay && (
      <div
        ref={overlayRef}
        className={cn(
          "fixed inset-0 z-50",
          overlayVariant === 'subtle' 
            ? "subtle-overlay" 
            : "bg-black/80"
        )}
      />
    )}
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      onPointerDownOutside={(e) => {
        // Allow clicks outside to pass through when overlay is disabled
        if (!showOverlay) {
          e.preventDefault()
        }
      }}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
}

