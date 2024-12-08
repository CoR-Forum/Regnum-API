const express = require('express');
const crypto = require('crypto');
const argon2 = require('argon2');
const { validateEmail, validatePassword } = require('../validation');
const { logActivity } = require('../utils');
const { mail } = require('../modules/notificator');
const { User, PasswordReset } = require('../models');
const { RateLimiter } = require('../modules/rateLimiter');

const router = express.Router();

const handleError = (res, status, message) => res.status(status).json({ status: "error", message });
const handleSuccess = (res, message) => res.json({ status: "success", message });

const disableOldTokens = async (userId) => {
    await PasswordReset.updateMany({ user_id: userId, disabled: false }, { disabled: true });
};

const createResetToken = async (userId) => {
    const resetToken = crypto.randomBytes(16).toString('hex');
    const hashedToken = await argon2.hash(resetToken);
    const expiryDate = Date.now() + 3600000; // 1 hour expiry

    await PasswordReset.create({
        user_id: userId,
        reset_token: hashedToken,
        expires_at: expiryDate
    });

    return resetToken;
};

router.post('/reset-password', RateLimiter(3, 60), async (req, res) => {
    const { email } = req.body;
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) return handleError(res, 400, emailValidation.message);

    try {
        const user = await User.findOne({ email });
        if (user) {
            await disableOldTokens(user._id);
            const resetToken = await createResetToken(user._id);
            await mail(email, 'Reset your password for Sylent-X', `Hi ${user.username},\n\nUse the following token to reset your password: ${resetToken}\n\nIf you didn't request this, please ignore this email.`);
            logActivity(user._id, 'password_reset_request', 'Password reset requested', req.ip);
        }
        handleSuccess(res, "If the email exists, a password reset token has been sent");
    } catch (error) {
        console.error(error);
        handleError(res, 500, "Internal server error");
    }
});

router.post('/reset-password/:token', RateLimiter(1, 60), async (req, res) => {
    const { password } = req.body;
    const passwordValidation = await validatePassword(password);
    if (!passwordValidation.valid) return handleError(res, 400, passwordValidation.message);

    try {
        const resetRecord = await PasswordReset.findOne({ reset_token: req.params.token, expires_at: { $gt: Date.now() }, disabled: false }).populate('user_id');
        if (!resetRecord || resetRecord.used) {
            const user = resetRecord ? resetRecord.user_id : await User.findOne({ email: req.body.email });
            if (!user) return handleError(res, 404, "User not found");

            await disableOldTokens(user._id);
            const resetToken = await createResetToken(user._id);
            await mail(user.email, 'Reset your password', `Use the following token to reset your password: ${resetToken}`);
            logActivity(user._id, 'password_reset_request', 'Password reset requested', req.ip);
            return handleSuccess(res, "A new password reset token has been sent");
        }

        const isTokenValid = await argon2.verify(resetRecord.reset_token, req.params.token);
        if (!isTokenValid) return handleError(res, 400, "Invalid reset token");

        const hashedPassword = await argon2.hash(password);
        const user = resetRecord.user_id;
        user.password = hashedPassword;
        await user.save();

        resetRecord.used = true;
        resetRecord.used_at = new Date();
        await resetRecord.save();

        logActivity(user._id, 'password_reset', 'Password reset', req.ip);
        handleSuccess(res, "Password reset successfully");
    } catch (error) {
        console.error(error);
        handleError(res, 500, "Internal server error");
    }
});

module.exports = router;