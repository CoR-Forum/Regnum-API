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
    connectTimeout: 5000 // 5 seconds timeout
};

let connection;
let isDbConnected = false;

const initializeDbConnection = async () => {
    try {
        connection = await mysql.createConnection(dbConfig);
        isDbConnected = true;
        console.log('MAILER: Database connection established');
    } catch (error) {
        isDbConnected = false;
        console.error(`MAILER: Error establishing database connection: ${error.message}`, error);
    }
};

const closeDbConnection = async () => {
    if (connection) {
        try {
            await connection.end();
            isDbConnected = false;
            console.log('MAILER: Database connection closed');
        } catch (error) {
            console.error(`MAILER: Error closing database connection: ${error.message}`, error);
        }
    }
};

const sendEmail = async (to, subject, text) => {
    console.log(`MAILER: sendEmail called with to: ${to}, subject: ${subject}, text: ${text}`);
    try {
        let info = await transporter.sendMail({
            from: `"${process.env.EMAIL_NAME}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text
        });
        console.log(`MAILER: Message sent: ${info.messageId}`);
    } catch (error) {
        console.error(`MAILER: Error sending email: ${error.message}`, error);
    }
    console.log('MAILER: sendEmail finished');
};

const mail = async (to, subject, text) => {
    console.log(`MAILER: mail called with to: ${to}, subject: ${subject}, text: ${text}`);
    if (!isDbConnected) {
        console.error('MAILER: Database is not connected. Email not queued.');
        return;
    }
    try {
        await connection.execute(
            'INSERT INTO email_queue (to_email, subject, body) VALUES (?, ?, ?)',
            [to, subject, text]
        );
        console.log('MAILER: Email queued successfully');
    } catch (error) {
        console.error(`MAILER: Error queuing email: ${error.message}`, error);
    }
    console.log('MAILER: mail finished');
};

const processEmailQueue = async () => {
    console.log('MAILER: processEmailQueue started');
    if (!isDbConnected) {
        console.error('MAILER: Database is not connected. Skipping email processing.');
        return;
    }
    try {
        const [rows] = await connection.execute(
            'SELECT * FROM email_queue WHERE status = "pending" LIMIT 1'
        );
        console.log(`MAILER: Fetched ${rows.length} pending emails`);

        for (const job of rows) {
            console.log(`MAILER: Processing job id: ${job.id}`);
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
                console.log(`MAILER: Job id: ${job.id} completed`);
            } catch (error) {
                await connection.execute(
                    'UPDATE email_queue SET status = "failed" WHERE id = ?',
                    [job.id]
                );
                console.error(`MAILER: Job id: ${job.id} failed: ${error.message}`, error);
            }
        }
    } catch (error) {
        console.error(`MAILER: Error processing email queue: ${error.message}`, error);
    }
    console.log('MAILER: processEmailQueue finished');
};

const checkDbConnection = async () => {
    console.log('MAILER: checkDbConnection called');
    if (!isDbConnected) {
        console.log('MAILER: Database is not connected. Attempting to reconnect...');
        await initializeDbConnection();
    } else {
        console.log('MAILER: Database is already connected.');
    }
    console.log('MAILER: checkDbConnection finished');
};

// Initialize the database connection when the application starts
initializeDbConnection();

// Periodically check the queue for new jobs
setInterval(processEmailQueue, 5000); // Check every 5 seconds

// Periodically check the database connection
setInterval(checkDbConnection, 10000); // Check every 10 seconds

// Ensure the database connection is closed when the application exits
process.on('exit', closeDbConnection);
process.on('SIGINT', closeDbConnection);
process.on('SIGTERM', closeDbConnection);

module.exports = { mail };