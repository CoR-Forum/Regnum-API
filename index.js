const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const crypto = require('crypto');
const argon2 = require('argon2');
const { mail, notifyAdmins } = require('./notificator');
const { validateUsername, validatePassword } = require('./validation');
const { queryDb, logActivity } = require('./utils');
const { pool } = require('./db');
const registerRoutes = require('./register');
const passwordResetRoutes = require('./passwordReset');
const feedbackRoutes = require('./feedback');
const authRoutes = require('./auth'); // Add this line
const { validateSession } = require('./middleware'); // Import validateSession from middleware.js

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

const hashPassword = async (password) => {
    return await argon2.hash(password); // Hash the password using argon2
};

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
        `CREATE TABLE IF NOT EXISTS licenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            license_key VARCHAR(255) NOT NULL UNIQUE,
            license_type ENUM('lifetime', 'minutely', 'hourly', 'daily', 'weekly', 'monthly', 'yearly') NOT NULL,
            license_features TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INT DEFAULT NULL,
            activated_at TIMESTAMP DEFAULT NULL,
            expires_at TIMESTAMP DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
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
    console.log("Default memory pointers inserted or updated successfully.");
};

const updateLastActivity = async (req, res, next) => {
    if (req.session.userId) {
        await queryDb('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?', [req.session.userId]);
    }
    next();
};

app.use(updateLastActivity);

app.use(`${BASE_PATH}`, registerRoutes);
app.use(`${BASE_PATH}`, passwordResetRoutes);
app.use(`${BASE_PATH}`, feedbackRoutes);
app.use(`${BASE_PATH}`, authRoutes); // Add this line

app.post(`${BASE_PATH}/login`, async (req, res) => {
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
        const rows = await queryDb('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ status: "error", message: "Invalid username or password" });

        const user = rows[0];
        const passwordMatch = await argon2.verify(user.password, password); // Verify the password using argon2
        if (!passwordMatch) return res.status(401).json({ status: "error", message: "Invalid username or password" });

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
                    features: user.sylentx_features,
                    pointers: memoryPointers
                }
            });
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

app.get(`${BASE_PATH}`, (req, res) => res.redirect(`${BASE_PATH}/status`));

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