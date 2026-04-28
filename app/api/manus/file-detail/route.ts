import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }
    
    const MANUS_API_URL = process.env.MANUS_API_URL;
    const MANUS_API_KEY = process.env.MANUS_API_KEY;
    
    // Fetch file details from Manus
    const response = await fetch(`${MANUS_API_URL}/v1/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${MANUS_API_KEY}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file details: ${response.status}`);
    }
    
    const fileData = await response.json();
    
    return NextResponse.json({
      sandbox_path: fileData.sandbox_path || fileData.path,
      filename: fileData.filename,
      size: fileData.size,
      mime_type: fileData.mime_type,
    });
    
  } catch (error) {
    console.error('Error fetching file details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file details' },
      { status: 500 }
    );
  }
}