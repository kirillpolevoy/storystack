import type { Metadata } from 'next'

// Get site URL for Open Graph - always use production domain for images
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://storystackstudios.com'

export const metadata: Metadata = {
  title: 'StoryStack - Sign In',
  description: 'Sign in to StoryStack or create a new account. Organize your photos with AI-powered tagging.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'StoryStack - Sign In',
    description: 'Sign in to StoryStack or create a new account',
    url: `${siteUrl}/login`,
    siteName: 'StoryStack',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: 'StoryStack - Asset and Content Management',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StoryStack - Sign In',
    description: 'Sign in to StoryStack or create a new account',
    images: [`${siteUrl}/opengraph-image`],
  },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

