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

const sendEmail = async (to, subject, text) => {
    console.log(`sendEmail called with to: ${to}, subject: ${subject}, text: ${text}`);
    try {
        let info = await transporter.sendMail({
            from: `"${process.env.EMAIL_NAME}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text
        });
        console.log(`Message sent: ${info.messageId}`);
    } catch (error) {
        console.error(`Error sending email: ${error.message}`, error);
    }
    console.log('sendEmail finished');
};

const mail = async (to, subject, text) => {
    console.log(`mail called with to: ${to}, subject: ${subject}, text: ${text}`);
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Database connection established');
        await connection.execute(
            'INSERT INTO email_queue (to_email, subject, body) VALUES (?, ?, ?)',
            [to, subject, text]
        );
        console.log('Email queued successfully');
    } catch (error) {
        console.error(`Error queuing email: ${error.message}`, error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed');
        }
    }
    console.log('mail finished');
};

const processEmailQueue = async () => {
    console.log('processEmailQueue started');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Database connection established');
        const [rows] = await connection.execute(
            'SELECT * FROM email_queue WHERE status = "pending" LIMIT 1'
        );
        console.log(`Fetched ${rows.length} pending emails`);

        for (const job of rows) {
            console.log(`Processing job id: ${job.id}`);
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
                console.log(`Job id: ${job.id} completed`);
            } catch (error) {
                await connection.execute(
                    'UPDATE email_queue SET status = "failed" WHERE id = ?',
                    [job.id]
                );
                console.error(`Job id: ${job.id} failed: ${error.message}`, error);
            }
        }
    } catch (error) {
        console.error(`Error processing email queue: ${error.message}`, error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed');
        }
    }
    console.log('processEmailQueue finished');
};

// Periodically check the queue for new jobs
setInterval(processEmailQueue, 5000); // Check every 5 seconds

module.exports = { mail };