const nodemailer = require('nodemailer');
const axios = require('axios');
const { NotificationQueue } = require('./models');
require('dotenv').config();

const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_SECURE,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_NAME,
    DISCORD_LOGIN_WEBHOOK_URL,
    DISCORD_LOG_WEBHOOK_URL
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

const sendEmail = async (to, subject, text) => {
    log(`NOTIFIER: sendEmail called with to: ${to}, subject: ${subject}`);
    try {
        const info = await transporter.sendMail({
            from: `"${EMAIL_NAME}" <${EMAIL_USER}>`,
            to,
            subject,
            text
        });
        log(`NOTIFIER: Message sent: ${info.messageId}`);
    } catch (error) {
        log(`NOTIFIER: Error sending email: ${error.message}`, error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

const sendDiscordNotification = async (id, message, createdAt, type) => {
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
};

const queueNotification = async (to, subject, text, type) => {
    log(`NOTIFIER: queueNotification called with type: ${type}`);
    try {
        const notification = new NotificationQueue({
            to_email: to,
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
    try {
        const notifications = await NotificationQueue.find({
            status: { $in: ['pending', 'failed'] }
        }).limit(3);

        const processJob = async (job) => {
            log(`NOTIFIER: Processing job id: ${job._id}`);
            job.status = 'processing';
            await job.save();

            try {
                if (job.type === 'email') {
                    await sendEmail(job.to_email, job.subject, job.body);
                    await notifyAdmins(`[Processed Notification ID: ${job._id} (E-Mail)] Email sent to: ${job.to_email}: ${job.subject}`);
                    job.status = 'completed';
                } else if (job.type.startsWith('discord')) {
                    await sendDiscordNotification(job._id, job.body, job.created_at, job.type);
                    job.status = 'completed';
                }
                log(`NOTIFIER: Job id: ${job._id} completed`);
            } catch (error) {
                job.status = 'failed';
                log(`NOTIFIER: Job id: ${job._id} failed: ${error.message}`, error);
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

module.exports = { mail, notifyAdmins };