const cron = require('node-cron');
const { User, OTP } = require('../models');
const { Op } = require('sequelize');

/**
 * Cleanup expired OTPs
 * Runs every hour
 */
const cleanupExpiredOTPs = async () => {
  try {
    const now = new Date();
    const _deletedCount = await OTP.destroy({
      where: {
        expiresAt: {
          [Op.lt]: now, // expiresAt < now
        },
      },
    });
    
    // if (deletedCount > 0) {
    //   console.log(`✅ Cleaned up ${deletedCount} expired OTP(s)`);
    // }
  } catch (error) {
    console.error('❌ Error cleaning up expired OTPs:', error);
  }
};

/**
 * Cleanup unverified users marked for deletion
 * Runs daily at 2 AM
 */
// Email verification feature removed: do not delete "unverified" users.
const cleanupUnverifiedUsers = async () => {};

/**
 * Initialize all cleanup jobs
 */
const initializeCleanupJobs = async () => {
  // Run cleanup immediately on server start
  // console.log('🔄 Running initial cleanup on server start...');
  await cleanupExpiredOTPs();
  await cleanupUnverifiedUsers();
  // console.log('✅ Initial cleanup completed');
  
  // Schedule cleanup expired OTPs every hour
  cron.schedule('0 * * * *', cleanupExpiredOTPs, {
    scheduled: true,
    timezone: 'UTC',
  });
  // console.log('✅ Cleanup job scheduled: Expired OTPs (every hour)');
  
  // Schedule cleanup unverified users daily at 2 AM UTC
  // (disabled) cleanupUnverifiedUsers
  // console.log('✅ Cleanup job scheduled: Unverified users (daily at 2 AM UTC)');
};

module.exports = {
  cleanupExpiredOTPs,
  cleanupUnverifiedUsers,
  initializeCleanupJobs,
};

