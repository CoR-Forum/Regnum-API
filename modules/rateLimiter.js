const rateLimit = require('express-rate-limit');

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

module.exports = { RateLimiter };