const express = require('express');
const crypto = require('crypto');
const argon2 = require('argon2');
const { validateEmail, validatePassword } = require('../validation');
const { logActivity } = require('../utils');
const { mail } = require('../notificator');
const { User } = require('../models'); // Import Mongoose models

const router = express.Router();

const handleError = (res, status, message) => {
    res.status(status).json({ status: "error", message });
};

const handleSuccess = (res, message) => {
    res.json({ status: "success", message });
};

router.post('/reset-password', async (req, res) => {
    const { email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return handleError(res, 400, emailValidation.message);
    }

    try {
        const user = await User.findOne({ email });
        if (!user) return handleError(res, 404, "Email not found");

        const resetToken = crypto.randomBytes(64).toString('hex');
        user.pw_reset_token = resetToken;
        await user.save();

        await mail(email, 'Reset your password', `Use the following token to reset your password: ${resetToken}`);

        logActivity(user._id, 'password_reset_request', 'Password reset requested', req.ip);

        handleSuccess(res, "Password reset token sent successfully");
    } catch (error) {
        handleError(res, 500, "Internal server error");
    }
});

router.post('/reset-password/:token', async (req, res) => {
    const { password } = req.body;

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return handleError(res, 400, passwordValidation.message);
    }

    try {
        const user = await User.findOne({ pw_reset_token: req.params.token });
        if (!user) return handleError(res, 404, "Reset token not found");

        const hashedPassword = await argon2.hash(password);
        user.password = hashedPassword;
        user.pw_reset_token = null;
        await user.save();

        logActivity(user._id, 'password_reset', 'Password reset', req.ip);

        handleSuccess(res, "Password reset successfully");
    } catch (error) {
        handleError(res, 500, "Internal server error");
    }
});

module.exports = router;