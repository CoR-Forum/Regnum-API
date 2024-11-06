const { User } = require('./models'); // Import Mongoose models

const validateSession = async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ message: "Invalid session" });

        if (user.activation_token) return res.status(403).json({ message: "Account not activated" });

        req.user = user; // Attach user to request object
        next();
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

const checkPermissions = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const hasPermission = requiredPermissions.every(permission => req.user.permissions.includes(permission));
        if (!hasPermission) return res.status(403).json({ message: "Forbidden" });

        next();
    };
};

module.exports = { validateSession, checkPermissions };