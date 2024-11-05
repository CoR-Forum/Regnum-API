const express = require('express');
const { logActivity } = require('../utils');
const { notifyAdmins } = require('../notificator');
const { validateSession } = require('../middleware');
const { Feedback } = require('../models'); // Import Mongoose models

const router = express.Router();

const initializeFeedbackTable = async () => {
    // No need to initialize table in MongoDB
    console.log("Feedback collection initialized successfully.");
};

router.post(`${process.env.BASE_PATH}/feedback`, validateSession, async (req, res) => {
    const { type, feedback, log } = req.body;

    try {
        const newFeedback = new Feedback({
            type,
            user_id: req.session.userId,
            feedback,
            log
        });
        await newFeedback.save();

        logActivity(req.session.userId, 'feedback', 'Feedback submitted', req.ip);
        await notifyAdmins(`New feedback received from user: ${req.session.username}`, 'discord_feedback');

        res.json({ status: "success", message: "Feedback submitted successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

module.exports = { router, initializeFeedbackTable };