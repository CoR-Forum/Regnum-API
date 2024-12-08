const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { User } = require('../models');
const { generateToken } = require('../utils'); // Assuming generateToken is moved to utils.js

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.BASE_URL + '/auth/discord/callback',
  scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ discordId: profile.id });
    if (!user) {
      user = new User({
        username: profile.username,
        email: profile.email,
        discordId: profile.id
      });
      await user.save();
    }
    const token = await generateToken(user);
    return done(null, { user, token });
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));