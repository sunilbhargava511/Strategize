import { NextRequest, NextResponse } from 'next/server';
import { 
  generateBacktestExcel, 
  exportToBuffer, 
  generateFilename,
  validateExportData,
  ExcelExportData
} from '../../../lib/utils/excelExport';

/**
 * Excel export API endpoint for backtesting results
 */
export async function POST(request: NextRequest) {
  try {
    const exportData: ExcelExportData = await request.json();
    
    console.log('📊 Starting Excel export generation...');
    console.log(`📅 Period: ${exportData.startYear} - ${exportData.endYear}`);
    console.log(`📈 Strategies: ${exportData.strategies.length}`);
    console.log(`💰 Initial Investment: $${exportData.initialInvestment.toLocaleString()}`);

    // Validate export data
    const validation = validateExportData(exportData);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid export data', details: validation.errors },
        { status: 400 }
      );
    }

    // Generate Excel workbook
    console.log('🔄 Generating Excel workbook...');
    const workbook = generateBacktestExcel(exportData);
    
    // Convert to buffer
    console.log('💾 Converting to Excel format...');
    const buffer = exportToBuffer(workbook);
    
    // Generate filename
    const filename = generateFilename(exportData.startYear, exportData.endYear);
    
    console.log(`✅ Excel export complete: ${filename}`);
    console.log(`📦 File size: ${(buffer.length / 1024).toFixed(1)} KB`);

    // Return Excel file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });

  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate Excel export', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * Get export metadata (file info without generating the file)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startYear = parseInt(searchParams.get('startYear') || '2010');
    const endYear = parseInt(searchParams.get('endYear') || '2024');
    const strategyCount = parseInt(searchParams.get('strategyCount') || '4');

    const filename = generateFilename(startYear, endYear);
    
    // Estimate file size based on data complexity
    const estimatedRowsPerStrategy = (endYear - startYear + 1) * 50; // rough estimate
    const estimatedTotalRows = strategyCount * estimatedRowsPerStrategy + 1000; // extra for summary data
    const estimatedSizeKB = Math.ceil(estimatedTotalRows * 0.1); // rough Excel size calculation

    return NextResponse.json({
      filename,
      period: `${startYear}-${endYear}`,
      strategyCount,
      estimatedSizeKB,
      sheets: [
        'Summary',
        'Year-by-Year Performance',
        'Equal Weight Buy & Hold',
        'Market Cap Buy & Hold', 
        'Equal Weight Rebalanced',
        'Market Cap Rebalanced',
        'SPY Benchmark',
        'Holdings Details'
      ],
      format: 'Excel (.xlsx)',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

  } catch (error) {
    console.error('Export metadata error:', error);
    return NextResponse.json(
      { error: 'Failed to get export metadata' },
      { status: 500 }
    );
  }
}

/**
 * Generate CSV export (lightweight alternative)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategies, format = 'csv' } = body;

    if (!strategies || !Array.isArray(strategies)) {
      return NextResponse.json(
        { error: 'Strategies array is required' },
        { status: 400 }
      );
    }

    console.log(`📊 Generating ${format.toUpperCase()} export for ${strategies.length} strategies`);

    if (format === 'csv') {
      // Import CSV export function
      const { exportToCSV } = await import('../../../lib/utils/excelExport');
      const csvData = exportToCSV(strategies);
      
      const filename = `portfolio_backtest_${new Date().toISOString().split('T')[0]}.csv`;
      
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Only "csv" is supported for this endpoint' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV export' },
      { status: 500 }
    );
  }
}

/**
 * Handle bulk export requests
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { exportRequests } = body;

    if (!exportRequests || !Array.isArray(exportRequests)) {
      return NextResponse.json(
        { error: 'Export requests array is required' },
        { status: 400 }
      );
    }

    console.log(`📦 Processing ${exportRequests.length} bulk export requests`);

    const results = [];
    
    for (const [index, exportData] of exportRequests.entries()) {
      try {
        console.log(`🔄 Processing export ${index + 1}/${exportRequests.length}...`);
        
        // Validate each export request
        const validation = validateExportData(exportData);
        if (!validation.isValid) {
          results.push({
            index,
            success: false,
            error: 'Invalid export data',
            details: validation.errors
          });
          continue;
        }

        // Generate workbook
        const workbook = generateBacktestExcel(exportData);
        const buffer = exportToBuffer(workbook);
        const filename = generateFilename(exportData.startYear, exportData.endYear);
        
        results.push({
          index,
          success: true,
          filename,
          sizeKB: Math.ceil(buffer.length / 1024),
          buffer: buffer.toString('base64') // Convert to base64 for JSON transport
        });

      } catch (error) {
        results.push({
          index,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Bulk export complete: ${successCount}/${exportRequests.length} successful`);

    return NextResponse.json({
      results,
      summary: {
        total: exportRequests.length,
        successful: successCount,
        failed: exportRequests.length - successCount
      }
    });

  } catch (error) {
    console.error('Bulk export error:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk export requests' },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Health check for export service
 */
export async function HEAD(request: NextRequest) {
  try {
    // Test if we can load the XLSX library
    const XLSX = require('xlsx');
    
    // Create a minimal workbook to test functionality
    const testWorkbook = XLSX.utils.book_new();
    const testData = [['Test', 'Data'], [1, 2]];
    const testWorksheet = XLSX.utils.aoa_to_sheet(testData);
    XLSX.utils.book_append_sheet(testWorkbook, testWorksheet, 'Test');
    
    // Try to write to buffer
    const testBuffer = XLSX.write(testWorkbook, { type: 'buffer', bookType: 'xlsx' });
    
    if (testBuffer && testBuffer.length > 0) {
      return new Response(null, {
        status: 200,
        headers: {
          'X-Service-Status': 'healthy',
          'X-Test-Size': testBuffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      return new Response(null, {
        status: 503,
        headers: {
          'X-Service-Status': 'degraded',
          'Cache-Control': 'no-cache',
        },
      });
    }
  } catch (error) {
    console.error('Export service health check failed:', error);
    return new Response(null, {
      status: 503,
      headers: {
        'X-Service-Status': 'unhealthy',
        'X-Error': error instanceof Error ? error.message : 'Unknown error',
        'Cache-Control': 'no-cache',
      },
    });
  }
}