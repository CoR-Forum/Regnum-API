const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const { logActivity, generateToken, convertDurationToMilliseconds } = require('./utils');
const { validateToken } = require('./middleware');
const { User, UserSettings, MemoryPointer, Settings, Licenses, Token, initializeDatabase } = require('./models');
const chatRoutes = require('./router/chat');
const settingsRoutes = require('./router/settings');
const bossSpawnsRoutes = require('./router/bossSpawns');
const { router: statusRoutes, updateStats } = require('./router/status');
const { validateUsername } = require('./validation');
const { RateLimiter } = require('./modules/rateLimiter');
const warstatusRoutes = require('./router/warstatus');

require('./discordBot');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || '/v1';

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('MongoDB connected');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Use CORS middleware
app.use(cors({
  origin: 'https://patch.regnumstarter.cor-forum.de'
}));

app.use(helmet());

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
}));

app.use(express.json());

app.post(`${BASE_PATH}/login`, RateLimiter(1, 3), async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ status: "error", message: "Username and password are required" });
  }

  const usernameValidation = validateUsername(username);

  if (!usernameValidation.valid) {
    return res.status(400).json({ status: "error", message: usernameValidation.message });
  }

  try {
    const response = await axios.post(process.env.WOLTLAB_API_URL + "/login", `username=${username}&password=${password}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-API-KEY': process.env.WOLTLAB_API_KEY
      }
    });

    console.log(response.data);

    if (response.data.success !== true) {
      return res.status(401).json({ status: "error", message: "CoR-Forum account not found. Error: " + response.data.message });
    }

    const forumUser = response.data;
    let user = await User.findOne({ woltlab_userID: forumUser.userID });
    if (!user) {
      user = new User({
        username: forumUser.username.toLowerCase(),
        nickname: forumUser.username,
        email: forumUser.email.toLowerCase(),
        activation_token: null,
        permissions: [],
        created_at: new Date(),
        banned: false,
        last_activity: new Date(),
        deleted: false,
        woltlab_userID: forumUser.userID
      });
      await user.save();

      // Generate a license for the new user
      const licenseKey = crypto.randomBytes(16).toString('hex');
      const newLicense = new Licenses({
        key: licenseKey,
        activated_by: user._id,
        activated_at: new Date(),
        features: ['fov', 'zoom', 'moonwalk'],
        runtime: '10y',
        expires_at: new Date(Date.now() + convertDurationToMilliseconds('10y'))
      });
      await newLicense.save();
    }

    const token = await generateToken(user);

    logActivity(user._id, 'login', 'User logged in', req.ip);

    const licenses = await Licenses.find({ activated_by: user._id });

    const memoryPointers = {};
    const validFeatures = licenses.flatMap(license => 
      license.features.filter(feature => {
        const expiresAt = new Date(license.expires_at);
        const now = new Date();
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
      }
    }

    const settings = await Settings.find();
    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.name] = setting.value;
    });

    const userSettings = await UserSettings.findOne({ user_id: user._id });

    const responsePayload = {
      status: "success",
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        nickname: user.nickname,
        settings: userSettings && userSettings.settings ? userSettings.settings : '{"SoundVolume":0.5,"enableMusic":true,"enableSoundEffects":true,"excludeFromCapture":false,"regnumInstallPath":"","showIntro":true,"showLoadingScreen":true,"textColor":[1.0,1.0,1.0,1.0]}',
        features: []
      },
      system: settingsObject
    };

    if (settingsObject.status !== "detected") {
      responsePayload.user.features = validFeatures.map(feature => ({
        name: feature,
        pointer: memoryPointers[feature] || null
      }));
    }

    res.json(responsePayload);
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

app.put(`${BASE_PATH}/license/activate`, validateToken, async (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ status: "error", message: "Invalid license key" });
  }

  try {
    const license = await Licenses.findOne({ key: { $eq: licenseKey } });
    if (!license) {
      return res.status(404).json({ status: "error", message: "License not found" });
    }

    if (license.activated_by) {
      return res.status(403).json({ status: "error", message: "License already in use" });
    }

    license.activated_by = req.user._id;
    license.activated_at = new Date();
    license.expires_at = new Date(Date.now() + convertDurationToMilliseconds(license.runtime));
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

app.use(`${BASE_PATH}/chat`, chatRoutes);
app.use(`${BASE_PATH}`, settingsRoutes);
app.use(`${BASE_PATH}/`, statusRoutes);
app.use(`${BASE_PATH}/`, bossSpawnsRoutes);
app.use(`${BASE_PATH}/`, warstatusRoutes);

// /register 302 redirect
app.get(`${BASE_PATH}/register`, (req, res) => {
  res.redirect(302, 'https://cor-forum.de/board/register/');
});

// /reset-password 302 redirect
app.get(`${BASE_PATH}/reset-password`, (req, res) => {
  res.redirect(302, 'https://cor-forum.de/board/lost-password/');
});


const server = app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}` + BASE_PATH);
});

initializeDatabase().then(() => {
  updateStats();
  setInterval(updateStats, 5000);
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