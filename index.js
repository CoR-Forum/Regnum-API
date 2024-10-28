const express = require('express');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Database configuration
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

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Function to send email
async function sendEmail(to, subject, text) {
  try {
    let info = await transporter.sendMail({
      from: `"Your App Name" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    });
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

// Function to get user email by ID
async function getUserEmailById(userId) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT email FROM users WHERE id = ?', [userId]);
    return rows.length > 0 ? rows[0].email : null;
  } catch (error) {
    console.error("Error fetching user email:", error);
    return null;
  } finally {
    connection.release();
  }
}

// Function to send email to user by ID
async function sendEmailToUser(userId, subject, text) {
  const email = await getUserEmailById(userId);
  if (email) {
    await sendEmail(email, subject, text);
  }
}

// Database initialization
async function initializeDatabase() {
  const connection = await pool.getConnection();
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
        is_active TINYINT(1) DEFAULT 0,
        is_admin TINYINT(1) DEFAULT 0,
        shoutbox_banned TINYINT(1) DEFAULT 0,
        shoutbox_banned_at TIMESTAMP DEFAULT NULL,
        shoutbox_banned_by INT DEFAULT NULL,
        shoutbox_banned_reason TEXT DEFAULT NULL,
        shoutbox_banned_until TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT NULL,
        banned TINYINT(1) DEFAULT 0,
        banned_at TIMESTAMP DEFAULT NULL,
        banned_by INT DEFAULT NULL,
        banned_reason TEXT DEFAULT NULL,
        banned_until TIMESTAMP DEFAULT NULL,
        last_activity TIMESTAMP DEFAULT NULL,
        deleted TINYINT(1) DEFAULT 0
      );`,
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP DEFAULT NULL,
        disabled_at TIMESTAMP DEFAULT NULL,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP DEFAULT NULL,
        deleted_by INT DEFAULT NULL,
        seen_by TEXT DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS shoutbox_private_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        recipient_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (recipient_id) REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS user_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        settings TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
      );`,
      `CREATE TABLE IF NOT EXISTS magnat (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount INT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT magnat_currency_user_id_unique UNIQUE (user_id)
      );`,
      `CREATE TABLE IF NOT EXISTS magnat_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        magnat_id INT NOT NULL,
        amount INT NOT NULL,
        type VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (magnat_id) REFERENCES magnat(id)
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

    for (const query of queries) {
      await connection.query(query);
    }

    console.log("Database and tables initialized successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
  } finally {
    connection.release();
  }
}

// Routes
app.get('/api', (req, res) => {
  res.send('API is running');
});

// Register user and send activation email
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "Username, email, and password are required" });
  }

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM users WHERE username = ? OR email = ?', [username, email]);
    if (rows[0].count > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const activationToken = Math.random().toString(36).substr(2, 10);
    await connection.query('INSERT INTO users (username, email, password, activation_token) VALUES (?, ?, ?, ?)', [username, email, password, activationToken]);

    await sendEmail(email, 'Activate your account', `Please click on the following link to activate your account: http://localhost:${PORT}/api/activate/${activationToken}`);
    res.json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    connection.release();
  }
});

// Activate user account
app.get('/api/activate/:token', async (req, res) => {
  const { token } = req.params;

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT * FROM users WHERE activation_token = ?', [token]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Invalid activation token" });
    }

    await connection.query('UPDATE users SET activation_token = NULL, activated_at = CURRENT_TIMESTAMP, is_active = 1 WHERE activation_token = ?', [token]);
    await sendEmailToUser(rows[0].id, 'Account activated', 'Your account has been activated successfully');
    res.json({ message: "Account activated successfully" });
  } catch (error) {
    console.error("Error activating account:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    connection.release();
  }
});

// Retrieve current system status
app.get('/api/status', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT * FROM settings WHERE name = "status"');
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching system status:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    connection.release();
  }
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}: http://localhost:${PORT}`);
  });
});