import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

// Get site URL for Open Graph
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
  'https://storystackstudios.com')

export const metadata: Metadata = {
  title: 'StoryStack',
  description: 'Centralized hub for asset and content management',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'StoryStack',
    description: 'Centralized hub for asset and content management',
    url: siteUrl,
    siteName: 'StoryStack',
    images: [
      {
        url: new URL('/og-image.png', siteUrl).toString(),
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
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}


