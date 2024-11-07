require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const helmet = require('helmet');
const argon2 = require('argon2');
const { mail, notifyAdmins } = require('./notificator');
const { validateUsername, validatePassword } = require('./validation');
const { logActivity } = require('./utils');
const registerRoutes = require('./router/register');
const passwordResetRoutes = require('./router/passwordReset');
const feedbackRoutes = require('./router/feedback');
const { validateSession, checkPermissions } = require('./middleware');
const { User, UserSettings, MemoryPointer, Settings, Licenses, initializeDatabase } = require('./models');
const chatRoutes = require('./router/chat');

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
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true }
}));

const updateLastActivity = async (req, res, next) => {
  if (req.session.userId) {
    await User.updateOne({ _id: req.session.userId }, { last_activity: new Date() });
  }
  next();
};

app.use(updateLastActivity);

app.post(`${BASE_PATH}/admin`, validateSession, checkPermissions(['admin']), (req, res) => {
  res.json({ status: "success", message: "Admin access granted" });
});

app.use(`${BASE_PATH}`, registerRoutes);
app.use(`${BASE_PATH}`, passwordResetRoutes);
app.use(`${BASE_PATH}/chat`, chatRoutes);
app.use(`${BASE_PATH}`, feedbackRoutes);

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

    req.session.userId = user._id;
    req.session.username = user.username;

    req.session.save(async err => {
      if (err) return res.status(500).json({ status: "error", message: "Internal server error" });

      const loginNotificationText = `Hello ${user.username},\n\nYou have successfully logged in from IP address: ${req.ip}.\n\nIf this wasn't you, please contact support immediately.`;
      await mail(user.email, 'Login Notification', loginNotificationText);

      logActivity(user._id, 'login', 'User logged in', req.ip);

      notifyAdmins(`User logged in: ${user.username}, IP: ${req.ip}, Email: ${user.email}, Nickname: ${user.nickname}`, 'discord_login');

      const features = user.sylentx_features || [];
      const memoryPointers = {};
      for (const feature of features) {
        const pointer = await MemoryPointer.findOne({ feature });
        if (pointer) {
          memoryPointers[feature] = {
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
        user: {
          id: user._id,
          username: user.username,
          nickname: user.nickname,
          settings: userSettings ? userSettings.settings : null,
          features: features.map(feature => ({
            name: feature,
            pointer: memoryPointers[feature] || null
          }))
        },
        system: settingsObject
      });
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

app.post(`${BASE_PATH}/logout`, validateSession, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ status: "error", message: "Error logging out" });
    notifyAdmins(`User logged out: ${req.session.username}, IP: ${req.ip}`);
    res.json({ status: "success", message: "Logout successful" });
  });
});

app.put(`${BASE_PATH}/license/activate`, validateSession, async (req, res) => {
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

    license.activated_by = req.session.userId;
    license.activated_at = new Date();
    await license.save();

    const user = await User.findOne({ _id: req.session.userId });
    if (Array.isArray(license.features)) {
      user.sylentx_features = license.features;
    } else {
      user.sylentx_features = [];
    }
    await user.save();

    logActivity(req.session.userId, 'license_activate', 'License activated', req.ip);
    res.json({ status: "success", message: "License activated successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Internal server error: " + error.message });
  }
});

app.put(`${BASE_PATH}/save-settings`, validateSession, async (req, res) => {
  const { settings } = req.body;
  const userSettings = settings;

  if (!userSettings) {
    return res.status(400).json({ status: "error", message: "Invalid settings" });
  }

  try {
    const existingSettings = await UserSettings.findOne({ user_id: req.session.userId });
    if (!existingSettings) {
      await new UserSettings({ user_id: req.session.userId, settings: userSettings }).save();
    } else {
      existingSettings.settings = userSettings;
      await existingSettings.save();
    }
    logActivity(req.session.userId, 'settings_save', 'Settings saved', req.ip);
    res.json({ status: "success", message: "Settings saved successfully" });
  } catch (error) {
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

  // Fetch active sessions count
  const activeSessions = await mongoose.connection.db.collection('sessions').countDocuments({});

  res.json({
      status: "success",
      message: "API is running",
      api: {
        uptime: apiUptime / 1000,
        activeSessions: activeSessions
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