export async function POST(req: Request) {
  const { fileUrl, target } = await req.json()

  console.log('➡️ Incoming request:', { fileUrl, target })

  try {
    // 1. Fetch PDF
    const fileRes = await fetch(fileUrl)
    console.log('📥 Fetch PDF status:', fileRes.status)

    if (!fileRes.ok) {
      console.error('❌ Failed to fetch PDF')
      return Response.json({ error: 'Failed to fetch PDF' }, { status: 400 })
    }

    const blob = await fileRes.blob()
    console.log('📦 PDF size:', blob.size)

    // 2. Create form-data
    const form = new FormData()
    form.append('fileInput', blob, 'document.pdf')
    form.append('fileId', '')

    let endpoint: string
    let contentType: string
    let fallbackName: string

    if (target === 'pptx') {
      endpoint = 'http://196.190.251.8:4545/api/v1/convert/pdf/presentation'
      form.append('outputFormat', 'pptx')
      contentType =
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      fallbackName = 'converted.pptx'
    } else {
      endpoint = 'http://196.190.251.8:4545/api/v1/convert/pdf/word'
      form.append('outputFormat', 'docx')
      contentType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      fallbackName = 'converted.docx'
    }

    console.log('🚀 Sending to converter:', {
      endpoint,
      target,
      fallbackName
    })

    // 3. Call API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'X-API-KEY': '77c8dc89-6b32-4eb8-8498-d9d92ce48c24'
      },
      body: form
    })

    console.log('📡 Converter response status:', response.status)
    console.log('📡 Headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const text = await response.text()
      console.error('❌ Converter error response:', text)
      return Response.json({ error: 'conversion failed' }, { status: 500 })
    }

    // 4. Read binary
    const arrayBuffer = await response.arrayBuffer()
    console.log('📄 Converted file size:', arrayBuffer.byteLength)

    if (arrayBuffer.byteLength === 0) {
      console.error('❌ Empty file returned!')
      return Response.json(
        { error: 'Empty file returned from converter' },
        { status: 500 }
      )
    }

    // 5. Extract filename
    const disposition = response.headers.get('content-disposition')
    console.log('📎 Content-Disposition:', disposition)

    const match = disposition?.match(/filename="(.+)"/)
    const filename = match ? match[1] : fallbackName

    console.log('✅ Final filename:', filename)

    // 6. Return file
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (err) {
    console.error('🔥 Server error:', err)
    return Response.json({ error: 'server error' }, { status: 500 })
  }
}