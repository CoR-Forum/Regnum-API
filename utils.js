const { ActivityLog, Token } = require('./models'); // Import Mongoose models
const { notifyAdmins } = require('./notificator');
const jwt = require('jsonwebtoken');

const generateToken = async (user) => {
    await Token.deleteMany({ userId: user._id });
    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await new Token({ userId: user._id, token }).save();
  
    return token;
  };

const logActivity = async (userId, activityType, description, ipAddress) => {
    try {
        const activityLog = new ActivityLog({
            user_id: userId,
            activity_type: activityType,
            description,
            ip_address: ipAddress
        });
        await activityLog.save();
        notifyAdmins(`User activity: ${description}, User ID: ${userId}, IP: ${ipAddress}`, 'discord_log');
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

module.exports = {
    logActivity,
    generateToken
};