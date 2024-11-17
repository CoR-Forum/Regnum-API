const express = require('express');
const { validateToken } = require('../middleware');
const { UserSettings } = require('../models');
const { logActivity } = require('../utils');

const router = express.Router();

router.put('/save-settings', validateToken, async (req, res) => {
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

module.exports = router;