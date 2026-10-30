// lib/upload.ts
export async function uploadFile(file: File): Promise<{
  url: string
  name: string
  type: string
  size: number
}> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload file')
  }

  return response.json()
}

export async function deleteFile(url: string): Promise<void> {
  const response = await fetch(`/api/upload?url=${encodeURIComponent(url)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete file')
  }
}