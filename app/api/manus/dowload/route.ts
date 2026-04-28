import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');
    const fileName = searchParams.get('fileName');

    // Validation
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    // Get Manus API URL from environment
    const MANUS_API_URL = process.env.MANUS_API_URL || 'https://your-manus-instance.com';
    const MANUS_API_KEY = process.env.MANUS_API_KEY;

    if (!MANUS_API_KEY) {
      console.error('MANUS_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Fetch file from Manus
    const manusResponse = await fetch(
      `${MANUS_API_URL}/file?path=${encodeURIComponent(filePath)}`,
      {
        headers: {
          'Authorization': `Bearer ${MANUS_API_KEY}`,
          'Accept': '*/*',
        },
      }
    );

    if (!manusResponse.ok) {
      const errorText = await manusResponse.text();
      console.error(`Manus API error (${manusResponse.status}):`, errorText);
      
      if (manusResponse.status === 404) {
        return NextResponse.json(
          { error: 'File not found in Manus storage' },
          { status: 404 }
        );
      }
      
      if (manusResponse.status === 401) {
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to fetch file from Manus: ${manusResponse.status}` },
        { status: manusResponse.status }
      );
    }

    // Get file content
    const fileBuffer = await manusResponse.arrayBuffer();
    
    // Determine content type
    const contentType = getContentType(fileName);
    
    // Return file for download
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
    
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'pdf':
      return 'application/pdf';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'doc':
      return 'application/msword';
    default:
      return 'application/octet-stream';
  }
}