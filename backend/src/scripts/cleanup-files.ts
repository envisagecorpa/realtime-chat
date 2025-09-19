import { FileService } from '../services/FileService';
import { AppDataSource } from '../config/database';

async function cleanupFiles(): Promise<void> {
  console.log('📁 Starting file cleanup...');

  try {
    // Initialize database
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const fileService = new FileService();

    // Cleanup expired files
    console.log('🗑️ Cleaning up expired files...');
    const deletedCount = await fileService.cleanupExpiredFiles();
    console.log(`✅ Removed ${deletedCount} expired files`);

    // Get file statistics
    console.log('📊 Gathering file statistics...');
    const stats = await fileService.getFileStats();

    console.log('\n📊 File system statistics:');
    console.log(`   Total files: ${stats.totalFiles}`);
    console.log(`   Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Storage used: ${(stats.storageUsed / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n📁 Files by type:');
    Object.entries(stats.filesByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} files`);
    });

    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    console.log('✅ File cleanup completed successfully');

  } catch (error) {
    console.error('❌ File cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  cleanupFiles();
}

export { cleanupFiles };