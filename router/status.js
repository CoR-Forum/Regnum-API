const express = require('express');
const os = require('os');
const mongoose = require('mongoose');
const {
    User,
    BannedUser,
    UserSettings,
    Licenses,
    MemoryPointer,
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

    let dbStats = {};
    if (mongoose.connection.db) {
        try {
            dbStats = await mongoose.connection.db.stats();
        } catch (err) {
            console.error("Error fetching database stats:", err);
        }
    }

    const userCount = await User.countDocuments();
    const bannedUserCount = await BannedUser.countDocuments();
    const userSettingsCount = await UserSettings.countDocuments();
    const licensesCount = await Licenses.countDocuments();
    const memoryPointerCount = await MemoryPointer.countDocuments();
    const activityLogCount = await ActivityLog.countDocuments();
    const notificationQueueCount = await NotificationQueue.countDocuments();
    const publicChatCount = await PublicChat.countDocuments();
    const tokenCount = await Token.countDocuments();

    cachedStats = {
        status: "success",
        message: "API is running",
        api: {
            uptime: apiUptime / 1000,
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
                userSettingsCount: userSettingsCount,
                licensesCount: licensesCount,
                memoryPointerCount: memoryPointerCount,
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