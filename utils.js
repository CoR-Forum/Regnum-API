const { ActivityLog, Token, User } = require('./models');
const { notifyAdmins } = require('./modules/notificator');
const jwt = require('jsonwebtoken');

const generateToken = async (user) => {
    await Token.deleteMany({ userId: user._id });
    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await new Token({ userId: user._id, token }).save();
    return token;
};

const logActivity = async (userId, activityType, description, ipAddress) => {
    try {
        const user = await User.findById(userId);
        const userIdentifier = user ? `${user.username} (${user.nickname || 'no nickname'} [${user._id})` : 'Unknown User';
        
        const activityLog = new ActivityLog({
            user_id: userId,
            activity_type: activityType,
            description,
            ip_address: ipAddress
        });
        await activityLog.save();
        notifyAdmins(`User activity: ${description}\nUser: ${userIdentifier}\nIP: ${ipAddress}`, 'discord_log');
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

const convertDurationToMilliseconds = (duration) => {
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);

    switch (unit) {
        case 'h':
            return value * 60 * 60 * 1000;
        case 'd':
            return value * 24 * 60 * 60 * 1000;
        case 'm':
            return value * 30 * 24 * 60 * 60 * 1000;
        case 'y':
            return value * 365 * 24 * 60 * 60 * 1000;
        default:
            throw new Error('Invalid duration format');
    }
};

module.exports = {
    logActivity,
    generateToken,
    convertDurationToMilliseconds
};