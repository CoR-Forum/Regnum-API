const { User } = require('./models');

const validateSession = async (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Unauthorized: No session ID" });
    }
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(401).json({ message: "Unauthorized: Invalid session" });
        }
        if (user.activation_token) {
            return res.status(403).json({ message: "Forbidden: Account not activated" });
        }
        req.user = user;
        next();
    } catch (error) {
        console.error("Error validating session:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const checkPermissions = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized: No user" });
        }
        if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
            return res.status(400).json({ message: "Bad Request: Invalid permissions" });
        }
        const hasPermission = requiredPermissions.every(permission => req.user.permissions.includes(permission));
        if (!hasPermission) {
            return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
        }
        next();
    };
};

module.exports = { validateSession, checkPermissions };