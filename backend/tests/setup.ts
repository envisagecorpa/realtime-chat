import 'reflect-metadata';
import { AppDataSource } from '../src/config/database';

// Setup test database connection
beforeAll(async () => {
  // Use test database configuration
  process.env.DATABASE_NAME = 'chatdb_test';
  process.env.NODE_ENV = 'test';

  try {
    await AppDataSource.initialize();
    await AppDataSource.synchronize(true); // Drop and recreate schema
  } catch (error) {
    console.error('Test database setup failed:', error);
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

// Clean database before each test
beforeEach(async () => {
  if (AppDataSource.isInitialized) {
    const entities = AppDataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = AppDataSource.getRepository(entity.name);
      await repository.clear();
    }
  }
});