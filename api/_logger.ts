// api/_logger.ts
// Simple logging utility for production vs development

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  // Always log errors
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },

  // Always log warnings
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  // Log info in development, suppress in production
  info: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  // Debug logging only in development
  debug: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  // Always log important operational messages
  success: (message: string, ...args: any[]) => {
    console.log(`✅ ${message}`, ...args);
  }
};