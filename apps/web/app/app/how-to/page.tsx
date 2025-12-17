'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Upload, Tag, Search, MapPin, Layers } from 'lucide-react'

export default function HowToPage() {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            How To
          </h1>
          <p className="text-sm text-gray-500">Learn how to get the most out of StoryStack</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Card className="rounded-lg border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-2xl font-semibold">Upload Photos</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Add photos to your library to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-sm text-foreground">
                <li>Go to the Library page</li>
                <li>Click the upload zone or drag and drop photos</li>
                <li>Select one or more images from your computer</li>
                <li>Photos will upload automatically and appear in your library</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Tag className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-2xl font-semibold">Tag Photos</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Organize your photos with tags
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-sm text-foreground">
                <li>Click on any photo in your library</li>
                <li>In the detail panel, type a tag name and press Enter</li>
                <li>Tags help you organize and find photos later</li>
                <li>You can add multiple tags to each photo</li>
                <li>Remove tags by clicking the X on any tag badge</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Search className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-2xl font-semibold">Search & Filter</CardTitle>
              </div>
              <CardDescription className="text-base">
                Find photos quickly using search and filters
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <ul className="list-disc list-inside space-y-3 text-base text-foreground">
                <li>
                  <strong>Search:</strong> Type in the search bar to find photos by filename
                </li>
                <li>
                  <strong>Tag Filter:</strong> Click "Filter by tags" and select tags to show only photos with those tags
                </li>
                <li>
                  <strong>Location Filter:</strong> Click "Filter by location" to filter photos by location
                </li>
                <li>
                  <strong>Combined Filters:</strong> Use multiple filters together for precise results
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-2xl font-semibold">Create Stories</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Organize photos into stories for sharing
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-sm text-foreground">
                <li>Go to the Stories page</li>
                <li>Click "New Story" and give it a name</li>
                <li>Add photos by clicking "Add Asset"</li>
                <li>Drag photos to reorder them</li>
                <li>Remove photos by clicking the X button</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Tag className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-2xl font-semibold">Manage Tags</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Organize your tag vocabulary
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <ul className="list-disc list-inside space-y-3 text-sm text-foreground">
                <li>Go to Tag Management to see all your tags</li>
                <li>Create new tags before using them on photos</li>
                <li>Edit tag names to rename them across all photos</li>
                <li>Delete tags to remove them from all photos</li>
                <li>See how many photos use each tag</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

