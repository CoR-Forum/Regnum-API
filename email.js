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
    try {
        let info = await transporter.sendMail({
            from: `"${process.env.EMAIL_NAME}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text
        });
        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

const mail = async (to, subject, text) => {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
        'INSERT INTO email_queue (to_email, subject, body) VALUES (?, ?, ?)',
        [to, subject, text]
    );
    await connection.end();
};

const processEmailQueue = async () => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            'SELECT * FROM email_queue WHERE status = "pending" LIMIT 1'
        );

        for (const job of rows) {
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
            } catch (error) {
                await connection.execute(
                    'UPDATE email_queue SET status = "failed" WHERE id = ?',
                    [job.id]
                );
            }
        }
    } catch (error) {
        console.error("Error processing email queue:", error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

// Periodically check the queue for new jobs
setInterval(processEmailQueue, 5000); // Check every 3 seconds

module.exports = { mail };