// src/lib/cache/historicalDataCache.ts

import fs from 'fs';
import path from 'path';
import { PriceData } from '../../types/backtesting';

export interface CachedStockData {
  ticker: string;
  date: string;
  price: number;
  adjustedPrice: number;
  sharesOutstanding: number;
  marketCap: number;
  lastUpdated: string;
  isDelisted?: boolean;
}

interface CacheMetadata {
  version: string;
  lastFullUpdate: string;
  totalRecords: number;
  tickers: string[];
}

export class HistoricalDataCache {
  protected cacheDir: string;
  protected dataFile: string;
  protected metadataFile: string;
  protected cache: Map<string, CachedStockData>;
  protected metadata: CacheMetadata;

  constructor(cacheDir: string = './cache') {
    this.cacheDir = cacheDir;
    this.dataFile = path.join(cacheDir, 'historical_stock_data.json');
    this.metadataFile = path.join(cacheDir, 'cache_metadata.json');
    this.cache = new Map();
    this.metadata = {
      version: '1.0.0',
      lastFullUpdate: '',
      totalRecords: 0,
      tickers: []
    };
    
    this.initializeCache();
  }

  private initializeCache(): void {
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Load existing cache
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        const cachedData: CachedStockData[] = JSON.parse(data);
        
        cachedData.forEach(item => {
          const key = this.generateKey(item.ticker, item.date);
          this.cache.set(key, item);
        });
        
        console.log(`📦 Loaded ${this.cache.size} cached records`);
      }

      if (fs.existsSync(this.metadataFile)) {
        const metaData = fs.readFileSync(this.metadataFile, 'utf8');
        this.metadata = JSON.parse(metaData);
      }
    } catch (error) {
      console.error('Error loading cache:', error);
      this.cache.clear();
    }
  }

  private saveCache(): void {
    try {
      // Convert Map to array for JSON serialization
      const dataArray = Array.from(this.cache.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(dataArray, null, 2));
      
      // Update metadata
      this.metadata.totalRecords = this.cache.size;
      this.metadata.tickers = [...new Set(dataArray.map(d => d.ticker))];
      fs.writeFileSync(this.metadataFile, JSON.stringify(this.metadata, null, 2));
      
      console.log(`💾 Saved ${this.cache.size} records to cache`);
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }

  private generateKey(ticker: string, date: string): string {
    return `${ticker}|${date}`;
  }

  public get(ticker: string, date: string): CachedStockData | null {
    const key = this.generateKey(ticker, date);
    return this.cache.get(key) || null;
  }

  public set(data: CachedStockData): void {
    const key = this.generateKey(data.ticker, data.date);
    this.cache.set(key, {
      ...data,
      lastUpdated: new Date().toISOString()
    });
  }

  public has(ticker: string, date: string): boolean {
    const key = this.generateKey(ticker, date);
    return this.cache.has(key);
  }

  public async getOrFetch(
    ticker: string, 
    date: string,
    fetcher: (ticker: string, date: string) => Promise<PriceData | null>
  ): Promise<PriceData | null> {
    // Check cache first
    const cached = this.get(ticker, date);
    if (cached && !this.isStale(cached)) {
      console.log(`📋 Cache hit: ${ticker} on ${date}`);
      return {
        ticker: cached.ticker,
        date: cached.date,
        price: cached.price,
        adjustedPrice: cached.adjustedPrice,
        sharesOutstanding: cached.sharesOutstanding,
        marketCap: cached.marketCap
      };
    }

    // Fetch from API
    console.log(`🌐 Cache miss: Fetching ${ticker} on ${date}`);
    try {
      const data = await fetcher(ticker, date);
      
      if (data) {
        // Store in cache
        this.set({
          ticker: data.ticker,
          date: data.date,
          price: data.price,
          adjustedPrice: data.adjustedPrice,
          sharesOutstanding: data.sharesOutstanding,
          marketCap: data.marketCap,
          lastUpdated: new Date().toISOString(),
          isDelisted: false
        });
      } else {
        // Mark as potentially delisted
        this.set({
          ticker,
          date,
          price: 0,
          adjustedPrice: 0,
          sharesOutstanding: 0,
          marketCap: 0,
          lastUpdated: new Date().toISOString(),
          isDelisted: true
        });
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching ${ticker} on ${date}:`, error);
      return null;
    }
  }

  private isStale(data: CachedStockData, maxAgeDays: number = 30): boolean {
    // Historical data doesn't change, so we can keep it indefinitely
    // Only check staleness for recent dates
    const dataDate = new Date(data.date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // If data is older than 30 days, it's historical and won't change
    if (dataDate < thirtyDaysAgo) {
      return false;
    }
    
    // For recent data, check last updated time
    const lastUpdated = new Date(data.lastUpdated);
    const now = new Date();
    const ageInDays = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    
    return ageInDays > maxAgeDays;
  }

  public flush(): void {
    this.saveCache();
  }

  public clear(): void {
    this.cache.clear();
    this.saveCache();
  }

  public getStats(): {
    totalRecords: number;
    uniqueTickers: number;
    dateRange: { earliest: string; latest: string };
    delistedCount: number;
  } {
    const records = Array.from(this.cache.values());
    const tickers = new Set(records.map(r => r.ticker));
    const dates = records.map(r => r.date).sort();
    const delisted = records.filter(r => r.isDelisted).length;
    
    return {
      totalRecords: records.length,
      uniqueTickers: tickers.size,
      dateRange: {
        earliest: dates[0] || 'N/A',
        latest: dates[dates.length - 1] || 'N/A'
      },
      delistedCount: delisted
    };
  }

  public async prewarmCache(
    stocks: Array<{ ticker: string; startDate: string; endDate: string | null }>,
    years: number[],
    fetcher: (ticker: string, date: string) => Promise<PriceData | null>,
    progressCallback?: (current: number, total: number) => void
  ): Promise<void> {
    console.log('🔥 Pre-warming cache with historical data...');
    
    const requests: Array<{ ticker: string; date: string }> = [];
    
    // Generate all date/ticker combinations
    for (const stock of stocks) {
      for (const year of years) {
        const yearStart = `${year}-01-02`; // Typical first trading day
        
        // Check if stock was active during this year
        const startYear = parseInt(stock.startDate.split('-')[0]);
        const endYear = stock.endDate ? parseInt(stock.endDate.split('-')[0]) : 9999;
        
        if (year >= startYear && year <= endYear) {
          requests.push({ ticker: stock.ticker, date: yearStart });
        }
      }
    }
    
    console.log(`📊 Total requests to process: ${requests.length}`);
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    let processed = 0;
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async ({ ticker, date }) => {
          if (!this.has(ticker, date)) {
            await this.getOrFetch(ticker, date, fetcher);
          }
        })
      );
      
      processed += batch.length;
      
      if (progressCallback) {
        progressCallback(processed, requests.length);
      }
      
      // Save cache periodically
      if (processed % 100 === 0) {
        this.saveCache();
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final save
    this.saveCache();
    console.log('✅ Cache pre-warming complete!');
  }
}

// Singleton instance
let cacheInstance: HistoricalDataCache | null = null;

export function getHistoricalDataCache(): HistoricalDataCache {
  if (!cacheInstance) {
    cacheInstance = new HistoricalDataCache();
  }
  return cacheInstance;
}