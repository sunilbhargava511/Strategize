// api/_simulationSummaries.ts
// Centralized simulation summaries management

import { cache } from './_upstashCache';
import { logger } from './_logger';

const SIMULATION_SUMMARIES_KEY = 'simulation_summaries';

export interface SimulationSummary {
  key: string;
  tickers: string[];
  startYear: number;
  endYear: number;
  initialInvestment: number;
  tickerCount: number;
  cachedAt: string;
  isPermanent: boolean;
  customName?: string;
  strategyPerformance?: {
    winningStrategy?: {
      name: string;
      finalValue: number;
    };
    worstStrategy?: {
      name: string;
      finalValue: number;
    };
    spyBenchmark?: {
      name: string;
      finalValue: number;
      annualizedReturn?: number;
    };
  } | null;
  analysisDate?: string;
}

export interface SimulationSummaries {
  summaries: Record<string, SimulationSummary>;
  lastUpdated: string;
  count: number;
}

// Get all simulation summaries
export async function getSimulationSummaries(): Promise<SimulationSummaries> {
  try {
    const summaries = await cache.get(SIMULATION_SUMMARIES_KEY);
    
    if (!summaries) {
      logger.info('No simulation summaries found, returning empty object');
      return {
        summaries: {},
        lastUpdated: new Date().toISOString(),
        count: 0
      };
    }
    
    return summaries;
  } catch (error) {
    logger.error('Error getting simulation summaries:', error);
    return {
      summaries: {},
      lastUpdated: new Date().toISOString(),
      count: 0
    };
  }
}

// Add or update a simulation summary
export async function addSimulationSummary(summary: SimulationSummary): Promise<void> {
  try {
    const summaries = await getSimulationSummaries();
    
    // Add or update the summary
    summaries.summaries[summary.key] = summary;
    summaries.count = Object.keys(summaries.summaries).length;
    summaries.lastUpdated = new Date().toISOString();
    
    // Save back to cache
    await cache.set(SIMULATION_SUMMARIES_KEY, summaries);
    
    logger.info(`Added simulation summary for key: ${summary.key}`);
  } catch (error) {
    logger.error('Error adding simulation summary:', error);
    throw error;
  }
}

// Remove a simulation summary
export async function removeSimulationSummary(key: string): Promise<void> {
  try {
    const summaries = await getSimulationSummaries();
    
    if (summaries.summaries[key]) {
      delete summaries.summaries[key];
      summaries.count = Object.keys(summaries.summaries).length;
      summaries.lastUpdated = new Date().toISOString();
      
      // Save back to cache
      await cache.set(SIMULATION_SUMMARIES_KEY, summaries);
      
      logger.info(`Removed simulation summary for key: ${key}`);
    }
  } catch (error) {
    logger.error('Error removing simulation summary:', error);
    throw error;
  }
}

// Get a specific simulation summary
export async function getSimulationSummary(key: string): Promise<SimulationSummary | null> {
  try {
    const summaries = await getSimulationSummaries();
    return summaries.summaries[key] || null;
  } catch (error) {
    logger.error('Error getting simulation summary:', error);
    return null;
  }
}

// Get all summaries as an array (for display)
export async function getSimulationSummariesArray(): Promise<SimulationSummary[]> {
  try {
    const summaries = await getSimulationSummaries();
    const summariesArray = Object.values(summaries.summaries);
    
    // Sort by cache date (newest first)
    summariesArray.sort((a, b) => {
      const dateA = new Date(a.cachedAt === 'Unknown' || !a.cachedAt ? 0 : a.cachedAt);
      const dateB = new Date(b.cachedAt === 'Unknown' || !b.cachedAt ? 0 : b.cachedAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    return summariesArray;
  } catch (error) {
    logger.error('Error getting simulation summaries array:', error);
    return [];
  }
}