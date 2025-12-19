import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const alt = 'StoryStack - Asset and Content Management'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {/* Logo/Icon placeholder - using app accent color (gold) */}
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #b38f5b 0%, #c2a073 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '64px',
              fontWeight: 'bold',
              color: 'white',
              boxShadow: '0 10px 15px -3px rgba(179, 143, 91, 0.15), 0 0 40px rgba(179, 143, 91, 0.1)',
            }}
          >
            S
          </div>
          
          {/* Title */}
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: '#111827',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            StoryStack
          </h1>
          
          {/* Subtitle */}
          <p
            style={{
              fontSize: '28px',
              color: '#6b7280',
              margin: 0,
              fontWeight: '400',
            }}
          >
            storystackstudios.com
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

