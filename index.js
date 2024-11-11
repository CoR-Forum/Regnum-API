require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { mail, notifyAdmins } = require('./notificator');
const { validateUsername, validatePassword } = require('./validation');
const { logActivity } = require('./utils');
const registerRoutes = require('./router/register');
const passwordResetRoutes = require('./router/passwordReset');
const feedbackRoutes = require('./router/feedback');
const { validateToken, checkPermissions } = require('./middleware');
const { User, UserSettings, MemoryPointer, Settings, Licenses, Token, SylentxFeature, initializeDatabase } = require('./models');
const chatRoutes = require('./router/chat');
require('./bot');

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

const generateToken = async (user) => {
  await Token.deleteMany({ userId: user._id });
  const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
  await new Token({ userId: user._id, token }).save();

  return token;
};

app.post(`${BASE_PATH}/login`, async (req, res) => {
  const { username, password } = req.body;

  const usernameValidation = validateUsername(username);
  const passwordValidation = validatePassword(password);

  if (!usernameValidation.valid) {
    return res.status(400).json({ status: "error", message: usernameValidation.message });
  }
  if (!passwordValidation.valid) {
    return res.status(400).json({ status: "error", message: passwordValidation.message });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ status: "error", message: "Invalid username or password" });

    const passwordMatch = await argon2.verify(user.password, password);
    if (!passwordMatch) return res.status(401).json({ status: "error", message: "Invalid username or password" });

    if (user.activation_token) return res.status(403).json({ status: "error", message: "Account not activated" });

    const token = await generateToken(user);

    const loginNotificationText = `Hello ${user.username},\n\nYou have successfully logged in from IP address: ${req.ip}.\n\nIf this wasn't you, please contact support immediately.`;
    await mail(user.email, 'Login Notification', loginNotificationText);

    logActivity(user._id, 'login', 'User logged in', req.ip);

    notifyAdmins(`User logged in: ${user.username}, IP: ${req.ip}, Email: ${user.email}, Nickname: ${user.nickname}`, 'discord_login');

    const features = await SylentxFeature.find({ user_id: user._id });
    console.log('Fetched features:', features); // Debugging line

    const memoryPointers = {};
    const validFeatures = features.filter(feature => {
      const expiresAt = new Date(feature.expires_at);
      const now = new Date();
      console.log(`Feature expires at: ${expiresAt}, Current time: ${now}`);
      return expiresAt > now;
    });
    console.log('Valid features:', validFeatures); // Debugging line

    for (const feature of validFeatures) {
      const pointer = await MemoryPointer.findOne({ feature: feature.type });
      if (pointer) {
        memoryPointers[feature.type] = {
          address: pointer.address,
          offsets: pointer.offsets
        };
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
          name: feature.type,
          expires_at: feature.expires_at,
          pointer: memoryPointers[feature.type] || null
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
    await Token.deleteOne({ token: req.headers['authorization'] }); // Delete the token from MongoDB
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

    if (Array.isArray(license.features)) {
      for (const feature of license.features) {
        const [type, runtime] = feature.split(':');
        const expires_at = new Date();
        if (runtime && typeof runtime === 'string') {
          const value = parseInt(runtime.slice(0, -1), 10);
          const unit = runtime.slice(-1);
          switch (unit) {
            case 'h':
              expires_at.setHours(expires_at.getHours() + value);
              break;
            case 'd':
              expires_at.setDate(expires_at.getDate() + value);
              break;
            case 'w':
              expires_at.setDate(expires_at.getDate() + (value * 7));
              break;
            case 'm':
              expires_at.setMonth(expires_at.getMonth() + value);
              break;
            case 'y':
              expires_at.setFullYear(expires_at.getFullYear() + value);
              break;
            default:
              expires_at.setDate(expires_at.getDate() + 1); // Default to 1 day if runtime is not recognized
          }
        }

        // Delete the existing feature if the user already has it
        await SylentxFeature.deleteMany({ user_id: user._id, type });

        await new SylentxFeature({ user_id: user._id, type, expires_at, license_id: license._id }).save();
      }
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
const disk = require('diskusage'); // You may need to install this package

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
  const diskUsage = await disk.check('/'); // Adjust the path as needed

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