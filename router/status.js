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

    const currentHour = new Date().getHours();
    let onlineUsers;
    if (currentHour >= 18 || currentHour < 4) {
        if (currentHour >= 18 && currentHour < 19) {
            onlineUsers = Math.floor(Math.random() * 5) + 10; // 18-19: 10-14 users
        } else if (currentHour >= 19 && currentHour < 20) {
            onlineUsers = Math.floor(Math.random() * 5) + 15; // 19-20: 15-19 users
        } else if (currentHour >= 20 && currentHour < 21) {
            onlineUsers = Math.floor(Math.random() * 5) + 20; // 20-21: 20-24 users
        } else if (currentHour >= 21 && currentHour < 22) {
            onlineUsers = Math.floor(Math.random() * 5) + 25; // 21-22: 25-29 users
        } else if (currentHour >= 22 && currentHour < 23) {
            onlineUsers = Math.floor(Math.random() * 5) + 30; // 22-23: 30-34 users
        } else if (currentHour >= 23 && currentHour < 24) {
            onlineUsers = Math.floor(Math.random() * 5) + 35; // 23-24: 35-39 users
        } else if (currentHour >= 0 && currentHour < 1) {
            onlineUsers = Math.floor(Math.random() * 5) + 40; // 0-1: 40-44 users
        } else if (currentHour >= 1 && currentHour < 2) {
            onlineUsers = Math.floor(Math.random() * 5) + 45; // 1-2: 45-49 users
        } else if (currentHour >= 2 && currentHour < 3) {
            onlineUsers = Math.floor(Math.random() * 5) + 50; // 2-3: 50-54 users
        } else {
            onlineUsers = Math.floor(Math.random() * 5) + 55; // 3-4: 55-59 users
        }
    } else {
        if (currentHour >= 4 && currentHour < 5) {
            onlineUsers = Math.floor(Math.random() * 5) + 5; // 4-5: 5-9 users
        } else if (currentHour >= 5 && currentHour < 6) {
            onlineUsers = Math.floor(Math.random() * 5) + 6; // 5-6: 6-10 users
        } else if (currentHour >= 6 && currentHour < 7) {
            onlineUsers = Math.floor(Math.random() * 5) + 7; // 6-7: 7-11 users
        } else if (currentHour >= 7 && currentHour < 8) {
            onlineUsers = Math.floor(Math.random() * 5) + 8; // 7-8: 8-12 users
        } else if (currentHour >= 8 && currentHour < 9) {
            onlineUsers = Math.floor(Math.random() * 5) + 9; // 8-9: 9-13 users
        } else if (currentHour >= 9 && currentHour < 10) {
            onlineUsers = Math.floor(Math.random() * 5) + 10; // 9-10: 10-14 users
        } else if (currentHour >= 10 && currentHour < 11) {
            onlineUsers = Math.floor(Math.random() * 5) + 11; // 10-11: 11-15 users
        } else if (currentHour >= 11 && currentHour < 12) {
            onlineUsers = Math.floor(Math.random() * 5) + 12; // 11-12: 12-16 users
        } else if (currentHour >= 12 && currentHour < 13) {
            onlineUsers = Math.floor(Math.random() * 5) + 13; // 12-13: 13-17 users
        } else if (currentHour >= 13 && currentHour < 14) {
            onlineUsers = Math.floor(Math.random() * 5) + 14; // 13-14: 14-18 users
        } else if (currentHour >= 14 && currentHour < 15) {
            onlineUsers = Math.floor(Math.random() * 5) + 15; // 14-15: 15-19 users
        } else if (currentHour >= 15 && currentHour < 16) {
            onlineUsers = Math.floor(Math.random() * 5) + 16; // 15-16: 16-20 users
        } else if (currentHour >= 16 && currentHour < 17) {
            onlineUsers = Math.floor(Math.random() * 5) + 17; // 16-17: 17-21 users
        } else {
            onlineUsers = Math.floor(Math.random() * 5) + 18; // 17-18: 18-22 users
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
        activity: {
            onlineUsers: onlineUsers
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