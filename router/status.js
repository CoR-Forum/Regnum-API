const express = require('express');
const os = require('os');
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
    Token
} = require('../models');

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

    if (!mongoose.connection.readyState) {
        return;
    }

    const dbStats = await mongoose.connection.db.stats();

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
    const tokenCount = await Token.countDocuments();
    const apiVersion = await Settings.findOne({ name: 'api_version' });
    const sylentxVersion = await Settings.findOne({ name: 'sylentx_version' });

    cachedStats = {
        status: "success",
        message: "API is running",
        api: {
            uptime: apiUptime / 1000,
            version: apiVersion ? apiVersion.value : "0.0.0",
            sylentxVersion: sylentxVersion ? sylentxVersion.value : "0.0.0"
        },
        system: {
            load: load,
            uptime: uptime,
            freeMemory: freeMemory,
            totalMemory: totalMemory,
            cpus: cpus,
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
                tokenCount: tokenCount
            }
        },
        lastUpdate: new Date().toISOString()
    };
};

router.get('/', (req, res) => {
    if (Object.keys(cachedStats).length === 0) {
        res.json({
            status: "info",
            message: "API has just been started, cache is being built. Please try again in a few moments."
        });
    } else {
        res.json(cachedStats);
    }
});

module.exports = { router, updateStats };