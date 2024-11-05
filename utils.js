const { ActivityLog } = require('./models'); // Import Mongoose models
const { notifyAdmins } = require('./notificator');

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
    logActivity
};