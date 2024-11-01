// FILE: register.js

const express = require('express');
const crypto = require('crypto');
const argon2 = require('argon2'); // Import the argon2 module
const { validateUsername, validatePassword, validateEmail, validateNickname, checkUsernameExists, checkEmailExists, checkNicknameExists } = require('./validation');
const { queryDb, logActivity } = require('./utils');
const { mail, notifyAdmins } = require('./notificator');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { username, nickname, password, email } = req.body;

    const usernameValidation = validateUsername(username);
    const passwordValidation = validatePassword(password);
    const emailValidation = validateEmail(email);
    const nicknameValidation = validateNickname(nickname);

    if (!usernameValidation.valid) {
        return res.status(400).json({ status: "error", message: usernameValidation.message });
    }
    if (!passwordValidation.valid) {
        return res.status(400).json({ status: "error", message: passwordValidation.message });
    }
    if (!emailValidation.valid) {
        return res.status(400).json({ status: "error", message: emailValidation.message });
    }
    if (!nicknameValidation.valid) {
        return res.status(400).json({ status: "error", message: nicknameValidation.message });
    }

    try {
        const usernameExists = await checkUsernameExists(username);
        const emailExists = await checkEmailExists(email);
        const nicknameExists = await checkNicknameExists(nickname);

        if (usernameExists.exists) {
            return res.status(400).json({ status: "error", message: usernameExists.message });
        }
        if (emailExists.exists) {
            return res.status(400).json({ status: "error", message: emailExists.message });
        }
        if (nicknameExists.exists) {
            return res.status(400).json({ status: "error", message: nicknameExists.message });
        }

        const activationToken = crypto.randomBytes(64).toString('hex');
        const hashedPassword = await argon2.hash(password); // Hash the password using argon2
        await queryDb('INSERT INTO users (username, nickname, password, email, activation_token) VALUES (?, ?, ?, ?, ?)', [username, nickname, hashedPassword, email, activationToken]);

        const activationLink = `${process.env.BASE_URL}:${process.env.PORT}${process.env.BASE_PATH}/activate/${activationToken}`;
        await mail(email, 'Activate your account', `Click here to activate your account: ${activationLink}`);

        const rows = await queryDb('SELECT * FROM users WHERE username = ?', [username]);
        logActivity(rows[0].id, 'registration', 'User registered', req.ip);

        notifyAdmins(`New user registered: ${username}, email: ${email}, nickname: ${nickname}, IP: ${req.ip}`);

        res.json({ status: "success", message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

router.get('/activate/:token', async (req, res) => {
    try {
        const rows = await queryDb('SELECT * FROM users WHERE activation_token = ?', [req.params.token]);
        if (rows.length === 0) return res.status(404).json({ status: "error", message: "Activation token not found" });

        await queryDb('UPDATE users SET activation_token = NULL WHERE activation_token = ?', [req.params.token]);
        logActivity(rows[0].id, 'account_activation', 'Account activated', req.ip);
        res.json({ status: "success", message: "Account activated successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

module.exports = router;