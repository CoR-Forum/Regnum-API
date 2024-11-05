// FILE: models.js

const mongoose = require('mongoose');

// Define NotificationQueue model
const notificationQueueSchema = new mongoose.Schema({
    to_email: { type: String },
    subject: { type: String },
    body: { type: String },
    type: { type: String },
    status: { type: String, default: 'pending' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const NotificationQueue = mongoose.model('NotificationQueue', notificationQueueSchema);

// Define other models similarly
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    nickname: { type: String },
    activation_token: { type: String },
    pw_reset_token: { type: String },
    is_admin: { type: Boolean, default: false },
    shoutbox_banned: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false },
    last_activity: { type: Date },
    sylentx_features: { type: String },
    deleted: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// Define other models similarly
const userSettingsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    settings: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

const licenseSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    license_key: { type: String, unique: true },
    license_type: { type: String, enum: ['lifetime', 'minutely', 'hourly', 'daily', 'weekly', 'monthly', 'yearly'] },
    license_features: { type: String },
    created_at: { type: Date, default: Date.now },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activated_at: { type: Date },
    expires_at: { type: Date },
    updated_at: { type: Date, default: Date.now }
});

const License = mongoose.model('License', licenseSchema);

const memoryPointerSchema = new mongoose.Schema({
    feature: { type: String },
    address: { type: String },
    offsets: { type: String }
});

const MemoryPointer = mongoose.model('MemoryPointer', memoryPointerSchema);

const systemSchema = new mongoose.Schema({
    name: { type: String, enum: ['status', 'latest_version'], unique: true },
    value: { type: String },
    updated_at: { type: Date, default: Date.now }
});

const System = mongoose.model('System', systemSchema);

const activityLogSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activity_type: { type: String },
    description: { type: String },
    ip_address: { type: String },
    timestamp: { type: Date, default: Date.now }
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = {
    User,
    UserSettings,
    License,
    MemoryPointer,
    System,
    ActivityLog,
    NotificationQueue // Export NotificationQueue model
};