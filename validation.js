const validator = require('validator');
const { User } = require('./models'); // Import Mongoose models
const hibp = require('hibp'); // Import hibp

const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
    if (!username || typeof username !== 'string' || !usernameRegex.test(username)) {
        return { valid: false, message: 'Username must be a string between 3 and 20 characters, containing only letters and numbers.' };
    }
    return { valid: true };
};

const validatePassword = async (password) => {
    if (!password || typeof password !== 'string' || password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long.' };
    }

    // Check if the password has been pwned
    const pwnedCount = await hibp.pwnedPassword(password);
    if (pwnedCount > 0) {
        return { valid: false, message: `This password has been seen ${pwnedCount} times before on haveibeenpwned.com. Please choose a more secure password.` };
    }

    return { valid: true };
};

validatePassword('password123').then((result) => {
    console.log(result);
});

const validateEmail = (email) => {
    if (!email || !validator.isEmail(email)) {
        return { valid: false, message: 'Invalid email address.' };
    }
    return { valid: true };
};

const validateNickname = (nickname) => {
    const nicknameRegex = /^[a-zA-Z0-9 ]{3,30}$/;
    const spaceCount = (nickname.match(/ /g) || []).length;
    if (nickname && (typeof nickname !== 'string' || !nicknameRegex.test(nickname) || spaceCount > 2)) {
        return { valid: false, message: 'Nickname must be a string between 3 and 30 characters, containing only letters, numbers, and up to 2 spaces.' };
    }
    return { valid: true };
};

const checkFieldExists = async (field, value) => {
    try {
        const user = await User.findOne({ [field]: value });
        if (user) {
            return { exists: true, message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.` };
        }
        return { exists: false };
    } catch (error) {
        return { exists: false, message: 'Error checking field existence.' };
    }
};

const checkUsernameExists = (username) => checkFieldExists('username', username);
const checkEmailExists = (email) => checkFieldExists('email', email);
const checkNicknameExists = (nickname) => checkFieldExists('nickname', nickname);

module.exports = {
    validateUsername,
    validatePassword,
    validateEmail,
    validateNickname,
    checkUsernameExists,
    checkEmailExists,
    checkNicknameExists
};