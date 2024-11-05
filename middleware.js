// FILE: middleware.js

const { queryDb } = require('./utils');

const validateSession = async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const rows = await queryDb('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        if (rows.length === 0) return res.status(401).json({ message: "Invalid session" });

        const user = rows[0];
        if (user.activation_token) return res.status(403).json({ message: "Account not activated" });

        next();
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { validateSession };