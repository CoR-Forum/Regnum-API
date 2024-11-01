// FILE: utils.js

const { pool } = require('./db'); // Import pool from db.js
const { notifyAdmins } = require('./notificator');

const queryDb = async (query, params) => {
    const db = await pool.getConnection();
    try {
        const [rows] = await db.query(query, params);
        return rows;
    } catch (error) {
        console.error("Database error:", error);
        throw error;
    } finally {
        db.release();
    }
};

const logActivity = async (userId, activityType, description, ipAddress) => {
    try {
        await queryDb('INSERT INTO activity_logs (user_id, activity_type, description, ip_address) VALUES (?, ?, ?, ?)', [userId, activityType, description, ipAddress]);
        notifyAdmins(`User activity: ${description}, User ID: ${userId}, IP: ${ipAddress}`, 'discord_log');
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

module.exports = {
    queryDb,
    logActivity
};