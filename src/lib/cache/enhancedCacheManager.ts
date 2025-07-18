// src/lib/cache/enhancedCacheManager.ts

import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { HistoricalDataCache, CachedStockData } from './historicalDataCache';

export interface CacheOptions {
  useCache: boolean;
  autoSave: boolean;
  cacheDir?: string;
}

export class EnhancedCacheManager extends HistoricalDataCache {
  private options: CacheOptions;
  private bypassCache: boolean = false;

  constructor(options: CacheOptions = { useCache: true, autoSave: true }) {
    super(options.cacheDir);
    this.options = options;
    this.bypassCache = !options.useCache;
  }

  /**
   * Toggle cache usage on/off
   */
  public toggleCache(enable?: boolean): void {
    this.bypassCache = enable !== undefined ? !enable : !this.bypassCache;
    console.log(`📦 Cache ${this.bypassCache ? 'disabled' : 'enabled'}`);
  }

  /**
   * Check if cache is enabled
   */
  public isCacheEnabled(): boolean {
    return !this.bypassCache;
  }

  /**
   * Override get to respect bypass flag
   */
  public get(ticker: string, date: string): CachedStockData | null {
    if (this.bypassCache) return null;
    return super.get(ticker, date);
  }

  /**
   * Override set to respect bypass flag
   */
  public set(data: CachedStockData): void {
    if (this.bypassCache) return;
    super.set(data);
  }

  /**
   * Export cache to CSV format
   */
  public async exportToCSV(outputPath?: string): Promise<string> {
    const records = this.getAllRecords();
    
    const csvData = Papa.unparse(records, {
      header: true,
      columns: ['ticker', 'date', 'price', 'adjustedPrice', 'sharesOutstanding', 'marketCap', 'isDelisted', 'lastUpdated']
    });

    const filePath = outputPath || path.join(this.cacheDir, `cache_export_${Date.now()}.csv`);
    fs.writeFileSync(filePath, csvData);
    
    console.log(`📁 Cache exported to CSV: ${filePath}`);
    return filePath;
  }

  /**
   * Export cache to XLSX format
   */
  public async exportToXLSX(outputPath?: string): Promise<string> {
    const records = this.getAllRecords();
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Main data sheet
    const ws = XLSX.utils.json_to_sheet(records);
    XLSX.utils.book_append_sheet(wb, ws, 'Historical Data');
    
    // Summary sheet
    const summaryData = this.generateSummaryData(records);
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // Ticker list sheet
    const tickerData = this.generateTickerSummary(records);
    const tickerWs = XLSX.utils.json_to_sheet(tickerData);
    XLSX.utils.book_append_sheet(wb, tickerWs, 'Tickers');
    
    const filePath = outputPath || path.join(this.cacheDir, `cache_export_${Date.now()}.xlsx`);
    XLSX.writeFile(wb, filePath);
    
    console.log(`📁 Cache exported to XLSX: ${filePath}`);
    return filePath;
  }

  /**
   * Import cache from CSV file
   */
  public async importFromCSV(filePath: string, clearExisting: boolean = false): Promise<number> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    if (clearExisting) {
      this.clear();
    }

    const csvContent = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim()
    });

    let imported = 0;
    parsed.data.forEach((row: any) => {
      if (row.ticker && row.date) {
        const data: CachedStockData = {
          ticker: row.ticker,
          date: row.date,
          price: parseFloat(row.price) || 0,
          adjustedPrice: parseFloat(row.adjustedPrice) || 0,
          sharesOutstanding: parseInt(row.sharesOutstanding) || 0,
          marketCap: parseFloat(row.marketCap) || 0,
          lastUpdated: row.lastUpdated || new Date().toISOString(),
          isDelisted: row.isDelisted === true || row.isDelisted === 'true'
        };
        
        this.set(data);
        imported++;
      }
    });

    if (this.options.autoSave) {
      this.flush();
    }

    console.log(`📥 Imported ${imported} records from CSV`);
    return imported;
  }

  /**
   * Import cache from XLSX file
   */
  public async importFromXLSX(filePath: string, clearExisting: boolean = false): Promise<number> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    if (clearExisting) {
      this.clear();
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let imported = 0;
    data.forEach((row: any) => {
      if (row.ticker && row.date) {
        const cacheData: CachedStockData = {
          ticker: row.ticker,
          date: row.date,
          price: parseFloat(row.price) || 0,
          adjustedPrice: parseFloat(row.adjustedPrice) || 0,
          sharesOutstanding: parseInt(row.sharesOutstanding) || 0,
          marketCap: parseFloat(row.marketCap) || 0,
          lastUpdated: row.lastUpdated || new Date().toISOString(),
          isDelisted: row.isDelisted === true || row.isDelisted === 'true'
        };
        
        this.set(cacheData);
        imported++;
      }
    });

    if (this.options.autoSave) {
      this.flush();
    }

    console.log(`📥 Imported ${imported} records from XLSX`);
    return imported;
  }

  /**
   * Get all records from cache
   */
  private getAllRecords(): CachedStockData[] {
    // This requires access to the internal cache Map
    // We'll need to add this method to the base class
    return Array.from(this.cache.values());
  }

  /**
   * Generate summary data for export
   */
  private generateSummaryData(records: CachedStockData[]): any[] {
    const stats = this.getStats();
    const dateRange = stats.dateRange;
    
    return [
      { Metric: 'Total Records', Value: records.length },
      { Metric: 'Unique Tickers', Value: stats.uniqueTickers },
      { Metric: 'Date Range Start', Value: dateRange.earliest },
      { Metric: 'Date Range End', Value: dateRange.latest },
      { Metric: 'Delisted Stocks', Value: stats.delistedCount },
      { Metric: 'Cache Version', Value: '1.0.0' },
      { Metric: 'Export Date', Value: new Date().toISOString() }
    ];
  }

  /**
   * Generate ticker summary for export
   */
  private generateTickerSummary(records: CachedStockData[]): any[] {
    const tickerMap = new Map<string, {
      ticker: string;
      recordCount: number;
      earliestDate: string;
      latestDate: string;
      isDelisted: boolean;
    }>();

    records.forEach(record => {
      const existing = tickerMap.get(record.ticker);
      if (existing) {
        existing.recordCount++;
        if (record.date < existing.earliestDate) existing.earliestDate = record.date;
        if (record.date > existing.latestDate) existing.latestDate = record.date;
        if (record.isDelisted) existing.isDelisted = true;
      } else {
        tickerMap.set(record.ticker, {
          ticker: record.ticker,
          recordCount: 1,
          earliestDate: record.date,
          latestDate: record.date,
          isDelisted: record.isDelisted || false
        });
      }
    });

    return Array.from(tickerMap.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }
}

// Singleton instance with options
let enhancedCacheInstance: EnhancedCacheManager | null = null;

export function getEnhancedCache(options?: CacheOptions): EnhancedCacheManager {
  if (!enhancedCacheInstance) {
    enhancedCacheInstance = new EnhancedCacheManager(options);
  }
  return enhancedCacheInstance;
}