require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const argon2 = require('argon2');
const { mail, notifyAdmins } = require('./notificator');
const { logActivity, generateToken } = require('./utils');
const registerRoutes = require('./router/register');
const passwordResetRoutes = require('./router/passwordReset');
const feedbackRoutes = require('./router/feedback');
const { validateToken } = require('./middleware');
const { User, BannedUser, UserSettings, MemoryPointer, Settings, Licenses, Token, initializeDatabase } = require('./models');
const chatRoutes = require('./router/chat');
require('./bot');

const passport = require('passport');
require('./auth/discord');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || '/api';

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('MongoDB connected');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

app.use(helmet());

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
}));

app.use(express.json());

app.use(passport.initialize());

app.get(`${BASE_PATH}/auth/discord`, passport.authenticate('discord'));

app.get(`${BASE_PATH}/auth/discord/callback`, passport.authenticate('discord', { failureRedirect: '/', session: false }), (req, res) => {
  res.json({ status: "success", message: "Login successful", token: req.user.token });
});

app.post(`${BASE_PATH}/login`, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ status: "error", message: "Username and password are required" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ status: "error", message: "Invalid username or password" });

    const passwordMatch = await argon2.verify(user.password, password);
    if (!passwordMatch) return res.status(401).json({ status: "error", message: "Invalid username or password" });

    if (user.activation_token) return res.status(403).json({ status: "error", message: "Account not activated" });

    // Check if the user is banned
    const activeBan = await BannedUser.findOne({
      user_id: user._id,
      active: true,
      expires_at: { $gt: new Date() }
    });
    if (activeBan) {
      return res.status(403).json({ status: "error", message: `Forbidden: User is banned until ${activeBan.expires_at.toISOString()} for ${activeBan.reason}` });
    }

    const token = await generateToken(user);

    const loginNotificationText = `Hello ${user.username},\n\nYou have successfully logged in to your Sylent-X Account.\n\nDate: ${new Date().toLocaleString()}\nIP address: ${req.ip}\n\nIf this wasn't you, please change your password immediately and contact support.`;
    await mail(user.email, 'Login Notification', loginNotificationText);

    logActivity(user._id, 'login', 'User logged in', req.ip);

    notifyAdmins(`User logged in: ${user.username}, IP: ${req.ip}, Email: ${user.email}, Nickname: ${user.nickname}`, 'discord_login');

    const licenses = await Licenses.find({ activated_by: user._id });

    const memoryPointers = {};
    const validFeatures = licenses.flatMap(license => 
      license.features.filter(feature => {
        const expiresAt = new Date(license.expires_at);
        const now = new Date();
        console.log(`Feature expires at: ${expiresAt}, Current time: ${now}`);
        return expiresAt > now;
      })
    );

    for (const feature of validFeatures) {
      const pointer = await MemoryPointer.findOne({ feature });
      if (pointer) {
        memoryPointers[feature] = {
          address: pointer.address,
          offsets: pointer.offsets
        };
      } else {
        console.log(`No pointer found for feature: ${feature}`);
      }
    }

    const settings = await Settings.find();
    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.name] = setting.value;
    });

    const userSettings = await UserSettings.findOne({ user_id: user._id });

    res.json({
      status: "success",
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        nickname: user.nickname,
        settings: userSettings ? userSettings.settings : null,
        features: validFeatures.map(feature => ({
          name: feature,
          pointer: memoryPointers[feature] || null
        }))
      },
      system: settingsObject
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

app.post(`${BASE_PATH}/logout`, validateToken, async (req, res) => {
  try {
    await Token.deleteOne({ token: req.headers['authorization'] });
    res.json({ status: "success", message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

app.use(`${BASE_PATH}`, registerRoutes);
app.use(`${BASE_PATH}`, passwordResetRoutes);
app.use(`${BASE_PATH}/chat`, chatRoutes);
app.use(`${BASE_PATH}`, feedbackRoutes);

app.put(`${BASE_PATH}/license/activate`, validateToken, async (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ status: "error", message: "Invalid license key" });
  }

  try {
    const license = await Licenses.findOne({ key: licenseKey });
    if (!license) {
      return res.status(404).json({ status: "error", message: "License not found" });
    }

    if (license.activated_by) {
      return res.status(403).json({ status: "error", message: "License already in use" });
    }

    license.activated_by = req.user._id;
    license.activated_at = new Date();
    await license.save();

    const user = await User.findOne({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    logActivity(req.user._id, 'license_activate', 'License activated', req.ip);
    res.json({ status: "success", message: "License activated successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Internal server error: " + error.message });
  }
});

app.put(`${BASE_PATH}/save-settings`, validateToken, async (req, res) => {
  const { settings } = req.body;
  const userSettings = settings;

  if (!userSettings) {
    return res.status(400).json({ status: "error", message: "Invalid settings" });
  }

  try {
    const existingSettings = await UserSettings.findOne({ user_id: req.user._id });
    if (!existingSettings) {
      await new UserSettings({ user_id: req.user._id, settings: userSettings }).save();
    } else {
      console.log('Settings found for user:', req.user._id, existingSettings);
      existingSettings.settings = userSettings;
      await existingSettings.save();
      console.log('Settings updated for user:', req.user._id, existingSettings);
    }
    logActivity(req.user._id, 'settings_save', 'Settings saved', req.ip);
    res.json({ status: "success", message: "Settings saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

const os = require('os');
const disk = require('diskusage');

const startTime = Date.now();
app.get(`${BASE_PATH}`, async (req, res) => {
  const load = os.loadavg();
  const uptime = os.uptime();
  const apiUptime = Date.now() - startTime;
  const freeMemory = os.freemem();
  const totalMemory = os.totalmem();
  const cpus = os.cpus().length;
  const nodeVersion = process.version;
  const envVariables = {
      NODE_ENV: process.env.NODE_ENV,
      BASE_URL: process.env.BASE_URL,
      BASE_PATH: process.env.BASE_PATH
  };

  // Fetch disk usage
  const diskUsage = await disk.check('/');

  // Fetch database stats
  const dbStats = await mongoose.connection.db.stats();

  res.json({
      status: "success",
      message: "API is running",
      api: {
        uptime: apiUptime / 1000
    },
      system: {
          load: load,
          uptime: uptime,
          freeMemory: freeMemory,
          totalMemory: totalMemory,
          cpus: cpus,
          diskUsage: {
              free: diskUsage.free,
              total: diskUsage.total,
              available: diskUsage.available
          },
          nodeVersion: nodeVersion,
          envVariables: envVariables
      },
      database: {
          collections: dbStats.collections,
          objects: dbStats.objects,
          avgObjSize: dbStats.avgObjSize,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          indexSize: dbStats.indexSize
      }
    });
});

const server = app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  notifyAdmins(`API server started at port ${PORT}`);
});

initializeDatabase().then(() => {
  // Initialization logic if needed
});

const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(async () => {
    console.log('HTTP server closed.');
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);