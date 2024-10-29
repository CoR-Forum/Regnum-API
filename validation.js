// validation.js
const validator = require('validator');
const mysql = require('mysql2/promise');

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

const validateUsername = (username) => {
    if (!username || typeof username !== 'string' || username.length < 3 || username.length > 50) {
        return { valid: false, message: 'Username must be a string between 3 and 50 characters.' };
    }
    return { valid: true };
};

const validatePassword = (password) => {
    if (!password || typeof password !== 'string' || password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long.' };
    }
    return { valid: true };
};

const validateEmail = (email) => {
    if (!email || !validator.isEmail(email)) {
        return { valid: false, message: 'Invalid email address.' };
    }
    return { valid: true };
};

const validateNickname = (nickname) => {
    if (nickname && (typeof nickname !== 'string' || nickname.length > 50)) {
        return { valid: false, message: 'Nickname must be a string up to 50 characters.' };
    }
    return { valid: true };
};

const checkUsernameExists = async (username) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
        return { exists: true, message: 'Username already exists.' };
    }
    return { exists: false };
};

const checkEmailExists = async (email) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
        return { exists: true, message: 'Email already exists.' };
    }
    return { exists: false };
};

const checkNicknameExists = async (nickname) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE nickname = ?', [nickname]);
    if (rows.length > 0) {
        return { exists: true, message: 'Nickname already exists.' };
    }
    return { exists: false };
};

module.exports = {
    validateUsername,
    validatePassword,
    validateEmail,
    validateNickname,
    checkUsernameExists,
    checkEmailExists,
    checkNicknameExists
};