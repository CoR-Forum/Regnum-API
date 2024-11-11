const mongoose = require('mongoose');

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

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    nickname: { type: String },
    activation_token: { type: String },
    permissions: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false },
    last_activity: { type: Date },
    sylentx_features: [{ type: String, default: 'zoom' }],
    deleted: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

const passwordResetSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reset_token: { type: String },
    expires_at: { type: Date }
});

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

// schema for license activation keys to enable features
const licensesSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    activated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activated_at: { type: Date },
    features: [{ type: String, required: true }],
    expires_at: { type: Date }
});

const Licenses = mongoose.model('Licenses', licensesSchema);

// add default license keys here
const defaultLicenses = [
    {
        key: '123',
        features: ["zoom"],
        expires_at: new Date('2024-12-31')
    }
];

const initializeLicenses = async () => {
    for (const license of defaultLicenses) {
        const existingLicense = await Licenses.findOne({ key: license.key });
        if (!existingLicense) {
            await new Licenses(license).save();
        } else {
            existingLicense.features = license.features;
            existingLicense.expires_at = license.expires_at;
            await existingLicense.save();
        }
    }
    console.log("Default licenses inserted or updated successfully.");
}

initializeLicenses();

const userSettingsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    settings: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

const memoryPointerSchema = new mongoose.Schema({
    feature: { type: String },
    address: { type: String },
    offsets: { type: String }
});

const MemoryPointer = mongoose.model('MemoryPointer', memoryPointerSchema);

const settingsSchema = new mongoose.Schema({
    name: { type: String, enum: ['status', 'latest_version'], unique: true },
    value: { type: String },
});

const Settings = mongoose.model('Settings', settingsSchema);

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
    timestamp: { type: Date, default: Date.now }
});

const PublicChat = mongoose.model('PublicChat', publicChatSchema);

const initializeDatabase = async () => {
    const defaultMemoryPointers = [
        { feature: 'zoom', address: '0x68FC54', offsets: '' }
    ];

    for (const pointer of defaultMemoryPointers) {
        const existingPointer = await MemoryPointer.findOne({ feature: pointer.feature });
        if (!existingPointer) {
            await new MemoryPointer(pointer).save();
        } else {
            existingPointer.address = pointer.address;
            existingPointer.offsets = pointer.offsets;
            await existingPointer.save();
        }
    }
    console.log("Default memory pointers inserted or updated successfully.");

    const defaultSettings = [
        { name: 'status', value: 'online' },
        { name: 'latest_version', value: '0.0.0' }
    ];

    for (const setting of defaultSettings) {
        const existingSetting = await Settings.findOne({ name: setting.name });
        if (!existingSetting) {
            await new Settings(setting).save();
        } else {
            existingSetting.value = setting.value;
            await existingSetting.save();
        }
    }
    console.log("Default settings inserted or updated successfully.");
};

const feedbackSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, maxlength: 20 },
    message: { type: String, required: true },
    logs: { type: String },
    timestamp: { type: Date, default: Date.now },
    seen: { type: Boolean, default: false }
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

const tokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '1h' } // Token will expire after 1 hour
});

const Token = mongoose.model('Token', tokenSchema);

module.exports = {
    User,
    PasswordReset,
    UserSettings,
    Licenses,
    MemoryPointer,
    Settings,
    ActivityLog,
    NotificationQueue,
    PublicChat,
    Feedback,
    Token,
    initializeDatabase
};