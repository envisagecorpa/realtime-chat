import { AppDataSource } from '../config/database';
import { PresenceService } from '../services/PresenceService';

async function healthCheck(): Promise<void> {
  console.log('🏥 Starting health check...');

  try {
    // Check database connection
    console.log('📊 Checking database connection...');
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    console.log('✅ Database connection: OK');

    // Check Redis connection
    console.log('🔴 Checking Redis connection...');
    const presenceService = new PresenceService();
    const isRedisHealthy = await presenceService.healthCheck();

    if (isRedisHealthy) {
      console.log('✅ Redis connection: OK');
    } else {
      console.log('❌ Redis connection: FAILED');
      process.exit(1);
    }

    await presenceService.disconnect();

    // Check environment variables
    console.log('🔐 Checking environment configuration...');
    const requiredEnvVars = [
      'JWT_SECRET',
      'DATABASE_URL',
      'REDIS_HOST',
      'REDIS_PORT'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingEnvVars.length > 0) {
      console.log(`❌ Missing environment variables: ${missingEnvVars.join(', ')}`);
      process.exit(1);
    }

    console.log('✅ Environment configuration: OK');

    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    console.log('✅ Health check completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  healthCheck();
}

export { healthCheck };