// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/user';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { executeQuery } from '@/lib/db';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'txt', 'csv',
];

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth('TEAM_MEMBER');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // Get file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'reports');

    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true });

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadDir, filename);
    await writeFile(filePath, buffer);

    // Return the file URL
    const fileUrl = `/uploads/reports/${filename}`;

    // Log the upload
    await executeQuery(
      `INSERT INTO upload_logs (file_name, file_url, file_size, file_type, uploaded_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [file.name, fileUrl, file.size, file.type, user.id]
    );

    return NextResponse.json({
      success: true,
      url: fileUrl,
      name: file.name,
      type: file.type,
      size: file.size,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// File deletion endpoint (optional)
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const searchParams = request.nextUrl.searchParams;
    const fileUrl = searchParams.get('url');

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'File URL is required' },
        { status: 400 }
      );
    }

    // Extract filename from URL
    const filename = fileUrl.split('/').pop();
    if (!filename) {
      return NextResponse.json(
        { error: 'Invalid file URL' },
        { status: 400 }
      );
    }

    // Check if file exists in upload_logs
    const logResult = await executeQuery(
      `SELECT * FROM upload_logs WHERE file_url = $1 AND uploaded_by = $2`,
      [fileUrl, user.id]
    );

    if (logResult.length === 0) {
      return NextResponse.json(
        { error: 'File not found or not owned by you' },
        { status: 404 }
      );
    }

    // Delete file from filesystem
    const filePath = join(process.cwd(), 'public', fileUrl);
    try {
      await unlink(filePath);
    } catch (err) {
      // File may already be deleted
      console.warn('File not found on filesystem:', filePath);
    }

    // Delete from upload_logs
    await executeQuery(
      `DELETE FROM upload_logs WHERE file_url = $1`,
      [fileUrl]
    );

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}