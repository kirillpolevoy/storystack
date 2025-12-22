'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  BookOpen, 
  Upload, 
  Tag, 
  Search, 
  Grid3x3, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  X,
  Image as ImageIcon,
  Filter,
  Book,
  CheckCircle,
  Tags,
  MapPin,
  SidebarOpen
} from 'lucide-react'
import Image from 'next/image'

type Step = {
  id: string
  title: string
  description: string
  icon: any
  iconColor: string
  visual?: React.ReactNode
}

// Professional photos for visual demos - using reliable Unsplash image IDs
const DEMO_PHOTOS = {
  product1: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop&q=80',
  product2: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&fit=crop&q=80',
  product3: 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=400&h=400&fit=crop&q=80',
  product4: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop&q=80',
  workspace: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&h=400&fit=crop&q=80',
}

const ImportVisual = () => (
  <div className="mt-8 w-full max-w-2xl mx-auto">
    <div className="relative bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
      {/* Library page mockup */}
      <div className="space-y-4">
        {/* Header with Upload button */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Library</h3>
            <p className="text-xs text-gray-500">Your visual assets</p>
          </div>
          <Button size="sm" className="bg-accent hover:bg-accent/90 h-9 px-4">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
        
        {/* Photo grid with staggered animation */}
        <div className="grid grid-cols-6 gap-2">
          {[DEMO_PHOTOS.product1, DEMO_PHOTOS.product2, DEMO_PHOTOS.product3, DEMO_PHOTOS.product4, DEMO_PHOTOS.product1, DEMO_PHOTOS.product2].map((photo, i) => (
            <div 
              key={i} 
              className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-transparent hover:border-accent transition-all duration-300 animate-in fade-in zoom-in-95 hover:scale-105"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Image 
                src={photo} 
                alt={`Photo ${i + 1}`} 
                fill 
                className="object-cover" 
                sizes="80px"
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Upload Dialog overlay mockup */}
      <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
        <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700 mb-1">Drop files here or click to browse</p>
            <p className="text-xs text-gray-500">Supports JPEG, PNG, HEIC</p>
          </div>
        </div>
      </div>
    </div>
  </div>
)

const TagsVisual = () => {
  const [inputFocused, setInputFocused] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  return (
    <div className="mt-8 w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Side panel mockup */}
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Tags</h3>
            <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">2</span>
          </div>
          
          {/* Photo preview */}
          <div className="relative w-full h-48 rounded-xl overflow-hidden bg-gray-100 animate-in fade-in zoom-in-95">
            <Image 
              src={DEMO_PHOTOS.product1} 
              alt="Product" 
              fill 
              className="object-cover" 
              sizes="400px"
              unoptimized
            />
          </div>
          
          {/* Existing tags with animation */}
          <div className="flex flex-wrap gap-2">
            {['Product', 'Brand'].map((tag, i) => (
              <div 
                key={i} 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg animate-in fade-in slide-in-from-left-2 hover:border-accent hover:shadow-sm transition-all duration-200"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <span className="text-sm font-medium text-gray-700">{tag}</span>
                <button className="w-4 h-4 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Animated Add tag input */}
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setShowSuggestions(e.target.value.length > 0)
              }}
              onFocus={() => {
                setInputFocused(true)
                setShowSuggestions(inputValue.length > 0)
              }}
              onBlur={() => {
                setTimeout(() => {
                  setInputFocused(false)
                  setShowSuggestions(false)
                }, 200)
              }}
              placeholder="Add a tag..."
              className={`w-full h-10 px-3 text-sm border rounded-lg transition-all duration-300 ${
                inputFocused 
                  ? 'border-accent ring-2 ring-accent/20' 
                  : 'border-gray-200'
              } focus:outline-none`}
            />
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-300 ${inputFocused ? 'rotate-180' : ''}`}>
              <ChevronRight className="h-4 w-4 text-gray-400 rotate-90" />
            </div>
          </div>
          
          {/* Animated Suggestions dropdown */}
          {showSuggestions && inputFocused && (
            <div className="border border-gray-200 rounded-lg p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
              {['Campaign', 'Marketing'].map((suggestion, i) => (
                <div 
                  key={i}
                  className="px-3 py-2 hover:bg-gray-50 rounded cursor-pointer flex items-center gap-2 transition-colors duration-150 animate-in fade-in slide-in-from-left-2"
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={() => {
                    setInputValue(suggestion)
                    setShowSuggestions(false)
                  }}
                >
                  <Tag className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-sm text-gray-700">{suggestion}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const TagManagementVisual = () => {
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  
  return (
    <div className="mt-6 w-full max-w-2xl mx-auto">
      {/* Animated Search bar */}
      <div 
        className={`rounded-xl px-4 py-3 mb-4 flex items-center gap-3 transition-all duration-300 ${
          searchFocused 
            ? 'bg-white border-2 border-accent shadow-md ring-2 ring-accent/20' 
            : 'bg-gray-50 border border-transparent'
        }`}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
      >
        <Search className={`h-4 w-4 transition-colors duration-300 ${searchFocused ? 'text-accent' : 'text-gray-400'}`} />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search tags..."
          className="text-sm text-gray-700 flex-1 bg-transparent outline-none placeholder:text-gray-500"
        />
        {searchValue && (
          <button
            onClick={() => setSearchValue('')}
            className="h-5 w-5 rounded-full hover:bg-gray-200 flex items-center justify-center transition-all duration-200 animate-in fade-in slide-in-from-right-2"
          >
            <X className="h-3.5 w-3.5 text-gray-400" />
          </button>
        )}
      </div>
    
    {/* Tag list card */}
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tag name</span>
        <div className="flex items-center gap-8">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Usage</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI</span>
        </div>
      </div>
      
      {/* Tag rows */}
      {[
        { name: 'Product', enabled: true, count: 12 },
        { name: 'Brand', enabled: false, count: 8 },
        { name: 'Campaign', enabled: true, count: 5 },
        { name: 'Marketing', enabled: false, count: 15 },
      ].map((tag, i) => (
        <div 
          key={i} 
          className={`flex items-center justify-between px-6 py-4 ${i < 3 ? 'border-b border-gray-100' : ''} hover:bg-gray-50 transition-all duration-200 animate-in fade-in slide-in-from-left-2`}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-center gap-3 flex-1">
            <span className="text-base font-medium text-gray-900">{tag.name}</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {tag.count} {tag.count === 1 ? 'photo' : 'photos'}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={tag.enabled} className="h-4 w-4 rounded border-gray-300 text-accent" />
              <Sparkles className={`h-4 w-4 ${tag.enabled ? 'text-accent' : 'text-gray-300'}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
    
    {/* Add Tag button */}
    <div className="mt-4 flex justify-end">
      <Button size="sm" className="bg-accent hover:bg-accent/90 h-9 px-4 animate-in fade-in slide-in-from-bottom-2">
        <Tag className="h-4 w-4 mr-1.5" />
        New Tag
      </Button>
    </div>
  </div>
  )
}

const AutoTaggingVisual = () => (
  <div className="mt-6 w-full max-w-2xl mx-auto">
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200">
      {/* Info banner */}
      <div className="bg-accent/10 px-6 py-3 flex items-center gap-2 border-b border-gray-100">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="text-sm font-medium text-accent">3 of 4 tags using AI</span>
      </div>
      
      {/* Tag list */}
      <div className="divide-y divide-gray-100">
        {[
          { name: 'Product', enabled: true, count: 12 },
          { name: 'Brand', enabled: true, count: 8 },
          { name: 'Campaign', enabled: false, count: 5 },
          { name: 'Marketing', enabled: true, count: 15 },
        ].map((tag, i) => (
          <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-base font-medium text-gray-900">{tag.name}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {tag.count} {tag.count === 1 ? 'photo' : 'photos'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={tag.enabled} className="h-4 w-4 rounded border-gray-300 text-accent" />
              <Sparkles className={`h-4 w-4 ${tag.enabled ? 'text-accent' : 'text-gray-300'}`} />
            </div>
          </div>
        ))}
      </div>
      
      {/* Helper text */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-600 text-center">
          Check the box to enable AI auto-tagging for each tag
        </p>
      </div>
    </div>
  </div>
)

const FilteringVisual = () => {
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  return (
    <div className="mt-8 w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        {/* Animated Search bar */}
        <div 
          className={`bg-gray-50 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-3 border transition-all duration-300 ${
            searchFocused 
              ? 'border-accent bg-white shadow-md ring-2 ring-accent/20' 
              : 'border-gray-200'
          }`}
          onFocus={() => {
            setSearchFocused(true)
            setShowSuggestions(true)
          }}
          onBlur={() => {
            setTimeout(() => {
              setSearchFocused(false)
              setShowSuggestions(false)
            }, 200)
          }}
        >
          <Search className={`h-4 w-4 transition-colors duration-300 ${searchFocused ? 'text-accent' : 'text-gray-400'}`} />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search tags and locations..."
            className="text-sm text-gray-700 flex-1 bg-transparent outline-none placeholder:text-gray-500"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="h-5 w-5 rounded-full hover:bg-gray-200 flex items-center justify-center transition-all duration-200 animate-in fade-in slide-in-from-right-2"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
        </div>
        
        {/* Animated suggestions dropdown */}
        {showSuggestions && searchFocused && (
          <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {['Product', 'Brand', 'Campaign', 'New York', 'Los Angeles'].map((suggestion, i) => (
                <button
                  key={i}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center gap-2 animate-in fade-in slide-in-from-left-2"
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={() => {
                    setSearchValue(suggestion)
                    setShowSuggestions(false)
                  }}
                >
                  <Search className="h-3.5 w-3.5 text-gray-400" />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Active filters with animation */}
        <div className="flex flex-wrap gap-2 mb-4">
          {['Product', 'Brand'].map((tag, i) => (
            <span 
              key={i} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white text-xs font-medium animate-in fade-in slide-in-from-bottom-2 hover:scale-105 transition-transform duration-200 cursor-pointer"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {tag}
              <X className="h-3 w-3" />
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white text-xs font-medium animate-in fade-in slide-in-from-bottom-2 hover:scale-105 transition-transform duration-200 cursor-pointer"
            style={{ animationDelay: '200ms' }}
          >
            <MapPin className="h-3 w-3" />
            New York
            <X className="h-3 w-3" />
          </span>
        </div>
        
        {/* Photo grid with staggered animation */}
        <div className="grid grid-cols-6 gap-2">
          {[DEMO_PHOTOS.product1, DEMO_PHOTOS.product2, DEMO_PHOTOS.product3, DEMO_PHOTOS.product4, DEMO_PHOTOS.product1, DEMO_PHOTOS.product2].map((photo, i) => (
            <div 
              key={i} 
              className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 animate-in fade-in zoom-in-95"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Image 
                src={photo} 
                alt={`Photo ${i + 1}`} 
                fill 
                className="object-cover"
                sizes="80px"
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const StoriesVisual = () => (
  <div className="mt-6 w-full max-w-4xl mx-auto">
    {/* Stories grid */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {[
        { name: 'Brand Campaign', count: 12, photo: DEMO_PHOTOS.workspace },
        { name: 'Product Collection', count: 8, photo: DEMO_PHOTOS.product1 },
        { name: 'Summer Launch', count: 15, photo: DEMO_PHOTOS.product2 },
        { name: 'Marketing Assets', count: 6, photo: DEMO_PHOTOS.product3 },
        ].map((story, i) => (
        <div 
          key={i} 
          className="bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group animate-in fade-in zoom-in-95"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Thumbnail */}
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
            <Image 
              src={story.photo} 
              alt={story.name} 
              fill 
              className="object-cover transition-transform duration-500 group-hover:scale-110" 
              sizes="200px"
              unoptimized
            />
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-gray-700" />
              <span className="text-xs font-semibold text-gray-900">{story.count}</span>
            </div>
          </div>
          
          {/* Story info */}
          <div className="p-4">
            <h4 className="text-base font-semibold text-gray-900 mb-1 line-clamp-1">{story.name}</h4>
            <p className="text-xs text-gray-500">Updated 2 days ago</p>
          </div>
        </div>
      ))}
    </div>
    
    {/* Create button */}
    <div className="mt-6 flex justify-end">
      <Button className="bg-accent hover:bg-accent/90 h-10 px-5">
        <Upload className="h-4 w-4 mr-2" />
        New Story
      </Button>
    </div>
  </div>
)

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to StoryStack',
    description: 'Organize your visual assets into powerful stories. Start by setting up your tags, then import your photos and let AI help categorize them automatically.',
    icon: BookOpen,
    iconColor: '#b38f5b',
  },
  {
    id: 'tag-management',
    title: 'Set Up Your Tags',
    description: 'Navigate to Tag Management from the sidebar to create your tag vocabulary. Add tags like "Product", "Campaign", "Brand", or any categories that matter to your business. These tags will help organize and automatically categorize your photos.',
    icon: Tags,
    iconColor: '#b38f5b',
    visual: <TagManagementVisual />,
  },
  {
    id: 'auto-tagging',
    title: 'Enable AI Auto-Tagging',
    description: 'In Tag Management, check the "Use with AI" checkbox next to any tag to enable AI auto-tagging. When you upload photos, AI will automatically apply these tags, saving your team valuable time.',
    icon: Sparkles,
    iconColor: '#b38f5b',
    visual: <AutoTaggingVisual />,
  },
  {
    id: 'import',
    title: 'Upload Your Photos',
    description: 'Go to the Library page and click the "Upload" button in the header. You can drag and drop multiple photos or select them from your computer. Photos will upload automatically and AI will tag them if you\'ve enabled tags.',
    icon: ImageIcon,
    iconColor: '#b38f5b',
    visual: <ImportVisual />,
  },
  {
    id: 'tags',
    title: 'Tag Your Photos',
    description: 'Click any photo in your library to open the detail panel. In the Tags section, type a tag name and press Enter, or select from the dropdown suggestions. You can add multiple tags to organize your content. Remove tags by clicking the X button on any tag.',
    icon: Tag,
    iconColor: '#b38f5b',
    visual: <TagsVisual />,
  },
  {
    id: 'filtering',
    title: 'Search & Filter',
    description: 'Use the search bar at the top of the Library page to filter photos by tags and locations. Type to see suggestions, or click tags to add them as filters. You can combine multiple filters to find exactly what you need. Clear filters by clicking the X on any filter badge.',
    icon: Filter,
    iconColor: '#b38f5b',
    visual: <FilteringVisual />,
  },
  {
    id: 'stories',
    title: 'Create Stories',
    description: 'Go to the Stories page and click "New Story" to create a story. Give it a name and optionally add a description. Then add photos by clicking "Add Asset" and selecting from your library. Drag photos to reorder them, and remove photos using the delete button.',
    icon: Book,
    iconColor: '#b38f5b',
    visual: <StoriesVisual />,
  },
  {
    id: 'ready',
    title: "You're All Set!",
    description: 'Tags are the foundation of StoryStack - they help organize and automatically categorize your visual assets. Start by setting up your tags, then upload photos and watch AI work its magic. You can always access this guide from the sidebar.',
    icon: CheckCircle,
    iconColor: '#b38f5b',
  },
]

export default function HowToPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const step = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1
  const isFirstStep = currentStep === 0

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep(currentStep + 1)
        setIsAnimating(false)
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep(currentStep - 1)
        setIsAnimating(false)
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }

  const handleStepClick = (index: number) => {
    if (index !== currentStep) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep(index)
        setIsAnimating(false)
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-8 pt-4">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                How To
              </h1>
              <p className="text-sm text-gray-500 mt-1">Learn how to get the most out of StoryStack</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">
                Step {currentStep + 1} of {STEPS.length}
              </span>
              <span className="text-sm font-medium text-gray-600">
                {Math.round(((currentStep + 1) / STEPS.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Step Navigation Dots */}
          <div className="flex items-center justify-center gap-2 mb-12 flex-wrap">
            {STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => handleStepClick(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-accent'
                    : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Content Card */}
          <Card 
            ref={contentRef}
            className={`rounded-2xl border-gray-200 shadow-xl bg-white transition-all duration-300 ${
              isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
          >
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-lg transition-all duration-300"
                  style={{ backgroundColor: `${step.iconColor}15` }}
                >
                  <step.icon className="h-12 w-12" style={{ color: step.iconColor }} />
                </div>

                {/* Title */}
                <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                  {step.title}
                </h2>

                {/* Description */}
                <p className="text-lg text-gray-600 mb-8 max-w-2xl leading-relaxed">
                  {step.description}
                </p>

                {/* Visual Demo */}
                {step.visual && (
                  <div className="w-full mt-4">
                    {step.visual}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep}
              className="h-12 px-6 text-base font-medium border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              disabled={isLastStep}
              className="h-12 px-8 text-base font-semibold bg-accent hover:bg-accent/90 shadow-md hover:shadow-lg transition-all"
            >
              {isLastStep ? (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Quick Links */}
          <div className="mt-16 pt-12 border-t border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">
              Quick Reference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {STEPS.filter(s => s.visual).map((stepItem) => (
                <button
                  key={stepItem.id}
                  onClick={() => handleStepClick(STEPS.findIndex(s => s.id === stepItem.id))}
                  className="p-4 rounded-xl bg-white border border-gray-200 hover:border-accent hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${stepItem.iconColor}15` }}
                    >
                      <stepItem.icon className="h-5 w-5" style={{ color: stepItem.iconColor }} />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 group-hover:text-accent transition-colors">
                      {stepItem.title}
                    </h4>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {stepItem.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
