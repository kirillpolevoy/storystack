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
 * Generate preview (2000px) and thumb (400px) versions of an image
 */
export async function generateThumbnails(file: File): Promise<{
  preview: Blob
  thumb: Blob
}> {
  const [preview, thumb] = await Promise.all([
    resizeImage(file, 2000, 0.85),
    resizeImage(file, 400, 0.8),
  ])

  return { preview, thumb }
}

