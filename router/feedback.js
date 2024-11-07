const express = require('express');
const { validateSession } = require('../middleware');
const { Feedback } = require('../models');
const { logActivity } = require('../utils');
const rateLimit = require('express-rate-limit');
const xss = require('xss');

const router = express.Router();

// Custom rate limiter function
const RateLimiter = (maxRequests, windowSeconds) => {
    console.log(`RateLimiter called with windowSeconds: ${windowSeconds}`); // Log the windowSeconds value
    return rateLimit({
        windowMs: windowSeconds * 1000, // Convert seconds to milliseconds
        max: maxRequests, // Limit each IP to maxRequests per windowMs
        handler: (req, res) => {
            const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
            res.status(429).json({ status: "error", message: `Too many requests, please try again later.`, cooldown: retryAfter });
        }
    });
};

router.post('/feedback', RateLimiter(1, 3600), validateSession, async (req, res) => {
  const { type, message, logs } = req.body;

  if (!message) {
    return res.status(400).json({ status: "error", message: "Message is required" });
  }

  // Sanitize input
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
    console.error(error); // Log the error for debugging
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

module.exports = router;