import { StartOfYearDates } from '../../types/backtesting';

/**
 * Date utilities for portfolio backtesting
 */

export const START_OF_YEAR_DATES: StartOfYearDates = {
  '1996': '1996-01-02',
  '1997': '1997-01-07', 
  '1998': '1998-01-06',
  '1999': '1999-01-05',
  '2000': '2000-01-04',
  '2001': '2001-01-02',
  '2002': '2002-01-02',
  '2003': '2003-01-07',
  '2004': '2004-01-06',
  '2005': '2005-01-04',
  '2006': '2006-01-03',
  '2007': '2007-01-03',
  '2008': '2008-01-02',
  '2009': '2009-01-06',
  '2010': '2010-01-05',
  '2011': '2011-01-04',
  '2012': '2012-01-03',
  '2013': '2013-01-02',
  '2014': '2014-01-07',
  '2015': '2015-01-06',
  '2016': '2016-01-05',
  '2017': '2017-01-03',
  '2018': '2018-01-02',
  '2019': '2019-01-02',
  '2020': '2020-01-07',
  '2021': '2021-01-05',
  '2022': '2022-01-04',
  '2023': '2023-01-03',
  '2024': '2024-01-02',
  '2025': '2025-01-07'
};

/**
 * Get the start-of-year date for a given year
 */
export function getStartOfYearDate(year: number): string {
  const yearStr = year.toString();
  const date = START_OF_YEAR_DATES[yearStr];
  if (!date) {
    throw new Error(`No start-of-year date found for year ${year}`);
  }
  return date;
}

/**
 * Format date for API calls (YYYY-MM-DD)
 */
export function formatDateForAPI(date: string | Date): string {
  if (typeof date === 'string') {
    // Assume it's already in the correct format or convert from M/D/YY
    if (date.includes('/')) {
      const [month, day, year] = date.split('/');
      const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return date;
  }
  
  return date.toISOString().split('T')[0];
}

/**
 * Parse date from various formats to Date object
 */
export function parseDate(dateStr: string): Date {
  // Handle M/D/YY format
  if (dateStr.includes('/')) {
    const [month, day, year] = dateStr.split('/');
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    return new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }
  
  // Handle YYYY-MM-DD format
  return new Date(dateStr);
}

/**
 * Check if a date is within a given range
 */
export function isDateInRange(date: string, startDate: string, endDate: string | null): boolean {
  const checkDate = parseDate(date);
  const rangeStart = parseDate(startDate);
  
  if (endDate) {
    const rangeEnd = parseDate(endDate);
    return checkDate >= rangeStart && checkDate <= rangeEnd;
  }
  
  return checkDate >= rangeStart;
}

/**
 * Get all years in a range
 */
export function getYearsInRange(startYear: number, endYear: number): number[] {
  const years: number[] = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  return years;
}

/**
 * Calculate years between two dates
 */
export function getYearsBetweenDates(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Check if a year has a start date defined
 */
export function hasStartOfYearDate(year: number): boolean {
  return START_OF_YEAR_DATES[year.toString()] !== undefined;
}

/**
 * Get the next valid year with a start date
 */
export function getNextValidYear(year: number): number | null {
  for (let nextYear = year + 1; nextYear <= 2025; nextYear++) {
    if (hasStartOfYearDate(nextYear)) {
      return nextYear;
    }
  }
  return null;
}

/**
 * Convert date to display format
 */
export function formatDateForDisplay(date: string): string {
  const dateObj = parseDate(date);
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}