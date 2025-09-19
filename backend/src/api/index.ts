import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import roomRoutes from './rooms';
import messageRoutes from './messages';
import fileRoutes from './files';
import moderationRoutes from './moderation';
import { apiRateLimit } from '../middleware/rateLimiter';
import { requestLogger } from '../utils/logger';

const router = Router();

// Apply global middleware for all API routes
router.use(requestLogger); // Log all requests
router.use(apiRateLimit); // Apply general API rate limiting

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API version info
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'Real-time Chat API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      rooms: '/api/rooms',
      messages: '/api/messages',
      files: '/api/files',
      moderation: '/api/moderation',
    },
    documentation: '/api/docs', // If you add API documentation
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/rooms', roomRoutes);
router.use('/messages', messageRoutes);
router.use('/files', fileRoutes);
router.use('/moderation', moderationRoutes);

export default router;