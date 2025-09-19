import { PresenceService } from '../services/PresenceService';
import { ModerationService } from '../services/ModerationService';
import { AuthService } from '../services/AuthService';

async function cleanupRedis(): Promise<void> {
  console.log('🧹 Starting Redis cleanup...');

  try {
    const presenceService = new PresenceService();
    const moderationService = new ModerationService();
    const authService = new AuthService();

    // Cleanup expired presence data
    console.log('👥 Cleaning up expired presence data...');
    const expiredPresenceCount = await presenceService.cleanupExpiredPresence();
    console.log(`✅ Removed ${expiredPresenceCount} expired presence records`);

    // Cleanup expired typing indicators
    console.log('⌨️ Cleaning up expired typing indicators...');
    const expiredTypingCount = await presenceService.cleanupExpiredTyping();
    console.log(`✅ Removed ${expiredTypingCount} expired typing indicators`);

    // Cleanup expired sessions
    console.log('🔐 Cleaning up expired sessions...');
    const expiredSessionCount = await authService.cleanupExpiredSessions();
    console.log(`✅ Removed ${expiredSessionCount} expired sessions`);

    // Cleanup expired moderation actions
    console.log('⚖️ Cleaning up expired moderation actions...');
    const expiredModerationCount = await moderationService.cleanupExpiredActions();
    console.log(`✅ Processed ${expiredModerationCount} expired moderation actions`);

    // Get cleanup statistics
    const presenceStats = await presenceService.getPresenceStats();
    console.log('\n📊 Current Redis statistics:');
    console.log(`   Online users: ${presenceStats.onlineUsers}`);
    console.log(`   Total presence records: ${presenceStats.totalPresenceRecords}`);
    console.log(`   Active typing indicators: ${presenceStats.activeTypingIndicators}`);

    // Disconnect services
    await Promise.all([
      presenceService.disconnect(),
      moderationService.disconnect(),
    ]);

    console.log('✅ Redis cleanup completed successfully');

  } catch (error) {
    console.error('❌ Redis cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  cleanupRedis();
}

export { cleanupRedis };