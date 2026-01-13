'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps {
  value?: number[]
  defaultValue?: number[]
  max?: number
  min?: number
  step?: number
  onValueChange?: (value: number[]) => void
  className?: string
  disabled?: boolean
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      defaultValue,
      max = 100,
      min = 0,
      step = 1,
      onValueChange,
      className,
      disabled = false,
    },
    ref
  ) => {
    const currentValue = value?.[0] ?? defaultValue?.[0] ?? min

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value)
      onValueChange?.([newValue])
    }

    // Calculate percentage for styling
    const percentage = ((currentValue - min) / (max - min)) * 100

    return (
      <div className={cn('relative flex w-full touch-none select-none items-center', className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          disabled={disabled}
          className="w-full h-2 appearance-none cursor-pointer bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-2 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          style={{
            background: `linear-gradient(to right, rgb(255 255 255 / 0.9) 0%, rgb(255 255 255 / 0.9) ${percentage}%, rgb(255 255 255 / 0.3) ${percentage}%, rgb(255 255 255 / 0.3) 100%)`,
          }}
        />
      </div>
    )
  }
)
Slider.displayName = 'Slider'

export { Slider }
