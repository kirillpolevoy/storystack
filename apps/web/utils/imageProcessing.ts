/**
 * Resize image using Canvas API
 */
export async function resizeImage(
  file: File,
  maxWidth: number,
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxWidth) {
            width = (width * maxWidth) / height
            height = maxWidth
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to create blob'))
            }
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Compress image to A2 format (1024px long edge) for AI tagging
 * Matches mobile app's compressImageForAI behavior
 * Target: 200-500KB file size
 */
export async function compressImageForAI(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const originalWidth = img.width
        const originalHeight = img.height
        const longEdge = Math.max(originalWidth, originalHeight)
        const AI_TARGET_LONG_EDGE = 1024
        
        console.log(`[compressImageForAI] Original: ${originalWidth}x${originalHeight}, long edge: ${longEdge}px`)
        
        // If already ≤1024px, return original (but still compress for size)
        if (longEdge <= AI_TARGET_LONG_EDGE) {
          console.log(`[compressImageForAI] ✅ Image already ≤${AI_TARGET_LONG_EDGE}px, compressing for size only`)
        }
        
        const canvas = document.createElement('canvas')
        let width = originalWidth
        let height = originalHeight
        
        // Calculate new dimensions maintaining aspect ratio
        if (longEdge > AI_TARGET_LONG_EDGE) {
          const scale = AI_TARGET_LONG_EDGE / longEdge
          width = Math.round(originalWidth * scale)
          height = Math.round(originalHeight * scale)
          console.log(`[compressImageForAI] Resizing to ${width}x${height} (${AI_TARGET_LONG_EDGE}px long edge)`)
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        
        ctx.drawImage(img, 0, 0, width, height)
        
        // Try progressively lower quality to hit 200-500KB target
        const qualities = [0.85, 0.75, 0.65, 0.55, 0.50]
        const TARGET_MAX_KB = 500
        let qualityIndex = 0
        
        const tryQuality = (index: number) => {
          if (index >= qualities.length) {
            // Use lowest quality if all fail
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const sizeKB = blob.size / 1024
                  console.log(`[compressImageForAI] ✅ A2 compression: ${width}x${height}, ${sizeKB.toFixed(0)} KB @ ${(qualities[index - 1] * 100).toFixed(0)}% quality`)
                  resolve(blob)
                } else {
                  reject(new Error('Failed to create blob'))
                }
              },
              'image/jpeg',
              qualities[index - 1]
            )
            return
          }
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'))
                return
              }
              
              const sizeKB = blob.size / 1024
              
              if (sizeKB <= TARGET_MAX_KB) {
                console.log(`[compressImageForAI] ✅ A2 compression: ${width}x${height}, ${sizeKB.toFixed(0)} KB (${(blob.size / (1024 * 1024)).toFixed(2)} MB) @ ${(qualities[index] * 100).toFixed(0)}% quality`)
                resolve(blob)
              } else {
                console.log(`[compressImageForAI] Trying quality ${(qualities[index] * 100).toFixed(0)}%: ${sizeKB.toFixed(0)} KB (too large, trying lower quality...)`)
                tryQuality(index + 1)
              }
            },
            'image/jpeg',
            qualities[index]
          )
        }
        
        tryQuality(0)
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Generate preview (2000px) and thumb (800px) versions of an image
 * Thumbnails increased to 800px to prevent pixelation on larger screens
 * where tiles can be 400-600px wide (with 2x DPI displays, need 800-1200px)
 */
export async function generateThumbnails(file: File): Promise<{
  preview: Blob
  thumb: Blob
}> {
  const [preview, thumb] = await Promise.all([
    resizeImage(file, 2000, 0.85),
    resizeImage(file, 800, 0.85), // Increased from 400px to 800px, quality from 0.8 to 0.85
  ])

  return { preview, thumb }
}

