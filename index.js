// FILE: index.js

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { mail, notifyAdmins } = require('./notificator');
const { validateUsername, validatePassword, validateEmail, validateNickname, checkUsernameExists, checkEmailExists, checkNicknameExists } = require('./validation');
const { queryDb, logActivity } = require('./utils');
const { pool } = require('./db'); // Import pool from db.js
const registerRoutes = require('./register'); // Import register routes
const passwordResetRoutes = require('./passwordReset'); // Import password reset routes

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || '/api';

const sessionStore = new MySQLStore({}, pool);

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { secure: false }
}));

const initializeDatabase = async () => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(100) NOT NULL,
            nickname VARCHAR(50) DEFAULT NULL,
            activation_token VARCHAR(255) DEFAULT NULL,
            pw_reset_token VARCHAR(255) DEFAULT NULL,
            is_admin TINYINT(1) DEFAULT 0,
            shoutbox_banned TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            banned TINYINT(1) DEFAULT 0,
            last_activity TIMESTAMP DEFAULT NULL,
            sylentx_settings TEXT DEFAULT NULL,
            sylentx_features TEXT DEFAULT NULL,
            deleted TINYINT(1) DEFAULT 0
        );`,
        `CREATE TABLE IF NOT EXISTS memory_pointers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            feature VARCHAR(255) NOT NULL,
            address VARCHAR(255) NOT NULL,
            offsets TEXT
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
        `CREATE TABLE IF NOT EXISTS system (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name ENUM('status', 'latest_version') NOT NULL UNIQUE,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS sessions (
            session_id VARCHAR(128) NOT NULL PRIMARY KEY,
            expires INT(11) UNSIGNED NOT NULL,
            data TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            activity_type VARCHAR(50) NOT NULL,
            description TEXT,
            ip_address VARCHAR(45),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );`,
    ];

    for (const query of queries) await queryDb(query);
    console.log("Database and tables initialized successfully.");

    // Insert or update default memory pointers
    const defaultMemoryPointers = [
        { feature: 'zoom', address: '0x68FC54', offsets: '' }
    ];

    for (const pointer of defaultMemoryPointers) {
        const rows = await queryDb('SELECT * FROM memory_pointers WHERE feature = ?', [pointer.feature]);
        if (rows.length === 0) {
            await queryDb('INSERT INTO memory_pointers (feature, address, offsets) VALUES (?, ?, ?)', [pointer.feature, pointer.address, pointer.offsets]);
        } else {
            await queryDb('UPDATE memory_pointers SET address = ?, offsets = ? WHERE feature = ?', [pointer.address, pointer.offsets, pointer.feature]);
        }
    }
    console.log("Default memory pointers inserted successfully.");
};

const updateLastActivity = async (req, res, next) => {
    if (req.session.userId) {
        await queryDb('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?', [req.session.userId]);
    }
    next();
};

app.use(updateLastActivity);

const validateSession = async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const rows = await queryDb('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        if (rows.length === 0) return res.status(401).json({ message: "Invalid session" });

        const user = rows[0];
        if (user.activation_token) return res.status(403).json({ message: "Account not activated" });

        next();
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

app.use(`${BASE_PATH}`, registerRoutes); // Use register routes
app.use(`${BASE_PATH}`, passwordResetRoutes); // Use password reset routes

app.post(`${BASE_PATH}/login`, async (req, res) => {
    console.log("Login request from:", req.ip);
    const { username, password } = req.body;

    const usernameValidation = validateUsername(username);
    const passwordValidation = validatePassword(password);

    if (!usernameValidation.valid) {
        return res.status(400).json({ status: "error", message: usernameValidation.message });
    }
    if (!passwordValidation.valid) {
        return res.status(400).json({ status: "error", message: passwordValidation.message });
    }

    try {
        const rows = await queryDb('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (rows.length === 0) return res.status(401).json({ status: "error", message: "Invalid username or password" });

        const user = rows[0];
        if (user.activation_token) return res.status(403).json({ status: "error", message: "Account not activated" });

        req.session.userId = user.id;
        req.session.username = user.username;

        req.session.save(async err => {
            if (err) return res.status(500).json({ status: "error", message: "Internal server error" });

            const loginNotificationText = `Hello ${user.username},\n\nYou have successfully logged in from IP address: ${req.ip}.\n\nIf this wasn't you, please contact support immediately.`;
            await mail(user.email, 'Login Notification', loginNotificationText);

            logActivity(user.id, 'login', 'User logged in', req.ip);

            notifyAdmins(`User logged in: ${user.username}, IP: ${req.ip}, Email: ${user.email}, Nickname: ${user.nickname}`, 'discord_login');

            // Fetch memory pointers for available sylentx_features
            const features = user.sylentx_features ? user.sylentx_features.split(',') : [];
            const memoryPointers = {};
            for (const feature of features) {
                const pointerRows = await queryDb('SELECT * FROM memory_pointers WHERE feature = ?', [feature]);
                if (pointerRows.length > 0) {
                    memoryPointers[feature] = pointerRows[0];
                }
            }

            res.json({
                status: "success",
                message: "Login successful",
                user: {
                    id: user.id,
                    username: user.username,
                    nickname: user.nickname,
                    settings: user.sylentx_settings,
                    features: user.sylentx_features, // Added sylentx_features here
                    pointers: memoryPointers
                }
            });
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

app.post(`${BASE_PATH}/logout`, validateSession, (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ status: "error", message: "Error logging out" });
        notifyAdmins(`User logged out: ${req.session.username}, IP: ${req.ip}`);
        res.json({ status: "success", message: "Logout successful" });
    });
});

app.get(`${BASE_PATH}`, (req, res) => res.send('API is running'));

app.put(`${BASE_PATH}/save-settings`, validateSession, async (req, res) => {
    const { settings } = req.body;

    try {
        await queryDb('UPDATE users SET sylentx_settings = ? WHERE id = ?', [settings, req.session.userId]);
        logActivity(req.session.userId, 'settings_save', 'Settings saved', req.ip);
        res.json({ status: "success", message: "Settings saved successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

app.post(`${BASE_PATH}/feedback`, validateSession, async (req, res) => {
    const { type, feedback, log } = req.body;

    try {
        await queryDb('INSERT INTO feedback (type, user_id, feedback, log) VALUES (?, ?, ?, ?)', [type, req.session.userId, feedback, log]);

        logActivity(req.session.userId, 'feedback', 'Feedback submitted', req.ip);
        await notifyAdmins(`New feedback received from user: ${req.session.username}`);

        res.json({ status: "success", message: "Feedback submitted successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

initializeDatabase().then(() => {
    const server = app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
        notifyAdmins(`API server started at port ${PORT}`);
    });

    const gracefulShutdown = () => {
        console.log('Shutting down gracefully...');
        server.close(async () => {
            console.log('HTTP server closed.');
            await pool.end();
            console.log('Database connection pool closed.');
            process.exit(0);
        });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
});