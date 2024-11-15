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
    password: { type: String, required: false },
    email: { type: String, required: true, unique: true },
    nickname: { type: String },
    discordId: { type: String, unique: true },
    activation_token: { type: String },
    permissions: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false },
    last_activity: { type: Date },
    deleted: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

const sylentxFeatureSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, default: 'zoom' },
    expires_at: { type: Date }
});

const SylentxFeature = mongoose.model('SylentxFeature', sylentxFeatureSchema);

const passwordResetSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reset_token: { type: String },
    expires_at: { type: Date }
});

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

const licensesSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    activated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activated_at: { type: Date },
    features: [{ type: String, required: true }],
    runtime: { type: String },
    expires_at: { type: Date }
});

const Licenses = mongoose.model('Licenses', licensesSchema);

const defaultLicenses = [
    {
        key: 'beta11',
        features: ["zoom", "posx", "posy"],
        runtime: "1w",
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
    offsets: { type: [String] } // Changed to an array of strings
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
        { feature: 'zoom', address: '0x68FC54', offsets: [] },
        { feature: 'fov', address: '0x70B9FC', offsets: [] },
        { feature: 'speedhack', address: '0x009B0BB0', offsets: ['0x94', '0x2BC', '0x40', '0x0', '0x11C', '0x58'] },
        { feature: 'gravity', address: '0x009B0BB0', offsets: ['0x94', '0x2BC', '0x40', '0x0', '0x11C', '0x30'] },
        { feature: 'moonjump', address: '0x009B0BB0', offsets: ['0x94', '0x2BC', '0x40', '0x0', '0x11C', '0x2C'] },
        { feature: 'moonwalk', address: '0x009B0BB0', offsets: ['0x94', '0x2BC', '0x40', '0x0', '0x11C', '0xA4'] },
        { feature: 'fakelag', address: '0x009B0BB0', offsets: ['0x94', '0x2BC', '0x40', '0x0', '0x11C', '0xB7'] },
        { feature: 'fakelagg', address: '0x009B0BB0', offsets: ['0x94', '0x2BC', '0x40', '0x0', '0x11C', '0xB8'] },
        { feature: 'cb', address: '0x007AF4CC', offsets: ['0x58', '0x1C', '0x8', '0x0', '0x1C', '0x88', '0x0'] },
        { feature: 'ch', address: '0x007AF4CC', offsets: ['0x58', '0x1C', '0x8', '0x0', '0x1C', '0x88', '0x4'] },
        { feature: 'cl', address: '0x007AF4CC', offsets: ['0x58', '0x1C', '0x8', '0x0', '0x1C', '0x88', '0x8'] },
        { feature: 'Camheight', address: '0x00E6E9B8', offsets: ['0x94', '0x2BC', '0x4', '0x84', '0x98'] },
        { feature: 'nomove1', address: '0x4F6A8D', offsets: [] },
        { feature: 'nomove2', address: '0x4F69E4', offsets: [] },
        { feature: 'nomove3', address: '0x4F67E9', offsets: [] },
        { feature: 'nomove4', address: '0x4F6740', offsets: [] },
        { feature: 'fastfly', address: '', offsets: [] },
        { feature: 'camposx', address: '0x007B0518', offsets: ['0x0', '0x40', '0x0', '0x78'] },
        { feature: 'camposy', address: '0x007B0518', offsets: ['0x0', '0x40', '0x0', '0x74'] },
        { feature: 'camposz', address: '0x007B0518', offsets: ['0x0', '0x40', '0x0', '0x70'] },
        { feature: 'posz', address: '0x007B0518', offsets: ['0x0', '0x40', '0x0', '0x78'] },
        { feature: 'turn', address: '0x009AFBB0', offsets: ['0x130', '0x40', '0x0', '0x70'] },
        { feature: 'posy', address: '0x007B0518', offsets: ['0x0', '0x40', '0x0', '0x74'] },
        { feature: 'posx', address: '0x007B0518', offsets: ['0x0', '0x40', '0x0', '0x70'] },
        { feature: 'speednop', address: '0x5050A1', offsets: [] }
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
    SylentxFeature,
    initializeDatabase
};