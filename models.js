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
    pw_reset_token: { type: String },
    permissions: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now },
    banned: { type: Boolean, default: false },
    last_activity: { type: Date },
    sylentx_features: { type: String },
    deleted: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

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
    activated_at: { type: Date },
    expires_at: { type: Date },
});

const License = mongoose.model('License', licenseSchema);

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
  if (defaultSettings) {
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
  }
};

module.exports = {
    User,
    UserSettings,
    License,
    MemoryPointer,
    Settings,
    ActivityLog,
    NotificationQueue,
    PublicChat,
    initializeDatabase
};