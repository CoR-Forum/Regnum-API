const jwt = require('jsonwebtoken');
const { User, Token } = require('./models');

const validateToken = async (req, res, next) => {
    console.log("Headers:", req.headers); // Log all headers
    const token = req.headers['authorization'];
    console.log("Token:", token);
    if (!token) {
        return res.status(401).json({ status: "error", message: "Unauthorized: No token provided" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ status: "error", message: "Unauthorized: Invalid session" });
        }
        if (user.activation_token) {
            return res.status(403).json({ status: "error", message: "Forbidden: Account not activated" });
        }
        const tokenExists = await Token.findOne({ token });
        if (!tokenExists) {
            return res.status(401).json({ status: "error", message: "Unauthorized: Invalid token" });
        }
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            console.error("Error validating token:", error);
            return res.status(401).json({ status: "error", message: "Unauthorized: Invalid token" });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ status: "error", message: "Unauthorized: Token expired" });
        }
        console.error("Error validating token:", error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

const checkPermissions = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ status: "error", message: "Unauthorized: No user" });
        }
        if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
            return res.status(400).json({ status: "error", message: "Bad Request: Invalid permissions" });
        }
        const hasPermission = requiredPermissions.every(permission => req.user.permissions.includes(permission));
        if (!hasPermission) {
            return res.status(403).json({ status: "error", message: "Forbidden: Insufficient permissions" });
        }
        next();
    };
};

module.exports = { validateToken, checkPermissions };