// app/api/download-from-manus/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest ) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('fileId'); // Use fileId instead of path
    const fileName = searchParams.get('fileName') || 'download';

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Fetch the file details from Manus API v2
    // Note: You might first get the file metadata to find the actual download URL
    // or use the file.detail endpoint if it serves the binary directly.
    const manusResponse = await fetch(
      `https://api.manus.ai/v2/file.detail?file_id=${encodeURIComponent(fileId )}`,
      {
        headers: {
          'x-manus-api-key': `${process.env.MANUS_API_KEY}`, // Correct header name
        },
      }
    );

    if (!manusResponse.ok) {
      throw new Error(`Manus API error: ${manusResponse.status}`);
    }

    const data = await manusResponse.json();
    
    if (!data.ok || !data.file.url) {
        throw new Error('Failed to retrieve file download URL');
    }

    // Now fetch the actual file content from the provided URL
    const fileContentResponse = await fetch(data.file.url);
    const fileBuffer = await fileContentResponse.arrayBuffer();
    
    const contentType = getContentType(fileName);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file from Manus' },
      { status: 500 }
    );
  }
}

function getContentType(fileName: string): string {
  if (fileName.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (fileName.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (fileName.endsWith('.pdf')) {
    return 'application/pdf';
  }
  return 'application/octet-stream';
}
