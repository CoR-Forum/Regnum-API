// FILE: index.js

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const helmet = require('helmet'); // Add helmet
const argon2 = require('argon2');
const { mail, notifyAdmins } = require('./notificator');
const { validateUsername, validatePassword, validateEmail, validateNickname } = require('./validation');
const { logActivity } = require('./utils');
const registerRoutes = require('./router/register');
const passwordResetRoutes = require('./router/passwordReset');
const { router: feedbackRoutes, initializeFeedbackTable } = require('./router/feedback');
const { validateSession } = require('./middleware');
const { User, UserSettings, License, MemoryPointer, Settings, ActivityLog, initializeDatabase } = require('./models'); // Import models and initializeDatabase

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || '/api';

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('MongoDB connected');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Use Helmet to set various HTTP headers for security
app.use(helmet());

// Set Content Security Policy (CSP)
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
}));

// Enforce HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

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

app.use(`${BASE_PATH}`, registerRoutes);
app.use(`${BASE_PATH}`, passwordResetRoutes);
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

    const passwordMatch = await argon2.verify(user.password, password); // Verify the password using argon2
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

      // Fetch memory pointers for available sylentx_features
      const features = user.sylentx_features ? user.sylentx_features.split(',') : [];
      const memoryPointers = {};
      for (const feature of features) {
        const pointer = await MemoryPointer.findOne({ feature });
        if (pointer) {
          memoryPointers[feature] = pointer;
        }
      }

      // Fetch settings
      const settings = await Settings.find();
      const settingsObject = {};
      settings.forEach(setting => {
        settingsObject[setting.name] = setting.value;
      });

      // Fetch user settings from user_settings_sylentx table
      const userSettings = await UserSettings.findOne({ user_id: user._id });

      res.json({
        status: "success",
        message: "Login successful",
        user: {
          id: user._id,
          username: user.username,
          nickname: user.nickname,
          settings: userSettings ? userSettings.settings : null,
          features: user.sylentx_features,
          pointers: memoryPointers
        },
        settings: settingsObject
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

app.get(`${BASE_PATH}`, (req, res) => res.redirect(`${BASE_PATH}/status`));

initializeDatabase().then(() => {
  initializeFeedbackTable();

  const server = app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    notifyAdmins(`API server started at port ${PORT}`);
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
});