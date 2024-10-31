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

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const log = (message, error = null) => {
    const timestamp = new Date().toISOString();
    if (error) {
        console.error(`[${timestamp}] ${message}`, error);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
};

const createNotificationQueueTable = async (connection) => {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS notification_queue (
            id INT AUTO_INCREMENT PRIMARY KEY,
            to_email VARCHAR(255),
            subject VARCHAR(255),
            body TEXT,
            type ENUM('email', 'admin_email', 'discord_log', 'discord_feedback', 'discord_login') NOT NULL,
            status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    try {
        await connection.execute(createTableSQL);
        log('NOTIFIER: notification_queue table ensured');
    } catch (error) {
        log(`NOTIFIER: Error creating or updating notification_queue table: ${error.message}`, error);
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
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

const sendDiscordNotification = async (id, message, createdAt, type) => {
    let webhookUrl;
    switch (type) {
        case 'discord_feedback':
            webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
            break;
        case 'discord_login':
            webhookUrl = process.env.DISCORD_LOGIN_WEBHOOK_URL;
            break;
        case 'discord_log':
            webhookUrl = process.env.DISCORD_LOG_WEBHOOK_URL;
            break;
        default:
            log(`NOTIFIER: Unknown Discord notification type: ${type}`);
            throw new Error(`Unknown Discord notification type: ${type}`);
    }

    log(`NOTIFIER: sendDiscordNotification called with webhookUrl: ${webhookUrl}`);
    try {
        const embed = {
            title: `Notification ID: ${id}`,
            description: message,
            timestamp: createdAt,
            color: 3447003 // Blue color
        };

        await axios.post(webhookUrl, {
            embeds: [embed]
        });
        log('NOTIFIER: Discord notification sent');
    } catch (error) {
        log(`NOTIFIER: Error sending Discord notification: ${error.message}`, error);
        throw new Error(`Failed to send Discord notification: ${error.message}`);
    }
};

const queueNotification = async (to, subject, text, type) => {
    log(`NOTIFIER: queueNotification called with type: ${type}`);
    try {
        const connection = await pool.getConnection();
        await createNotificationQueueTable(connection);
        await connection.execute(
            'INSERT INTO notification_queue (to_email, subject, body, type) VALUES (?, ?, ?, ?)',
            [to, subject, text, type]
        );
        log(`NOTIFIER: ${type} notification queued successfully`);
        connection.release();
    } catch (error) {
        log(`NOTIFIER: Error queuing ${type} notification: ${error.message}`, error);
    }
};

const mail = async (to, subject, text) => {
    await queueNotification(to, subject, text, 'email');
};

const notifyAdmins = async (message, type) => {
    await queueNotification(null, null, message, type || 'discord_log');
};


const processNotificationQueue = async () => {
    log('NOTIFIER: processNotificationQueue started');
    try {
        const connection = await pool.getConnection();
        await createNotificationQueueTable(connection);
        const [rows] = await connection.execute(
            'SELECT * FROM notification_queue WHERE status = "pending" OR status = "failed" LIMIT 3'
        );
        log(`NOTIFIER: Fetched ${rows.length} pending notifications`);

        const processJob = async (job) => {
            log(`NOTIFIER: Processing job id: ${job.id}`);
            await connection.execute(
                'UPDATE notification_queue SET status = "processing" WHERE id = ?',
                [job.id]
            );

            try {
                if (job.type === 'email') {
                    await sendEmail(job.to_email, job.subject, job.body);
                    await notifyAdmins(`[Notification ID: ${job.id} (E-Mail)] Email sent to: ${job.to_email}: ${job.subject}`);
                    await connection.execute(
                        'UPDATE notification_queue SET status = "completed" WHERE id = ?',
                        [job.id]
                    );
                } else if (job.type.startsWith('discord')) {
                    await sendDiscordNotification(job.id, job.body, job.created_at, job.type);
                    await connection.execute(
                        'UPDATE notification_queue SET status = "completed" WHERE id = ?',
                        [job.id]
                    );
                }
                log(`NOTIFIER: Job id: ${job.id} completed`);
            } catch (error) {
                await connection.execute(
                    'UPDATE notification_queue SET status = "failed" WHERE id = ?',
                    [job.id]
                );
                log(`NOTIFIER: Job id: ${job.id} failed: ${error.message}`, error);
            }
        };

        await Promise.all(rows.map(processJob));
        connection.release();
    } catch (error) {
        log(`NOTIFIER: Error processing notification queue: ${error.message}`, error);
    }
};

const checkDbConnection = async () => {
    log('NOTIFIER: checkDbConnection called');
    try {
        const connection = await pool.getConnection();
        log('NOTIFIER: Database is connected.');
        connection.release();
    } catch (error) {
        log('NOTIFIER: Database is not connected. Attempting to reconnect...');
        await initializeDbConnection();
    }
};

// Initialize the database connection when the application starts
const initializeDbConnection = async () => {
    try {
        const connection = await pool.getConnection();
        await createNotificationQueueTable(connection);
        log('NOTIFIER: Database connection established');
        connection.release();
    } catch (error) {
        log(`NOTIFIER: Error establishing database connection: ${error.message}`, error);
    }
};

initializeDbConnection().then(() => {
    interval = setInterval(async () => {
        await checkDbConnection();
        await processNotificationQueue();
    }, 2000);
});

// Ensure the database connection is closed when the application exits
process.on('exit', async () => {
    if (interval) {
        clearInterval(interval);
        log('NOTIFIER: Interval cleared');
    }
    await pool.end();
    log('NOTIFIER: Database connection pool closed');
});
process.on('SIGINT', async () => {
    if (interval) {
        clearInterval(interval);
        log('NOTIFIER: Interval cleared');
    }
    await pool.end();
    log('NOTIFIER: Database connection pool closed');
});
process.on('SIGTERM', async () => {
    if (interval) {
        clearInterval(interval);
        log('NOTIFIER: Interval cleared');
    }
    await pool.end();
    log('NOTIFIER: Database connection pool closed');
});

module.exports = { mail, notifyAdmins };