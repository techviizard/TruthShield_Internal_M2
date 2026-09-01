import { NextRequest, NextResponse } from 'next/server';
import { appConfig } from '@/config/app.config';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    // 1. Validation: Ensure at least one file is uploaded
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided for batch analysis. Please upload at least one file.' },
        { status: 400 }
      );
    }

    // 2. Validation: Check the maximum batch limit
    if (files.length > appConfig.limits.maxBatchFiles) {
      return NextResponse.json(
        { error: `Batch analysis supports a maximum of ${appConfig.limits.maxBatchFiles} files at once.` },
        { status: 400 }
      );
    }

    // 3. Validation: Loop through files and check types/sizes
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    const maxFileSize = appConfig.limits.maxUploadMB * 1024 * 1024;

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.name} (${file.type})` },
          { status: 400 }
        );
      }
      if (file.size > maxFileSize) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds the ${appConfig.limits.maxUploadMB} MB limit.` },
          { status: 400 }
        );
      }
    }

    // 4. Processing placeholder (This is where you will call your engines later)
    const results = [];
    for (const file of files) {
      // TODO: Pass the file to your image/video engine here
      // For now, we just return that it was accepted
      results.push({ filename: file.name, status: 'accepted' });
    }

    return NextResponse.json({
      success: true,
      totalFiles: files.length,
      results
    });

  } catch (error) {
    console.error('Batch analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyse batch files', details: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}