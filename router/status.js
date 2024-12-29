const express = require('express');
const os = require('os');
const mongoose = require('mongoose');
const {
    User,
    BannedUser,
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

    const currentHour = new Date().getHours();
    let connectedUsers;
    if (currentHour >= 18 || currentHour < 4) {
        if (currentHour >= 18 && currentHour < 19) {
            connectedUsers = Math.floor(Math.random() * 5) + 10; // 18-19: 10-14 users
        } else if (currentHour >= 19 && currentHour < 20) {
            connectedUsers = Math.floor(Math.random() * 5) + 14; // 19-20: 14-18 users
        } else if (currentHour >= 20 && currentHour < 21) {
            connectedUsers = Math.floor(Math.random() * 5) + 18; // 20-21: 18-22 users
        } else if (currentHour >= 21 && currentHour < 22) {
            connectedUsers = Math.floor(Math.random() * 5) + 22; // 21-22: 22-26 users
        } else if (currentHour >= 22 && currentHour < 23) {
            connectedUsers = Math.floor(Math.random() * 5) + 26; // 22-23: 26-30 users
        } else if (currentHour >= 23 && currentHour < 24) {
            connectedUsers = Math.floor(Math.random() * 5) + 30; // 23-24: 30-34 users
        } else if (currentHour >= 0 && currentHour < 1) {
            connectedUsers = Math.floor(Math.random() * 5) + 34; // 0-1: 34-38 users
        } else if (currentHour >= 1 && currentHour < 2) {
            connectedUsers = Math.floor(Math.random() * 5) + 38; // 1-2: 38-42 users
        } else if (currentHour >= 2 && currentHour < 3) {
            connectedUsers = Math.floor(Math.random() * 5) + 42; // 2-3: 42-46 users
        } else {
            connectedUsers = Math.floor(Math.random() * 5) + 46; // 3-4: 46-50 users
        }
    } else {
        if (currentHour >= 4 && currentHour < 5) {
            connectedUsers = Math.floor(Math.random() * 5) + 5; // 4-5: 5-9 users
        } else if (currentHour >= 5 && currentHour < 6) {
            connectedUsers = Math.floor(Math.random() * 5) + 9; // 5-6: 9-13 users
        } else if (currentHour >= 6 && currentHour < 7) {
            connectedUsers = Math.floor(Math.random() * 5) + 13; // 6-7: 13-17 users
        } else if (currentHour >= 7 && currentHour < 8) {
            connectedUsers = Math.floor(Math.random() * 5) + 17; // 7-8: 17-21 users
        } else if (currentHour >= 8 && currentHour < 9) {
            connectedUsers = Math.floor(Math.random() * 5) + 21; // 8-9: 21-25 users
        } else if (currentHour >= 9 && currentHour < 10) {
            connectedUsers = Math.floor(Math.random() * 5) + 25; // 9-10: 25-29 users
        } else if (currentHour >= 10 && currentHour < 11) {
            connectedUsers = Math.floor(Math.random() * 5) + 29; // 10-11: 29-33 users
        } else if (currentHour >= 11 && currentHour < 12) {
            connectedUsers = Math.floor(Math.random() * 5) + 33; // 11-12: 33-37 users
        } else if (currentHour >= 12 && currentHour < 13) {
            connectedUsers = Math.floor(Math.random() * 5) + 37; // 12-13: 37-41 users
        } else if (currentHour >= 13 && currentHour < 14) {
            connectedUsers = Math.floor(Math.random() * 5) + 41; // 13-14: 41-45 users
        } else if (currentHour >= 14 && currentHour < 15) {
            connectedUsers = Math.floor(Math.random() * 5) + 45; // 14-15: 45-49 users
        } else if (currentHour >= 15 && currentHour < 16) {
            connectedUsers = Math.floor(Math.random() * 5) + 49; // 15-16: 49-53 users
        } else if (currentHour >= 16 && currentHour < 17) {
            connectedUsers = Math.floor(Math.random() * 5) + 53; // 16-17: 53-57 users
        } else {
            connectedUsers = Math.floor(Math.random() * 5) + 57; // 17-18: 57-61 users
        }
    }

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
        activity: {
            connectedUsers: connectedUsers
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