const mongoose = require('mongoose');

const notificationQueueSchema = new mongoose.Schema({
    to_email: { type: String },
    subject: { type: String },
    body: { type: String },
    type: { type: String },
    status: { type: String, default: 'pending' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    logs: [{
        date: { type: Date, default: Date.now },
        type: { type: String },
        message: { type: String }
    }]
});

const NotificationQueue = mongoose.model('NotificationQueue', notificationQueueSchema);

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: false },
    email: { type: String, required: true, unique: true, lowercase: true },
    nickname: { type: String },
    activation_token: { type: String },
    permissions: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false },
    last_activity: { type: Date },
    deleted: { type: Boolean, default: false },
    woltlab_userID: { type: String }
});

const User = mongoose.model('User', userSchema);

const bannedUserSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String },
    banned_by: { type: String },
    banned_at: { type: Date, default: Date.now },
    expires_at: { type: Date },
    active: { type: Boolean, default: true }
});

const BannedUser = mongoose.model('BannedUser', bannedUserSchema);

const licensesSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    activated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activated_at: { type: Date },
    features: [{ type: String, required: true }],
    runtime: { type: String },
    expires_at: { type: Date }
});

const Licenses = mongoose.model('Licenses', licensesSchema);

const userSettingsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    settings: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

const memoryPointerSchema = new mongoose.Schema({
    feature: { type: String, unique: true },
    address: { type: String },
    offsets: { type: [String] }
});

const MemoryPointer = mongoose.model('MemoryPointer', memoryPointerSchema);

const activityLogSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activity_type: { type: String },
    description: { type: String },
    ip_address: { type: String },
    timestamp: { type: Date, default: Date.now }
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

const publicChatSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, required: true },
    deleted: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

const PublicChat = mongoose.model('PublicChat', publicChatSchema);

const updateChatEntries = async () => {
    try {
        const res = await PublicChat.updateMany({ deleted: { $exists: false } }, { $set: { deleted: false } });
        console.log(`Updated ${res.nModified} chat entries`);
    } catch (err) {
        console.error("Error updating chat entries:", err);
    }
};

updateChatEntries();

const warstatusHistorySchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    world: { type: String },
    data: { type: Object }
});

const WarstatusHistory = mongoose.model('WarstatusHistory', warstatusHistorySchema);

const warstatusEventsSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    world: { type: String },
    realm: { type: String },
    event: { type: String },
    building: { type: String },
    data: { type: Object }
});

const WarstatusEvents = mongoose.model('WarstatusEvents', warstatusEventsSchema);

const initializeDatabase = async () => {
    console.log("Database initialized successfully.");
};

const tokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '1h' }
});

const Token = mongoose.model('Token', tokenSchema);

module.exports = {
    User,
    BannedUser,
    UserSettings,
    Licenses,
    MemoryPointer,
    // Remove Settings from exports
    // Settings,
    ActivityLog,
    NotificationQueue,
    PublicChat,
    Token,
    WarstatusHistory,
    WarstatusEvents,
    initializeDatabase
};