// FILE: feedback.js

const express = require('express');
const { queryDb, logActivity } = require('../utils');
const { notifyAdmins } = require('../notificator');
const { validateSession } = require('../middleware'); // Import validateSession from middleware.js

const router = express.Router();

const initializeFeedbackTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS feedback (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(255) NOT NULL,
            user_id INT NOT NULL,
            feedback TEXT NOT NULL,
            log TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `;
    await queryDb(query);
    console.log("Feedback table initialized successfully.");
};

router.post(`${process.env.BASE_PATH}/feedback`, validateSession, async (req, res) => {
    const { type, feedback, log } = req.body;

    try {
        await queryDb('INSERT INTO feedback (type, user_id, feedback, log) VALUES (?, ?, ?, ?)', [type, req.session.userId, feedback, log]);

        logActivity(req.session.userId, 'feedback', 'Feedback submitted', req.ip);
        await notifyAdmins(`New feedback received from user: ${req.session.username}`, 'discord_feedback');

        res.json({ status: "success", message: "Feedback submitted successfully" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

module.exports = { router, initializeFeedbackTable };