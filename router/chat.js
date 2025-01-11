const express = require('express');
const { validateToken } = require('../middleware');
const { PublicChat } = require('../models');
const { logActivity } = require('../utils');
const sanitizeHtml = require('sanitize-html');
const Joi = require('joi');
const helmet = require('helmet');
const { RateLimiter } = require('../modules/rateLimiter');

const router = express.Router();

// Apply Helmet middleware
router.use(helmet());

// Validation schema
const messageSchema = Joi.object({
    message: Joi.string().min(1).max(500).required()
});

router.post('/send', validateToken, RateLimiter(1, 2), async (req, res) => {
    const { error } = messageSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ status: "error", message: "Invalid message" });
    }

    const { message } = req.body;
    console.log(req.body);
    const userId = req.user._id;

    const sanitizedMessage = sanitizeHtml(message);

    try {
        const newMessage = new PublicChat({ user_id: userId, message: sanitizedMessage });
        await newMessage.save();

        logActivity(userId, 'chat_message', 'Message sent', req.ip);
        res.json({ status: "success", message: "Message sent successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

router.get('/receive', async (req, res) => {
    try {
        const messages = await PublicChat.find({ deleted: false }) // Exclude deleted messages
            .sort({ timestamp: -1 })
            .limit(50)
            .populate('user_id', 'nickname');

        const formattedMessages = messages.map(({ _id, user_id, timestamp, message }) => ({
            id: _id,
            nickname: user_id.nickname,
            timestamp,
            message
        }));

        res.json({ status: "success", messages: formattedMessages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

module.exports = router;