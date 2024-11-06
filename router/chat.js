const express = require('express');
const { validateSession } = require('../middleware');
const { PublicChat, User } = require('../models');
const { logActivity } = require('../utils');
const sanitizeHtml = require('sanitize-html');
const Joi = require('joi');
const helmet = require('helmet');

const router = express.Router();

// Apply Helmet middleware
router.use(helmet());

// Validation schema
const messageSchema = Joi.object({
    message: Joi.string().min(1).max(500).required()
});

router.post('/send', validateSession, async (req, res) => {
    const { error } = messageSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ status: "error", message: "Invalid message" });
    }

    const { message } = req.body;
    const { userId } = req.session;

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

router.get('/receive', validateSession, async (req, res) => {
    try {
        const messages = await PublicChat.find()
            .populate('user_id', 'nickname')
            .sort({ timestamp: -1 })
            .limit(50);

        const formattedMessages = messages.map(({ _id, user_id, timestamp, message }) => ({
            id: _id,
            nickname: user_id.nickname,
            timestamp,
            message
        }));

        res.json({ status: "success", messages: formattedMessages });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

module.exports = router;