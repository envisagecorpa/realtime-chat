import { Request, Response, NextFunction } from 'express';

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  DUPLICATE_ERROR = 'DUPLICATE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.VALIDATION_ERROR, 400, true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, ErrorType.AUTHENTICATION_ERROR, 401, true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, ErrorType.AUTHORIZATION_ERROR, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, ErrorType.NOT_FOUND_ERROR, 404, true);
  }
}

export class DuplicateError extends AppError {
  constructor(resource: string, field?: string) {
    const message = field
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`;
    super(message, ErrorType.DUPLICATE_ERROR, 409, true);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, ErrorType.RATE_LIMIT_ERROR, 429, true);
  }
}

export class FileError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.FILE_ERROR, 400, true, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, ErrorType.DATABASE_ERROR, 500, false, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service unavailable') {
    super(`${service}: ${message}`, ErrorType.EXTERNAL_SERVICE_ERROR, 503, false);
  }
}

export class ErrorHandler {
  public static handle = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    let appError: AppError;

    // Convert known errors to AppError
    if (error instanceof AppError) {
      appError = error;
    } else if (error.name === 'ValidationError') {
      // Mongoose/TypeORM validation error
      appError = new ValidationError('Validation failed', error.message);
    } else if (error.name === 'CastError') {
      // Database casting error (invalid ID format)
      appError = new ValidationError('Invalid ID format');
    } else if (error.name === 'JsonWebTokenError') {
      appError = new AuthenticationError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      appError = new AuthenticationError('Token expired');
    } else if (error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
      appError = new DuplicateError('Resource');
    } else {
      // Unknown error
      appError = new AppError(
        'Internal server error',
        ErrorType.INTERNAL_ERROR,
        500,
        false
      );
    }

    ErrorHandler.logError(appError, req);
    ErrorHandler.sendErrorResponse(appError, res);
  };

  private static logError(error: AppError, req: Request): void {
    const logData = {
      timestamp: new Date().toISOString(),
      type: error.type,
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).userId,
      sessionId: (req as any).sessionId,
      details: error.details,
    };

    if (error.statusCode >= 500) {
      console.error('Server Error:', logData);
    } else {
      console.warn('Client Error:', logData);
    }

    // In production, you might want to send this to a logging service
    // e.g., Winston, Sentry, etc.
  }

  private static sendErrorResponse(error: AppError, res: Response): void {
    const isDevelopment = process.env.NODE_ENV === 'development';

    const errorResponse: any = {
      error: {
        type: error.type,
        message: error.message,
        statusCode: error.statusCode,
      },
    };

    // Include additional details in development or for operational errors
    if (isDevelopment || error.isOperational) {
      if (error.details) {
        errorResponse.error.details = error.details;
      }
    }

    // Include stack trace only in development for non-operational errors
    if (isDevelopment && !error.isOperational) {
      errorResponse.error.stack = error.stack;
    }

    res.status(error.statusCode).json(errorResponse);
  }

  // Async error wrapper for route handlers
  public static catchAsync = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  // Handle unhandled promise rejections
  public static handleUnhandledRejection = (): void => {
    process.on('unhandledRejection', (reason: any) => {
      console.error('Unhandled Promise Rejection:', reason);
      // In production, you might want to gracefully shutdown
      process.exit(1);
    });
  };

  // Handle uncaught exceptions
  public static handleUncaughtException = (): void => {
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      // In production, you might want to gracefully shutdown
      process.exit(1);
    });
  };
}

// Not found middleware for undefined routes
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError('Route');
  next(error);
};

// Export convenience functions and classes
export const {
  handle: errorHandler,
  catchAsync,
  handleUnhandledRejection,
  handleUncaughtException,
} = ErrorHandler;

export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DuplicateError,
  RateLimitError,
  FileError,
  DatabaseError,
  ExternalServiceError,
};