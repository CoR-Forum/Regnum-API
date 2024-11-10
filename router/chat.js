const express = require('express');
const { validateToken } = require('../middleware');
const { PublicChat, User } = require('../models');
const { logActivity } = require('../utils');
const sanitizeHtml = require('sanitize-html');
const Joi = require('joi');
const helmet = require('helmet');
const { RateLimiter } = require('../modules/rateLimiter'); // Import the RateLimiter function

const router = express.Router();

// Apply Helmet middleware
router.use(helmet());

// Validation schema
const messageSchema = Joi.object({
    message: Joi.string().min(1).max(500).required()
});

router.post('/send', validateToken, RateLimiter(1, 5), async (req, res) => {
    const { error } = messageSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ status: "error", message: "Invalid message" });
    }

    const { message } = req.body;
    const { userId } = req.user;

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

router.get('/receive', validateToken, async (req, res) => {
    try {
        const messages = await PublicChat.find()
            .sort({ timestamp: -1 })
            .limit(50);

        const userIds = messages.map(message => message.user_id);
        const users = await User.find({ _id: { $in: userIds } });

        const userMap = users.reduce((acc, user) => {
            acc[user._id] = user.nickname;
            return acc;
        }, {});

        const formattedMessages = messages.map(({ _id, user_id, timestamp, message }) => ({
            id: _id,
            nickname: userMap[user_id],
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