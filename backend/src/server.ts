import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { AppDataSource } from './config/database';
import { SocketHandler } from './socket/socketHandler';
import apiRoutes from './api';
import { errorHandler, notFound, handleUnhandledRejection, handleUncaughtException } from './middleware/errorHandler';
import { appLogger } from './utils/logger';

class ChatServer {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private socketHandler: SocketHandler;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.setupSocketIO();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupProcessHandlers();
  }

  private setupSocketIO(): void {
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
    });

    this.socketHandler = new SocketHandler(this.io);
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Static file serving (for uploaded files)
    if (process.env.SERVE_STATIC_FILES === 'true') {
      this.app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));
    }
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api', apiRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Real-time Chat Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          api: '/api',
          health: '/api/health',
        },
      });
    });

    // 404 handler for undefined routes
    this.app.use(notFound);
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(errorHandler);

    // Process error handlers
    handleUnhandledRejection();
    handleUncaughtException();
  }

  private setupProcessHandlers(): void {
    // Graceful shutdown
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));

    // Handle PM2 graceful shutdown
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        this.gracefulShutdown();
      }
    });
  }

  private async gracefulShutdown(): Promise<void> {
    appLogger.info('Starting graceful shutdown...');

    try {
      // Stop accepting new connections
      this.server.close(async () => {
        appLogger.info('HTTP server closed');

        // Close Socket.IO server
        this.io.close(() => {
          appLogger.info('Socket.IO server closed');
        });

        // Close database connections
        if (AppDataSource.isInitialized) {
          await AppDataSource.destroy();
          appLogger.info('Database connections closed');
        }

        appLogger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        appLogger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);

    } catch (error) {
      appLogger.error('Error during graceful shutdown', error);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      // Initialize database
      await AppDataSource.initialize();
      appLogger.info('Database connected successfully');

      // Run migrations in production
      if (process.env.NODE_ENV === 'production') {
        await AppDataSource.runMigrations();
        appLogger.info('Database migrations completed');
      }

      // Start server
      const port = process.env.PORT || 3001;
      this.server.listen(port, () => {
        appLogger.info(`Server running on port ${port}`);
        appLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        appLogger.info(`Database: ${AppDataSource.options.database}`);
        appLogger.info(`Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
      });

    } catch (error) {
      appLogger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getServer(): http.Server {
    return this.server;
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public getSocketHandler(): SocketHandler {
    return this.socketHandler;
  }
}

// Create and start server
const chatServer = new ChatServer();

// Start server if this file is run directly
if (require.main === module) {
  chatServer.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default chatServer;
export { ChatServer };