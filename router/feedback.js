const express = require('express');
const { validateSession } = require('../middleware');
const { Feedback } = require('../models');
const { logActivity } = require('../utils');
const xss = require('xss');
const { RateLimiter } = require('../modules/rateLimiter');

const router = express.Router();

router.post('/feedback', RateLimiter(1, 3600), validateSession, async (req, res) => {
  const { type, message, logs } = req.body;

  if (!message) {
    return res.status(400).json({ status: "error", message: "Message is required" });
  }

  const sanitizedMessage = xss(message);
  const sanitizedLogs = logs ? xss(logs) : null;

  try {
    const feedback = new Feedback({
      user_id: req.session.userId,
      type,
      message: sanitizedMessage,
      logs: sanitizedLogs
    });

    await feedback.save();

    logActivity(req.session.userId, 'feedback_submit', 'Feedback submitted', req.ip);
    res.json({ status: "success", message: "Feedback submitted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

module.exports = router;