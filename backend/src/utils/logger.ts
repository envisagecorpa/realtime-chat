import { createLogger, format, transports, Logger } from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
require('winston').addColors(colors);

// Define which transports the logger must use
const getTransports = () => {
  const logTransports = [];

  // Console transport
  logTransports.push(
    new transports.Console({
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        format.colorize({ all: true }),
        format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
    })
  );

  // File transports for production
  if (process.env.NODE_ENV === 'production') {
    // Error log file
    logTransports.push(
      new transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
        format: format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json()
        ),
      })
    );

    // Combined log file
    logTransports.push(
      new transports.File({
        filename: path.join('logs', 'combined.log'),
        format: format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json()
        ),
      })
    );
  }

  return logTransports;
};

// Create the logger
const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'realtime-chat' },
  transports: getTransports(),
});

// Enhanced logging methods with context
export class AppLogger {
  private static instance: AppLogger;
  private logger: Logger;

  private constructor() {
    this.logger = logger;
  }

  public static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  private formatMessage(message: string, context?: any): string {
    if (context) {
      return `${message} ${JSON.stringify(context)}`;
    }
    return message;
  }

  public error(message: string, error?: Error, context?: any): void {
    const logData: any = {
      message: this.formatMessage(message, context),
      level: 'error',
    };

    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.logger.error(logData);
  }

  public warn(message: string, context?: any): void {
    this.logger.warn(this.formatMessage(message, context));
  }

  public info(message: string, context?: any): void {
    this.logger.info(this.formatMessage(message, context));
  }

  public http(message: string, context?: any): void {
    this.logger.http(this.formatMessage(message, context));
  }

  public debug(message: string, context?: any): void {
    this.logger.debug(this.formatMessage(message, context));
  }

  // Specific logging methods for different components
  public logRequest(req: any, res: any, responseTime?: number): void {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: responseTime ? `${responseTime}ms` : undefined,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.userId,
      sessionId: req.sessionId,
    };

    this.http('HTTP Request', logData);
  }

  public logSocketEvent(event: string, socketId: string, userId?: string, data?: any): void {
    const logData = {
      event,
      socketId,
      userId,
      dataSize: data ? JSON.stringify(data).length : 0,
    };

    this.debug('Socket Event', logData);
  }

  public logDatabaseOperation(operation: string, table: string, duration?: number, error?: Error): void {
    const logData = {
      operation,
      table,
      duration: duration ? `${duration}ms` : undefined,
    };

    if (error) {
      this.error('Database Operation Failed', error, logData);
    } else {
      this.debug('Database Operation', logData);
    }
  }

  public logAuthentication(event: string, userId?: string, ip?: string, success: boolean = true): void {
    const logData = {
      event,
      userId,
      ip,
      success,
    };

    if (success) {
      this.info('Authentication Event', logData);
    } else {
      this.warn('Authentication Failed', logData);
    }
  }

  public logModeration(action: string, moderatorId: string, targetUserId: string, reason: string): void {
    const logData = {
      action,
      moderatorId,
      targetUserId,
      reason,
    };

    this.info('Moderation Action', logData);
  }

  public logFileOperation(operation: string, fileId: string, userId: string, filename?: string, size?: number): void {
    const logData = {
      operation,
      fileId,
      userId,
      filename,
      size: size ? `${size} bytes` : undefined,
    };

    this.info('File Operation', logData);
  }

  public logRateLimitExceeded(identifier: string, endpoint: string, limit: number): void {
    const logData = {
      identifier,
      endpoint,
      limit,
    };

    this.warn('Rate Limit Exceeded', logData);
  }

  public logPerformance(operation: string, duration: number, context?: any): void {
    const logData = {
      operation,
      duration: `${duration}ms`,
      ...context,
    };

    if (duration > 1000) {
      this.warn('Slow Operation', logData);
    } else {
      this.debug('Performance', logData);
    }
  }

  public logBusinessEvent(event: string, context: any): void {
    this.info('Business Event', { event, ...context });
  }
}

// Create and export singleton instance
export const appLogger = AppLogger.getInstance();

// Export the raw winston logger for backward compatibility
export { logger };

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    appLogger.logRequest(req, res, duration);
  });

  next();
};