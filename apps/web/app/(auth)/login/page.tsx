import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

// Get site URL for Open Graph - always use production domain for images
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://storystackstudios.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'StoryStack - Sign In',
  description: 'Centralized hub for asset and content management',
  openGraph: {
    title: 'StoryStack',
    description: 'Centralized hub for asset and content management',
    url: `${siteUrl}/login`,
    siteName: 'StoryStack',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'StoryStack - Asset and Content Management',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StoryStack',
    description: 'Centralized hub for asset and content management',
    images: [`${siteUrl}/og-image.png`],
  },
}

export default async function LoginPage() {
  // Check environment variables first
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[LoginPage] Missing Supabase environment variables')
    // Still show login page even if env vars are missing
    // The client-side components will handle the error
  } else {
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        redirect('/app/library')
      }
    } catch (error) {
      // If there's an error checking auth, still show login page
      console.error('[LoginPage] Error checking auth:', error)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold text-gray-900">
            StoryStack
          </CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-4">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <SignupForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

