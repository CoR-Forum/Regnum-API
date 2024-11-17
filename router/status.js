const express = require('express');
const os = require('os');
const disk = require('diskusage');
const mongoose = require('mongoose');
const {
  User,
  BannedUser,
  PasswordReset,
  UserSettings,
  Licenses,
  MemoryPointer,
  Settings,
  ActivityLog,
  NotificationQueue,
  PublicChat,
  Feedback,
  Token
} = require('../models'); // Adjust the path as necessary

const router = express.Router();

const startTime = Date.now();
let cachedStats = {};

const updateStats = async () => {
    const load = os.loadavg();
    const uptime = os.uptime();
    const apiUptime = Date.now() - startTime;
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const cpus = os.cpus().length;
    const nodeVersion = process.version;
    const envVariables = {
      NODE_ENV: process.env.NODE_ENV,
      BASE_URL: process.env.BASE_URL,
      BASE_PATH: process.env.BASE_PATH
    };
  
    // Fetch disk usage
    const diskUsage = await disk.check('/');
  
    // Ensure the database connection is ready
    if (!mongoose.connection.readyState) {
      console.error('Database connection is not ready');
      return;
    }
  
    // Fetch database stats
    const dbStats = await mongoose.connection.db.stats();
  
    // Fetch detailed stats for each model
    const userCount = await User.countDocuments();
    const bannedUserCount = await BannedUser.countDocuments();
    const passwordResetCount = await PasswordReset.countDocuments();
    const userSettingsCount = await UserSettings.countDocuments();
    const licensesCount = await Licenses.countDocuments();
    const memoryPointerCount = await MemoryPointer.countDocuments();
    const settingsCount = await Settings.countDocuments();
    const activityLogCount = await ActivityLog.countDocuments();
    const notificationQueueCount = await NotificationQueue.countDocuments();
    const publicChatCount = await PublicChat.countDocuments();
    const feedbackCount = await Feedback.countDocuments();
    const tokenCount = await Token.countDocuments();
  
    cachedStats = {
      status: "success",
      message: "API is running",
      api: {
        uptime: apiUptime / 1000
      },
      system: {
        load: load,
        uptime: uptime,
        freeMemory: freeMemory,
        totalMemory: totalMemory,
        cpus: cpus,
        diskUsage: {
          free: diskUsage.free,
          total: diskUsage.total,
          available: diskUsage.available
        },
        nodeVersion: nodeVersion,
        envVariables: envVariables
      },
      database: {
        collections: dbStats.collections,
        objects: dbStats.objects,
        avgObjSize: dbStats.avgObjSize,
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize,
        indexes: dbStats.indexes,
        indexSize: dbStats.indexSize,
        detailedStats: {
          userCount: userCount,
          bannedUserCount: bannedUserCount,
          passwordResetCount: passwordResetCount,
          userSettingsCount: userSettingsCount,
          licensesCount: licensesCount,
          memoryPointerCount: memoryPointerCount,
          settingsCount: settingsCount,
          activityLogCount: activityLogCount,
          notificationQueueCount: notificationQueueCount,
          publicChatCount: publicChatCount,
          feedbackCount: feedbackCount,
          tokenCount: tokenCount
        }
      },
      lastUpdate: new Date().toISOString() // Add this line
    };
  };

// Periodically update stats
setInterval(updateStats, 60000); // Update every 60 seconds

// Define the status route
router.get('/', (req, res) => {
  res.json(cachedStats);
});

// Export the router and updateStats function
module.exports = { router, updateStats };