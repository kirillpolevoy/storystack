import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://storystackstudios.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'StoryStack - Test OG',
  description: 'Test page for Open Graph',
  openGraph: {
    title: 'StoryStack',
    description: 'Centralized hub for asset and content management',
    url: `${siteUrl}/test-og`,
    siteName: 'StoryStack',
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
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
    images: [`${siteUrl}/opengraph-image`],
  },
}

export default function TestOGPage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Test Open Graph Page</h1>
      <p>This page is for testing Open Graph metadata.</p>
      <p>Check the page source to see if og:image meta tags are present.</p>
    </div>
  )
}

