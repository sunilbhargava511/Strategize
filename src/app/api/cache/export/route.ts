// src/app/api/cache/export/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getEnhancedCache } from '../../../../lib/cache/enhancedCacheManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    
    const cache = getEnhancedCache();
    
    let filePath: string;
    let contentType: string;
    let filename: string;
    
    if (format === 'xlsx') {
      filePath = await cache.exportToXLSX();
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `cache_export_${Date.now()}.xlsx`;
    } else {
      filePath = await cache.exportToCSV();
      contentType = 'text/csv';
      filename = `cache_export_${Date.now()}.csv`;
    }
    
    // Read the file and send it
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(filePath);
    
    // Clean up the temp file
    fs.unlinkSync(filePath);
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
    
  } catch (error) {
    console.error('Cache export error:', error);
    return NextResponse.json(
      { error: 'Failed to export cache' },
      { status: 500 }
    );
  }
}
