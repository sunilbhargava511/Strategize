// api/_errorHandler.ts
// Standardized error handling for API endpoints

import type { VercelResponse } from '@vercel/node';
import { logger } from './_logger';
import type { ApiError } from './_types';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleApiError = (
  res: VercelResponse,
  error: Error | AppError | any,
  context: string = 'API operation'
): VercelResponse => {
  const errorId = Math.random().toString(36).substring(2, 15);
  
  if (error instanceof AppError) {
    logger.warn(`${context} failed [${errorId}]: ${error.message}`, error.details);
    
    const response: ApiError = {
      error: error.message,
      message: `${context} failed`,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined
    };
    
    return res.status(error.statusCode).json(response);
  }
  
  // Log unexpected errors
  logger.error(`${context} failed [${errorId}]: ${error.message}`, error);
  
  const response: ApiError = {
    error: 'Internal server error',
    message: `${context} failed`,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  };
  
  return res.status(500).json(response);
};

// Common error creators
export const createValidationError = (message: string, details?: any) => 
  new AppError(400, message, details);

export const createNotFoundError = (message: string, details?: any) => 
  new AppError(404, message, details);

export const createConfigError = (message: string, details?: any) => 
  new AppError(500, message, details);

export const createRateLimitError = (message: string, details?: any) => 
  new AppError(429, message, details);