const express = require('express');
const crypto = require('crypto');
const argon2 = require('argon2');
const { validateUsername, validatePassword, validateEmail, validateNickname, checkUsernameExists, checkEmailExists, checkNicknameExists } = require('../validation');
const { logActivity } = require('../utils');
const { mail, notifyAdmins } = require('../notificator');
const { User } = require('../models'); // Import Mongoose models

const router = express.Router();

const validateInputs = ({ username, nickname, password, email }) => {
    const validations = [
        validateUsername(username),
        validatePassword(password),
        validateEmail(email),
        validateNickname(nickname)
    ];

    for (const validation of validations) {
        if (!validation.valid) {
            return { valid: false, message: validation.message };
        }
    }
    return { valid: true };
};

const checkExistence = async ({ username, email, nickname }) => {
    const [usernameExists, emailExists, nicknameExists] = await Promise.all([
        checkUsernameExists(username),
        checkEmailExists(email),
        checkNicknameExists(nickname)
    ]);

    if (usernameExists.exists) return { exists: true, message: usernameExists.message };
    if (emailExists.exists) return { exists: true, message: emailExists.message };
    if (nicknameExists.exists) return { exists: true, message: nicknameExists.message };

    return { exists: false };
};

router.post('/register', async (req, res) => {
    const { username, nickname, password, email } = req.body;

    const inputValidation = validateInputs({ username, nickname, password, email });
    if (!inputValidation.valid) {
        return res.status(400).json({ status: "error", message: inputValidation.message });
    }

    try {
        const existenceCheck = await checkExistence({ username, email, nickname });
        if (existenceCheck.exists) {
            return res.status(400).json({ status: "error", message: existenceCheck.message });
        }

        const activationToken = crypto.randomBytes(64).toString('hex');
        const hashedPassword = await argon2.hash(password);

        const newUser = new User({
            username,
            nickname,
            password: hashedPassword,
            email,
            activation_token: activationToken
        });

        await newUser.save();

        const activationLink = `${process.env.BASE_URL}:${process.env.PORT}${process.env.BASE_PATH}/activate/${activationToken}`;
        await mail(email, 'Activate your account', `Click here to activate your account: ${activationLink}`);

        logActivity(newUser._id, 'registration', 'User registered', req.ip);
        notifyAdmins(`New user registered: ${username}, email: ${email}, nickname: ${nickname}, IP: ${req.ip}`);

        res.json({ status: "success", message: "User registered successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

router.get('/activate/:token', async (req, res) => {
    try {
        const user = await User.findOne({ activation_token: req.params.token });
        if (!user) return res.status(404).json({ status: "error", message: "Activation token not found" });

        user.activation_token = null;
        await user.save();

        logActivity(user._id, 'account_activation', 'Account activated', req.ip);
        res.json({ status: "success", message: "Account activated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

module.exports = router;