// src/app/api/cache/import/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getEnhancedCache } from '../../../../lib/cache/enhancedCacheManager';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Save uploaded file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempPath = path.join(tempDir, `upload_${Date.now()}_${file.name}`);
    fs.writeFileSync(tempPath, buffer);
    
    try {
      const cache = getEnhancedCache();
      let imported = 0;
      
      if (file.name.endsWith('.csv')) {
        imported = await cache.importFromCSV(tempPath, false);
      } else if (file.name.endsWith('.xlsx')) {
        imported = await cache.importFromXLSX(tempPath, false);
      } else {
        throw new Error('Unsupported file format. Please use CSV or XLSX.');
      }
      
      // Clean up temp file
      fs.unlinkSync(tempPath);
      
      return NextResponse.json({
        message: 'Import successful',
        imported,
        filename: file.name
      });
      
    } catch (importError) {
      // Clean up temp file on error
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw importError;
    }
    
  } catch (error) {
    console.error('Cache import error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to import cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }