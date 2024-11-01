// FILE: passwordReset.js

const express = require('express');
const crypto = require('crypto');
const argon2 = require('argon2'); // Import the argon2 module
const { validateEmail, validatePassword } = require('./validation');
const { queryDb, logActivity } = require('./utils');
const { mail } = require('./notificator');

const router = express.Router();

router.post('/reset-password', async (req, res) => {
    const { email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return res.status(400).json({ status: "error", message: emailValidation.message });
    }

    try {
        const rows = await queryDb('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(404).json({ status: "error", message: "Email not found" });

        const resetToken = crypto.randomBytes(64).toString('hex');
        await queryDb('UPDATE users SET pw_reset_token = ? WHERE email = ?', [resetToken, email]);

        await mail(email, 'Reset your password', `Use the following token to reset your password: ${resetToken}`);

        logActivity(rows[0].id, 'password_reset_request', 'Password reset requested', req.ip);

        res.json({ status: "success", message: "Password reset token sent successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

router.post('/reset-password/:token', async (req, res) => {
    const { password } = req.body;

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return res.status(400).json({ status: "error", message: passwordValidation.message });
    }

    try {
        const rows = await queryDb('SELECT * FROM users WHERE pw_reset_token = ?', [req.params.token]);
        if (rows.length === 0) return res.status(404).json({ status: "error", message: "Reset token not found" });

        const hashedPassword = await argon2.hash(password); // Hash the password using argon2
        await queryDb('UPDATE users SET password = ?, pw_reset_token = NULL WHERE pw_reset_token = ?', [hashedPassword, req.params.token]);

        logActivity(rows[0].id, 'password_reset', 'Password reset', req.ip);

        res.json({ status: "success", message: "Password reset successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

module.exports = router;