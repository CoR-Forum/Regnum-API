require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const crypto = require('crypto');
const { mail } = require('./email');
const { validateUsername, validatePassword, validateEmail, validateNickname, checkUsernameExists, checkEmailExists, checkNicknameExists } = require('./validation');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || '/api';

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: process.env.DB_CHARSET,
    waitForConnections: true,
    connectionLimit: process.env.DB_CONN_LIMIT || 10,
    queueLimit: process.env.DB_QUE_LIMIT || 0
});

const sessionStore = new MySQLStore({}, pool);

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { secure: false }
}));

const queryDb = async (query, params) => {
    const db = await pool.getConnection();
    try {
        const [rows] = await db.query(query, params);
        return rows;
    } catch (error) {
        console.error("Database error:", error);
        throw error;
    } finally {
        db.release();
    }
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
};

const logActivity = async (userId, activityType, description, ipAddress) => {
    try {
        await queryDb('INSERT INTO activity_logs (user_id, activity_type, description, ip_address) VALUES (?, ?, ?, ?)', [userId, activityType, description, ipAddress]);
    } catch (error) {
        console.error("Error logging activity:", error);
    }
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

app.post(`${BASE_PATH}/login`, async (req, res) => {
    const { username, password } = req.body;

    const usernameValidation = validateUsername(username);
    const passwordValidation = validatePassword(password);

    if (!usernameValidation.valid) {
        return res.status(400).json({ message: usernameValidation.message });
    }
    if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
    }

    try {
        const rows = await queryDb('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (rows.length === 0) return res.status(401).json({ message: "Invalid username or password" });

        const user = rows[0];
        if (user.activation_token) return res.status(403).json({ message: "Account not activated" });

        req.session.userId = user.id;
        req.session.username = user.username;

        req.session.save(async err => {
            if (err) return res.status(500).json({ message: "Internal server error" });

            const loginNotificationText = `Hello ${user.username},\n\nYou have successfully logged in from IP address: ${req.ip}.\n\nIf this wasn't you, please contact support immediately.`;
            await mail(user.email, 'Login Notification', loginNotificationText);

            logActivity(user.id, 'login', 'User logged in', req.ip);

            res.json({
                message: "Login successful",
                user: {
                    id: user.id,
                    username: user.username,
                    nickname: user.nickname,
                    settings: user.sylentx_settings
                }
            });
        });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get(`${BASE_PATH}/profile`, validateSession, (req, res) => {
    res.json({ userId: req.session.userId, username: req.session.username, nickname: req.session.nickname });
});

app.get(`${BASE_PATH}/logout`, validateSession, (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: "Error logging out" });
        res.json({ message: "Logout successful" });
    });
});

app.get(`${BASE_PATH}`, (req, res) => res.send('API is running'));

app.post(`${BASE_PATH}/register`, async (req, res) => {
    const { username, nickname, password, email } = req.body;

    const usernameValidation = validateUsername(username);
    const passwordValidation = validatePassword(password);
    const emailValidation = validateEmail(email);
    const nicknameValidation = validateNickname(nickname);

    if (!usernameValidation.valid) {
        return res.status(400).json({ message: usernameValidation.message });
    }
    if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
    }
    if (!emailValidation.valid) {
        return res.status(400).json({ message: emailValidation.message });
    }
    if (!nicknameValidation.valid) {
        return res.status(400).json({ message: nicknameValidation.message });
    }

    try {
        const usernameExists = await checkUsernameExists(username);
        const emailExists = await checkEmailExists(email);
        const nicknameExists = await checkNicknameExists(nickname);

        if (usernameExists.exists) {
            return res.status(400).json({ message: usernameExists.message });
        }
        if (emailExists.exists) {
            return res.status(400).json({ message: emailExists.message });
        }
        if (nicknameExists.exists) {
            return res.status(400).json({ message: nicknameExists.message });
        }

        const activationToken = crypto.randomBytes(64).toString('hex');
        await queryDb('INSERT INTO users (username, nickname, password, email, activation_token) VALUES (?, ?, ?, ?, ?)', [username, nickname, password, email, activationToken]);

        const activationLink = `${process.env.BASE_URL}:${PORT}${BASE_PATH}/activate/${activationToken}`;
        await mail(email, 'Activate your account', `Click here to activate your account: ${activationLink}`);

        const rows = await queryDb('SELECT * FROM users WHERE username = ?', [username]);
        logActivity(rows[0].id, 'registration', 'User registered', req.ip);

        res.json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get(`${BASE_PATH}/activate/:token`, async (req, res) => {
    try {
        const rows = await queryDb('SELECT * FROM users WHERE activation_token = ?', [req.params.token]);
        if (rows.length === 0) return res.status(404).json({ message: "Activation token not found" });

        await queryDb('UPDATE users SET activation_token = NULL WHERE activation_token = ?', [req.params.token]);
        res.json({ message: "Account activated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post(`${BASE_PATH}/reset-password`, async (req, res) => {
    const { email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return res.status(400).json({ message: emailValidation.message });
    }

    try {
        const rows = await queryDb('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(404).json({ message: "Email not found" });

        const resetToken = crypto.randomBytes(64).toString('hex');
        await queryDb('UPDATE users SET pw_reset_token = ? WHERE email = ?', [resetToken, email]);

        const resetLink = `${process.env.BASE_URL}:${PORT}${BASE_PATH}/reset-password/${resetToken}`;
        await mail(email, 'Reset your password', `Click here to reset your password: ${resetLink}`);

        logActivity(rows[0].id, 'password_reset_request', 'Password reset requested', req.ip);

        res.json({ message: "Password reset link sent successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post(`${BASE_PATH}/reset-password/:token`, async (req, res) => {
    const { password } = req.body;

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
    }

    try {
        const rows = await queryDb('SELECT * FROM users WHERE pw_reset_token = ?', [req.params.token]);
        if (rows.length === 0) return res.status(404).json({ message: "Reset token not found" });

        await queryDb('UPDATE users SET password = ?, pw_reset_token = NULL WHERE pw_reset_token = ?', [password, req.params.token]);

        logActivity(rows[0].id, 'password_reset', 'Password reset', req.ip);

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.put(`${BASE_PATH}/save-settings`, validateSession, async (req, res) => {
    const { settings } = req.body;

    try {
        await queryDb('UPDATE users SET sylentx_settings = ? WHERE id = ?', [settings, req.session.userId]);
        res.json({ message: "Settings saved successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post(`${BASE_PATH}/feedback`, validateSession, async (req, res) => {
    const { type, feedback, log } = req.body;

    try {
        await queryDb('INSERT INTO feedback (type, user_id, feedback, log) VALUES (?, ?, ?, ?)', [type, req.session.userId, feedback, log]);

        logActivity(req.session.userId, 'feedback', 'Feedback submitted', req.ip);

        res.json({ message: "Feedback submitted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

initializeDatabase().then(() => {
    const server = app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
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