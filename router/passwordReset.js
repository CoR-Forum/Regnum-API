const express = require('express');
const crypto = require('crypto');
const argon2 = require('argon2');
const { validateEmail, validatePassword } = require('../validation');
const { logActivity } = require('../utils');
const { mail } = require('../modules/notificator');
const { User, PasswordReset } = require('../models');
const { RateLimiter } = require('../modules/rateLimiter');

const router = express.Router();

const handleError = (res, status, message) => {
    res.status(status).json({ status: "error", message });
};

const handleSuccess = (res, message) => {
    res.json({ status: "success", message });
};

router.post('/reset-password', RateLimiter(3, 60), async (req, res) => {
    const { email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return handleError(res, 400, emailValidation.message);
    }

    try {
        const user = await User.findOne({ email });
        if (user) {
            const resetToken = crypto.randomBytes(64).toString('hex');
            const hashedToken = await argon2.hash(resetToken);
            const expiryDate = Date.now() + 3600000; // 1 hour expiry

            await PasswordReset.create({
                user_id: user._id,
                reset_token: hashedToken,
                expires_at: expiryDate
            });

            await mail(email, 'Reset your password', `Use the following token to reset your password: ${resetToken}`);

            logActivity(user._id, 'password_reset_request', 'Password reset requested', req.ip);
        }

        // Always return success message to avoid email enumeration
        handleSuccess(res, "If the email exists, a password reset token has been sent");
    } catch (error) {
        console.error(error);
        handleError(res, 500, "Internal server error");
    }
});

router.post('/reset-password/:token', RateLimiter(1, 60), async (req, res) => {
    const { password } = req.body;

    const passwordValidation = await validatePassword(password);
    if (!passwordValidation.valid) {
        return handleError(res, 400, passwordValidation.message);
    }

    try {
        const resetRecord = await PasswordReset.findOne({ reset_token: req.params.token, expires_at: { $gt: Date.now() } }).populate('user_id');
        if (!resetRecord) return handleError(res, 404, "Reset token not found or expired");

        const isTokenValid = await argon2.verify(resetRecord.reset_token, req.params.token);
        if (!isTokenValid) return handleError(res, 400, "Invalid reset token");

        const hashedPassword = await argon2.hash(password);
        const user = resetRecord.user_id;
        user.password = hashedPassword;
        await user.save();

        await PasswordReset.deleteOne({ _id: resetRecord._id });

        logActivity(user._id, 'password_reset', 'Password reset', req.ip);

        handleSuccess(res, "Password reset successfully");
    } catch (error) {
        console.error(error);
        handleError(res, 500, "Internal server error");
    }
});

module.exports = router;