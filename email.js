const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
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
            log(`MAILER: Retry attempt ${i + 1} failed: ${error.message}`, error);
            await sleep(delay);
        }
    }
    throw new Error('MAILER: Max retry attempts reached');
};

const log = (message, error = null) => {
    const timestamp = new Date().toISOString();
    if (error) {
        console.error(`[${timestamp}] ${message}`, error);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
};

const initializeDbConnection = async () => {
    try {
        connection = await retry(() => mysql.createConnection(dbConfig));
        log('MAILER: Database connection established');
    } catch (error) {
        log(`MAILER: Error establishing database connection: ${error.message}`, error);
    }
};

const closeDbConnection = async () => {
    if (connection) {
        try {
            await connection.end();
            log('MAILER: Database connection closed');
        } catch (error) {
            log(`MAILER: Error closing database connection: ${error.message}`, error);
        }
    }
    if (interval) {
        clearInterval(interval);
        log('MAILER: Interval cleared');
    }
};

const sendEmail = async (to, subject, text) => {
    log(`MAILER: sendEmail called with to: ${to}, subject: ${subject}`);
    try {
        let info = await transporter.sendMail({
            from: `"${process.env.EMAIL_NAME}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text
        });
        log(`MAILER: Message sent: ${info.messageId}`);
    } catch (error) {
        log(`MAILER: Error sending email: ${error.message}`, error);
    }
};

const mail = async (to, subject, text) => {
    log(`MAILER: mail called with to: ${to}, subject: ${subject}`);
    if (!connection) {
        log('MAILER: Database is not connected. Email not queued.');
        return;
    }
    try {
        await connection.execute(
            'INSERT INTO email_queue (to_email, subject, body) VALUES (?, ?, ?)',
            [to, subject, text]
        );
        log('MAILER: Email queued successfully');
    } catch (error) {
        log(`MAILER: Error queuing email: ${error.message}`, error);
    }
};

const processEmailQueue = async () => {
    log('MAILER: processEmailQueue started');
    if (!connection) {
        log('MAILER: Database is not connected. Skipping email processing.');
        return;
    }
    try {
        const [rows] = await connection.execute(
            'SELECT * FROM email_queue WHERE status = "pending" LIMIT 1'
        );
        log(`MAILER: Fetched ${rows.length} pending emails`);

        for (const job of rows) {
            log(`MAILER: Processing job id: ${job.id}`);
            await connection.execute(
                'UPDATE email_queue SET status = "processing" WHERE id = ?',
                [job.id]
            );

            try {
                await sendEmail(job.to_email, job.subject, job.body);
                await connection.execute(
                    'UPDATE email_queue SET status = "completed" WHERE id = ?',
                    [job.id]
                );
                log(`MAILER: Job id: ${job.id} completed`);
            } catch (error) {
                await connection.execute(
                    'UPDATE email_queue SET status = "failed" WHERE id = ?',
                    [job.id]
                );
                log(`MAILER: Job id: ${job.id} failed: ${error.message}`, error);
            }
        }
    } catch (error) {
        log(`MAILER: Error processing email queue: ${error.message}`, error);
    }
};

const checkDbConnection = async () => {
    log('MAILER: checkDbConnection called');
    if (!connection) {
        log('MAILER: Database is not connected. Attempting to reconnect...');
        await initializeDbConnection();
    } else {
        log('MAILER: Database is already connected.');
    }
};

// Initialize the database connection when the application starts
initializeDbConnection().then(() => {
    // Periodically check the queue for new jobs and the database connection
    interval = setInterval(async () => {
        await checkDbConnection();
        await processEmailQueue();
    }, 5000); // Check every 5 seconds
});

// Ensure the database connection is closed when the application exits
process.on('exit', closeDbConnection);
process.on('SIGINT', closeDbConnection);
process.on('SIGTERM', closeDbConnection);

module.exports = { mail };