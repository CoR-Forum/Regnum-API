const express = require('express');
const crypto = require('crypto');
const argon2 = require('argon2');
const { validateEmail, validatePassword } = require('../validation');
const { logActivity } = require('../utils');
const { mail } = require('../notificator');
const { User } = require('../models'); // Import Mongoose models

const router = express.Router();

router.post('/reset-password', async (req, res) => {
    const { email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return res.status(400).json({ status: "error", message: emailValidation.message });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ status: "error", message: "Email not found" });

        const resetToken = crypto.randomBytes(64).toString('hex');
        user.pw_reset_token = resetToken;
        await user.save();

        await mail(email, 'Reset your password', `Use the following token to reset your password: ${resetToken}`);

        logActivity(user._id, 'password_reset_request', 'Password reset requested', req.ip);

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
        const user = await User.findOne({ pw_reset_token: req.params.token });
        if (!user) return res.status(404).json({ status: "error", message: "Reset token not found" });

        const hashedPassword = await argon2.hash(password);
        user.password = hashedPassword;
        user.pw_reset_token = null;
        await user.save();

        logActivity(user._id, 'password_reset', 'Password reset', req.ip);

        res.json({ status: "success", message: "Password reset successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

module.exports = router;