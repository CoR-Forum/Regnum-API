const express = require('express');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: process.env.DB_CHARSET,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const sessionStore = new MySQLStore({}, pool);

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { secure: false } // Set to true if using HTTPS
}));

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendEmail(to, subject, text) {
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
}

async function getUserEmailById(userId) {
    const db = await pool.getConnection();
    try {
        const [rows] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
        return rows.length > 0 ? rows[0].email : null;
    } catch (error) {
        console.error("Error fetching user email:", error);
        return null;
    } finally {
        db.release();
    }
}

async function sendEmailToUser(userId, subject, text) {
    const email = await getUserEmailById(userId);
    if (email) await sendEmail(email, subject, text);
}

async function initializeDatabase() {
    const db = await pool.getConnection();
    try {
        const queries = [
            `CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(100) NOT NULL,
                nickname VARCHAR(50) DEFAULT NULL,
                activation_token VARCHAR(255) DEFAULT NULL,
                activated_at TIMESTAMP DEFAULT NULL,
                pw_reset_token VARCHAR(255) DEFAULT NULL,
                is_admin TINYINT(1) DEFAULT 0,
                shoutbox_banned TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login TIMESTAMP DEFAULT NULL,
                banned TINYINT(1) DEFAULT 0,
                last_activity TIMESTAMP DEFAULT NULL,
                deleted TINYINT(1) DEFAULT 0
            );`,
            `CREATE TABLE IF NOT EXISTS user_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                session_token VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_ip VARCHAR(50) DEFAULT NULL,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_ip VARCHAR(50) DEFAULT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );`,
            `CREATE TABLE IF NOT EXISTS licenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                license_key VARCHAR(255) NOT NULL UNIQUE,
                activated_by INT DEFAULT NULL,
                activated_at TIMESTAMP DEFAULT NULL,
                runtime VARCHAR(10) DEFAULT NULL,
                runtime_end TIMESTAMP DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP DEFAULT NULL,
                licensed_features TEXT,
                FOREIGN KEY (activated_by) REFERENCES users(id)
            );`,
            `CREATE TABLE IF NOT EXISTS memory_pointers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                feature VARCHAR(255) NOT NULL,
                address VARCHAR(255) NOT NULL,
                offsets TEXT
            );`,
            `CREATE TABLE IF NOT EXISTS shoutbox_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );`,
            `CREATE TABLE IF NOT EXISTS user_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                settings TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
            );`,
            `CREATE TABLE IF NOT EXISTS feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(255) NOT NULL,
                user_id int NOT NULL,
                feedback TEXT NOT NULL,
                log TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );`,
            `CREATE TABLE IF NOT EXISTS beta_registrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50),
                email VARCHAR(100) NOT NULL UNIQUE,
                discord_tag VARCHAR(50),
                email_verified TINYINT(1) DEFAULT 0,
                email_verification_token VARCHAR(255) DEFAULT NULL,
                ip_address VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name ENUM('status', 'latest_version') NOT NULL UNIQUE,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );`
        ];

        for (const query of queries) await db.query(query);

        console.log("Database and tables initialized successfully.");
    } catch (error) {
        console.error("Error initializing database:", error);
    } finally {
        db.release();
    }
}

const crypto = require('crypto');

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await pool.getConnection();
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (rows.length === 0) return res.status(401).json({ message: "Invalid username or password" });

        const user = rows[0];
        req.session.userId = user.id;
        req.session.username = user.username;

        const sessionToken = crypto.randomBytes(64).toString('hex');
        const createdIp = req.ip;

        await db.query('INSERT INTO user_sessions (user_id, session_token, created_ip, last_ip) VALUES (?, ?, ?, ?)', [user.id, sessionToken, createdIp, createdIp]);

        req.session.save(async err => {
            if (err) {
                console.error("Error saving session:", err);
                return res.status(500).json({ message: "Internal server error" });
            }

            // Send login notification email
            const loginNotificationText = `Hello ${user.username},\n\nYou have successfully logged in from IP address: ${createdIp}.\n\nIf this wasn't you, please contact support immediately.`;
            await sendEmail(user.email, 'Login Notification', loginNotificationText);

            res.json({ message: "Login successful", sessionToken, user: { id: user.id, username: user.username, nickname: user.nickname } });
        });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        db.release();
    }
});

app.get('/api/profile', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    res.json({ userId: req.session.userId, username: req.session.username });
});

app.get('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: "Error logging out" });
        }
        res.json({ message: "Logout successful" });
    });
});

app.get('/api', (req, res) => res.send('API is running'));

app.post('/api/register', async (req, res) => {
    const { username, nickname, password, email } = req.body;
    const db = await pool.getConnection();
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ? OR email = ? OR nickname = ?', [username, email, nickname]);
        if (rows.length > 0) return res.status(400).json({ message: "Username, nickname or email already exists" });

        const activationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await db.query('INSERT INTO users (username, nickname, password, email, activation_token) VALUES (?, ?, ?, ?, ?)', [username, nickname, password, email, activationToken]);

        const activationLink = `${process.env.BASE_URL}:${PORT}/api/activate/${activationToken}`;
        await sendEmail(email, 'Activate your account', `Click here to activate your account: ${activationLink}`);

        res.json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        db.release();
    }
});

app.get('/api/activate/:token', async (req, res) => {
    const db = await pool.getConnection();
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE activation_token = ?', [req.params.token]);
        if (rows.length === 0) return res.status(404).json({ message: "Activation token not found" });

        await db.query('UPDATE users SET activation_token = NULL, activated_at = CURRENT_TIMESTAMP WHERE activation_token = ?', [req.params.token]);
        res.json({ message: "Account activated successfully" });
    } catch (error) {
        console.error("Error activating account:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        db.release();
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { email } = req.body;
    const db = await pool.getConnection();
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(404).json({ message: "Email not found" });

        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await db.query('UPDATE users SET pw_reset_token = ? WHERE email = ?', [resetToken, email]);

        const resetLink = `${process.env.BASE_URL}:${PORT}/api/reset-password/${resetToken}`;
        await sendEmail(email, 'Reset your password', `Click here to reset your password: ${resetLink}`);

        res.json({ message: "Password reset link sent successfully" });
    } catch (error) {
        console.error("Error requesting password reset:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        db.release();
    }
});

app.post('/api/reset-password/:token', async (req, res) => {
    const { password } = req.body;
    const db = await pool.getConnection();
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE pw_reset_token = ?', [req.params.token]);
        if (rows.length === 0) return res.status(404).json({ message: "Reset token not found" });

        await db.query('UPDATE users SET password = ?, pw_reset_token = NULL WHERE pw_reset_token = ?', [password, req.params.token]);
        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        db.release();
    }
});

app.get('/api/status', async (req, res) => {
    const db = await pool.getConnection();
    try {
        const [rows] = await db.query('SELECT * FROM settings WHERE name = "status"');
        res.json(rows[0]);
    } catch (error) {
        console.error("Error fetching system status:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        db.release();
    }
});

initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
});