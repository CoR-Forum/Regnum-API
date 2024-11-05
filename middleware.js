const { User } = require('./models'); // Import Mongoose models

const validateSession = async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ message: "Invalid session" });

        if (user.activation_token) return res.status(403).json({ message: "Account not activated" });

        next();
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { validateSession };