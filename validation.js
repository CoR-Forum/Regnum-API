const validator = require('validator');
const { pool } = require('./db'); // Import the pool from db.js

const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
    if (!username || typeof username !== 'string' || !usernameRegex.test(username)) {
        return { valid: false, message: 'Username must be a string between 3 and 20 characters, containing only letters and numbers.' };
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
    const nicknameRegex = /^[a-zA-Z0-9 ]{3,30}$/;
    const spaceCount = (nickname.match(/ /g) || []).length;
    if (nickname && (typeof nickname !== 'string' || !nicknameRegex.test(nickname) || spaceCount > 2)) {
        return { valid: false, message: 'Nickname must be a string between 3 and 30 characters, containing only letters, numbers, and up to 2 spaces.' };
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
