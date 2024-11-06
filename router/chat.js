const express = require('express');
const { validateSession } = require('../middleware');
const { PublicChat, User } = require('../models');
const { logActivity } = require('../utils');

const router = express.Router();

router.post('/send', validateSession, async (req, res) => {
    const { message } = req.body;
    const { userId } = req.session;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ status: "error", message: "Invalid message" });
    }

    try {
        const newMessage = new PublicChat({ user_id: userId, message });
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