const nodemailer = require('nodemailer');
const axios = require('axios');
const Bottleneck = require('bottleneck');
const { NotificationQueue } = require('../models');
const { sendMessageToDiscordChannel } = require('../discordBot');
require('dotenv').config();

const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_SECURE,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_NAME,
    DISCORD_LOGIN_WEBHOOK_URL,
    DISCORD_LOG_WEBHOOK_URL,
    DISCORD_LOG_CHANNEL_ID,
    DISCORD_LOGIN_CHANNEL_ID
} = process.env;

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_SECURE === 'true',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

const log = (message, error = null) => {
    const timestamp = new Date().toISOString();
    if (error) {
        console.error(`[${timestamp}] ${message}`, error);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
};

const addLogEntry = async (notificationId, type, message) => {
    log(`NOTIFIER: addLogEntry called with notificationId: ${notificationId}, type: ${type}, message: ${message}`);
    try {
        await NotificationQueue.findByIdAndUpdate(notificationId, {
            $push: {
                logs: {
                    date: new Date(),
                    type,
                    message
                }
            }
        });
        log(`NOTIFIER: Log entry added for notificationId: ${notificationId}`);
    } catch (error) {
        log(`NOTIFIER: Error adding log entry for notificationId: ${notificationId}: ${error.message}`, error);
    }
};

const sendEmail = async (to, subject, text) => {
    log(`NOTIFIER: sendEmail called with to: ${to}, subject: ${subject}`);
    const signature = "\n\nBest regards,\n" + EMAIL_NAME;
    const emailBody = `${text}${signature}`;
    try {
        const info = await transporter.sendMail({
            from: `"${EMAIL_NAME}" <${EMAIL_USER}>`,
            to,
            subject,
            text: emailBody
        });
        log(`NOTIFIER: Message sent: ${info.messageId}`);
    } catch (error) {
        log(`NOTIFIER: Error sending email: ${error.message}`, error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

const limiter = new Bottleneck({
    minTime: 1000 // Minimum time between requests in milliseconds
});

const sendDiscordNotification = limiter.wrap(async (id, message, createdAt, type) => {
    const webhookUrls = {
        discord_login: DISCORD_LOGIN_WEBHOOK_URL,
        discord_log: DISCORD_LOG_WEBHOOK_URL
    };

    const webhookUrl = webhookUrls[type];
    if (!webhookUrl) {
        log(`NOTIFIER: Unknown Discord notification type: ${type}`);
        throw new Error(`Unknown Discord notification type: ${type}`);
    }

    log(`NOTIFIER: sendDiscordNotification called with webhookUrl: ${webhookUrl}`);
    try {
        const embed = {
            title: `Notification ID: ${id}`,
            description: message,
            timestamp: createdAt,
            color: 3447003
        };

        await axios.post(webhookUrl, { embeds: [embed] });
        log('NOTIFIER: Discord notification sent');
    } catch (error) {
        log(`NOTIFIER: Error sending Discord notification: ${error.message}`, error);
        throw new Error(`Failed to send Discord notification: ${error.message}`);
    }
});

const queueNotification = async (to, subject, text, type) => {
    log(`NOTIFIER: queueNotification called with type: ${type}`);
    try {
        const notification = new NotificationQueue({
            to: to,
            subject,
            body: text,
            type
        });
        await notification.save();
        log(`NOTIFIER: ${type} notification queued successfully`);
    } catch (error) {
        log(`NOTIFIER: Error queuing ${type} notification: ${error.message}`, error);
    }
};

const mail = async (to, subject, text) => {
    await queueNotification(to, subject, text, 'email');
};

const notifyAdmins = async (message, type = 'discord_log') => {
    await queueNotification(null, null, message, type);
};

const processNotificationQueue = async () => {
    const MAX_FAILURES = 3;

    try {
        const notifications = await NotificationQueue.find({
            status: { $in: ['pending', 'failed', 'retry'] }
        }).limit(3);

        const processJob = async (job) => {
            log(`NOTIFIER: Processing job id: ${job._id}`);
            job.status = 'processing';
            await job.save();
            await addLogEntry(job._id, 'info', 'Processing started');

            try {
                if (job.type === 'email') {
                    await sendEmail(job.to_email, job.subject, job.body);
                    await notifyAdmins(`[Processed Notification ID: ${job._id} (E-Mail)] Email sent to: ${job.to_email}: ${job.subject}`);
                    job.status = 'completed';
                } else if (job.type === 'discord') {
                    await sendMessageToDiscordChannel(to, job.body);
                    job.status = 'completed';
                } else if (job.type.startsWith('discord')) {
                    await sendMessageToDiscordChannel(job.type === 'discord_login' ? DISCORD_LOGIN_CHANNEL_ID : DISCORD_LOG_CHANNEL_ID, job.body);
                    job.status = 'completed';
                }
                log(`NOTIFIER: Job id: ${job._id} completed`);
                await addLogEntry(job._id, 'info', 'Processing completed');
            } catch (error) {
                job.status = 'failed';
                log(`NOTIFIER: Job id: ${job._id} failed: ${error.message}`, error);
                await addLogEntry(job._id, 'error', `Processing failed: ${error.message}`);

                const failureLogs = job.logs.filter(log => log.type === 'error').length;
                if (failureLogs >= MAX_FAILURES) {
                    log(`NOTIFIER: Job id: ${job._id} has failed multiple times and will not be processed again`);
                    await notifyAdmins(`Notification ID: ${job._id} has failed multiple times and will not be processed again`);
                    job.status = 'failed_permanently';
                } else {
                    job.status = 'retry';
                }
            }
            await job.save();
        };

        await Promise.all(notifications.map(processJob));
    } catch (error) {
        log(`NOTIFIER: Error processing notification queue: ${error.message}`, error);
    }
};

const interval = setInterval(async () => {
    await processNotificationQueue();
}, 2000);

const clearIntervalAndLog = async () => {
    if (interval) {
        clearInterval(interval);
        log('NOTIFIER: Interval cleared');
    }
    log('NOTIFIER: Database connection pool closed');
};

process.on('exit', clearIntervalAndLog);
process.on('SIGINT', clearIntervalAndLog);
process.on('SIGTERM', clearIntervalAndLog);

module.exports = { mail, notifyAdmins, queueNotification };