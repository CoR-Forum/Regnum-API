const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectTimeout: 5000
};

let connection;
let interval;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retry = async (fn, delay = 2000, attempts = 5) => {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            log(`NOTIFIER: Retry attempt ${i + 1} failed: ${error.message}`, error);
            await sleep(delay);
        }
    }
    throw new Error('NOTIFIER: Max retry attempts reached');
};

const log = (message, error = null) => {
    const timestamp = new Date().toISOString();
    if (error) {
        console.error(`[${timestamp}] ${message}`, error);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
};

const createNotificationQueueTable = async () => {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS notification_queue (
            id INT AUTO_INCREMENT PRIMARY KEY,
            to_email VARCHAR(255),
            subject VARCHAR(255),
            body TEXT,
            type ENUM('email', 'discord') NOT NULL,
            status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    try {
        await connection.execute(createTableSQL);
        log('NOTIFIER: notification_queue table ensured');
    } catch (error) {
        log(`NOTIFIER: Error creating notification_queue table: ${error.message}`, error);
    }
};

const initializeDbConnection = async () => {
    try {
        connection = await retry(() => mysql.createConnection(dbConfig));
        log('NOTIFIER: Database connection established');
        await createNotificationQueueTable();
    } catch (error) {
        log(`NOTIFIER: Error establishing database connection: ${error.message}`, error);
    }
};

const closeDbConnection = async () => {
    if (connection) {
        try {
            await connection.end();
            log('NOTIFIER: Database connection closed');
        } catch (error) {
            log(`NOTIFIER: Error closing database connection: ${error.message}`, error);
        }
    }
    if (interval) {
        clearInterval(interval);
        log('NOTIFIER: Interval cleared');
    }
};

const sendEmail = async (to, subject, text) => {
    log(`NOTIFIER: sendEmail called with to: ${to}, subject: ${subject}`);
    try {
        let info = await transporter.sendMail({
            from: `"${process.env.EMAIL_NAME}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text
        });
        log(`NOTIFIER: Message sent: ${info.messageId}`);
    } catch (error) {
        log(`NOTIFIER: Error sending email: ${error.message}`, error);
    }
};

const sendDiscordNotification = async (message) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    log(`NOTIFIER: sendDiscordNotification called with webhookUrl: ${webhookUrl}`);
    try {
        await axios.post(webhookUrl, { content: message });
        log('NOTIFIER: Discord notification sent');
    } catch (error) {
        log(`NOTIFIER: Error sending Discord notification: ${error.message}`, error);
    }
};

const mail = async (to, subject, text) => {
    log(`NOTIFIER: mail called with to: ${to}, subject: ${subject}`);
    if (!connection) {
        log('NOTIFIER: Database is not connected. Notification not queued.');
        return;
    }
    try {
        await createNotificationQueueTable();
        await connection.execute(
            'INSERT INTO notification_queue (to_email, subject, body, type) VALUES (?, ?, ?, ?)',
            [to, subject, text, 'email']
        );
        log('NOTIFIER: Email queued successfully');
    } catch (error) {
        log(`NOTIFIER: Error queuing email: ${error.message}`, error);
    }
};

const notifyAdmins = async (message) => {
    log(`NOTIFIER: notifyAdmins called`);
    if (!connection) {
        log('NOTIFIER: Database is not connected. Notification not queued.');
        return;
    }
    try {
        await createNotificationQueueTable();
        await connection.execute(
            'INSERT INTO notification_queue (to_email, subject, body, type) VALUES (?, ?, ?, ?)',
            [null, null, message, 'discord']
        );
        log('NOTIFIER: Discord notification queued successfully');
    } catch (error) {
        log(`NOTIFIER: Error queuing Discord notification: ${error.message}`, error);
    }
};

const processNotificationQueue = async () => {
    log('NOTIFIER: processNotificationQueue started');
    if (!connection) {
        log('NOTIFIER: Database is not connected. Skipping notification processing.');
        return;
    }
    try {
        await createNotificationQueueTable();
        const [rows] = await connection.execute(
            'SELECT * FROM notification_queue WHERE status = "pending" LIMIT 1'
        );
        log(`NOTIFIER: Fetched ${rows.length} pending notifications`);

        for (const job of rows) {
            log(`NOTIFIER: Processing job id: ${job.id}`);
            await connection.execute(
                'UPDATE notification_queue SET status = "processing" WHERE id = ?',
                [job.id]
            );

            try {
                if (job.type === 'email') {
                    await sendEmail(job.to_email, job.subject, job.body);
                } else if (job.type === 'discord') {
                    await sendDiscordNotification(job.body);
                }
                await connection.execute(
                    'UPDATE notification_queue SET status = "completed" WHERE id = ?',
                    [job.id]
                );
                log(`NOTIFIER: Job id: ${job.id} completed`);
            } catch (error) {
                await connection.execute(
                    'UPDATE notification_queue SET status = "failed" WHERE id = ?',
                    [job.id]
                );
                log(`NOTIFIER: Job id: ${job.id} failed: ${error.message}`, error);
            }
        }
    } catch (error) {
        log(`NOTIFIER: Error processing notification queue: ${error.message}`, error);
    }
};

const checkDbConnection = async () => {
    log('NOTIFIER: checkDbConnection called');
    if (!connection) {
        log('NOTIFIER: Database is not connected. Attempting to reconnect...');
        await initializeDbConnection();
    } else {
        log('NOTIFIER: Database is already connected.');
    }
};

// Initialize the database connection when the application starts
initializeDbConnection().then(() => {
    // Periodically check the queue for new jobs and the database connection
    interval = setInterval(async () => {
        await checkDbConnection();
        await processNotificationQueue();
    }, 5000); // Check every 5 seconds
});

// Ensure the database connection is closed when the application exits
process.on('exit', closeDbConnection);
process.on('SIGINT', closeDbConnection);
process.on('SIGTERM', closeDbConnection);

module.exports = { mail, notifyAdmins };