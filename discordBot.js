require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { User, BannedUser, Licenses, MemoryPointer, Settings, UserSettings, ActivityLog, PublicChat } = require('./models');
const { validateUsername, validateEmail, validateNickname } = require('./validation');
const { mail } = require('./modules/notificator');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const prefix = process.env.NODE_ENV === 'development' ? '?' : '!';

const adminIds = process.env.DISCORD_ADMINS ? process.env.DISCORD_ADMINS.split(',') : [];

client.once('ready', () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
});

const sendEmbed = (message, embed) => message.reply({ embeds: [embed] });
const handleError = (message, error) => {
    console.error(error);
    message.reply('An error occurred.');
};

const createEmbed = (title, color = '#0099ff', fields = []) => new EmbedBuilder().setColor(color).setTitle(title).addFields(fields).setTimestamp();

const getUserInfoFields = async (user) => {
    const licenses = await Licenses.find({ activated_by: user._id });
    const featureList = licenses.map(license => `${license.features.join(', ')} (expires at: ${license.expires_at ? license.expires_at.toISOString() : 'N/A'})`).join('\n') || 'No features';
    const banStatus = await BannedUser.findOne({ user_id: user._id, expires_at: { $gt: new Date() }, active: true });
    return [
        { name: 'Username', value: user.username, inline: true },
        { name: 'Email', value: user.email, inline: true },
        { name: 'Nickname', value: user.nickname, inline: true },
        { name: 'Ban Status', value: banStatus ? `Banned until ${banStatus.expires_at.toISOString()} for ${banStatus.reason}` : 'Not banned', inline: false },
        { name: 'Features', value: featureList, inline: false },
    ];
};

const sendWarstatusToDiscord = async (messageContent) => {
    const channelId = process.env.DISCORD_CHANNEL_ID_WARSTATUS;
    if (!channelId) {
        console.error('DISCORD_CHANNEL_ID_WARSTATUS is not set in the environment variables.');
        return;
    }

    try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await channel.send(messageContent);
        } else {
            console.error('Channel not found.');
        }
    } catch (error) {
        console.error('Error sending message to Discord channel:', error);
    }
};

const commands = {
    'u': async (message, [username]) => {
        if (!username) return message.reply('Usage: !u <username>');
        const { valid, message: validationMessage } = validateUsername(username);
        if (!valid) return message.reply(validationMessage);

        try {
            const user = await User.findOne({ username });
            if (!user) return message.reply('User not found.');
            const fields = await getUserInfoFields(user);
            sendEmbed(message, createEmbed('User Info', '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'ul': async (message, [page = 1]) => {
        const pageSize = 10;
        try {
            const users = await User.find().skip((page - 1) * pageSize).limit(pageSize);
            const totalUsers = await User.countDocuments();
            if (!users.length) return message.reply('No users found.');
            const fields = await Promise.all(users.map(async user => {
                const userFields = await getUserInfoFields(user);
                return { name: user.username, value: userFields.map(field => `**${field.name}:** ${field.value}`).join('\n') };
            }));
            sendEmbed(message, createEmbed(`User List - Page ${page} of ${Math.ceil(totalUsers / pageSize)}`, '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'ub': async (message, [username, duration, ...reasonParts]) => {
        const reason = reasonParts.join(' ');
        if (!username || !duration || !reason) return message.reply('Usage: !ub <username> <duration> <reason>');
        const { valid, message: validationMessage } = validateUsername(username);
        if (!valid) return message.reply(validationMessage);

        try {
            const user = await User.findOne({ username });
            if (!user) return message.reply('User not found.');

            const existingBan = await BannedUser.findOne({ user_id: user._id, expires_at: { $gt: new Date() }, active: true });
            if (existingBan) return message.reply('User is already banned: ' + existingBan.reason + ' until ' + existingBan.expires_at.toISOString());

            let expiresAt = new Date();
            const durationValue = parseInt(duration.slice(0, -1), 10);
            const durationUnit = duration.slice(-1);
            if (isNaN(durationValue) || !['h', 'd', 'w', 'm', 'y'].includes(durationUnit)) return message.reply('Invalid duration format.');
            const durationMap = { h: 'Hours', d: 'Date', w: 'Date', m: 'Month', y: 'FullYear' };
            expiresAt[`set${durationMap[durationUnit]}`](expiresAt[`get${durationMap[durationUnit]}`]() + (durationUnit === 'w' ? durationValue * 7 : durationValue));

            const bannedUser = new BannedUser({
                user_id: user._id,
                reason: reason,
                banned_by: message.author.id,
                banned_at: new Date(),
                expires_at: expiresAt,
                active: true
            });

            await bannedUser.save();
            const fields = [
                { name: 'Username', value: user.username, inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Banned Until', value: expiresAt.toISOString(), inline: true }
            ];
            sendEmbed(message, createEmbed('User Banned', '#ff0000', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'uu': async (message, [username]) => {
        if (!username) return message.reply('Usage: !uu <username>');
        const { valid, message: validationMessage } = validateUsername(username);
        if (!valid) return message.reply(validationMessage);

        try {
            const user = await User.findOne({ username });
            if (!user) return message.reply('User not found.');

            const existingBan = await BannedUser.findOne({ user_id: user._id, expires_at: { $gt: new Date() }, active: true });
            if (!existingBan) return message.reply('User is not banned.');

            existingBan.active = false;
            await existingBan.save();
            const fields = [
                { name: 'Username', value: user.username, inline: true },
                { name: 'Status', value: 'Unbanned', inline: true }
            ];
            sendEmbed(message, createEmbed('User Unbanned', '#00ff00', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'ubl': async (message, [username]) => {
        if (!username) return message.reply('Usage: !ubl <username>');
        const { valid, message: validationMessage } = validateUsername(username);
        if (!valid) return message.reply(validationMessage);

        try {
            const user = await User.findOne({ username });
            if (!user) return message.reply('User not found.');

            const bans = await BannedUser.find({ user_id: user._id });
            if (!bans.length) return message.reply('No bans found.');

            const fields = bans.map(ban => ({
                name: 'Ban Information',
                value: `**Banned by:** ${ban.banned_by}\n**Banned at:** ${ban.banned_at.toISOString()}\n**Expires at:** ${ban.expires_at.toISOString()}\n**Reason:** ${ban.reason}\n**Status:** ${ban.active ? (ban.expires_at > new Date() ? 'Active' : 'Expired') : 'Unbanned'}`
            }));
            sendEmbed(message, createEmbed(`Bans for ${user.username}`, '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'ubla': async (message, [page = 1]) => {
        const pageSize = 10;
        try {
            const bans = await BannedUser.find().populate('user_id', 'username').skip((page - 1) * pageSize).limit(pageSize);
            const totalBans = await BannedUser.countDocuments();
            if (!bans.length) return message.reply('No bans found.');

            const fields = bans.map(ban => ({
                name: 'Ban Information',
                value: `**Username:** ${ban.user_id.username}\n**Banned by:** ${ban.banned_by}\n**Banned at:** ${ban.banned_at.toISOString()}\n**Expires at:** ${ban.expires_at.toISOString()}\n**Reason:** ${ban.reason}\n**Status:** ${ban.active ? (ban.expires_at > new Date() ? 'Active' : 'Expired') : 'Unbanned'}`
            }));
            sendEmbed(message, createEmbed(`All Bans - Page ${page} of ${Math.ceil(totalBans / pageSize)}`, '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'lg': async (message, [runtime, ...features]) => {
        if (!runtime) return message.reply('Usage: !lg <runtime> <feature1> <feature2> ... or !lg <runtime> _all');
        try {
            if (features.includes('_all')) {
                const allPointers = await MemoryPointer.find();
                features = allPointers.map(pointer => pointer.feature);
            }
            if (!features.length) return message.reply('No features available.');
            
            const licenseKey = `license-${Math.random().toString(36).substr(2, 9)}`;
            const newLicense = new Licenses({ key: licenseKey, features, runtime });
            await newLicense.save();
            const fields = [
                { name: 'License Key', value: licenseKey, inline: true },
                { name: 'Features', value: features.join(', '), inline: true },
                { name: 'Runtime', value: runtime, inline: true }
            ];
            sendEmbed(message, createEmbed('License Generated', '#00ff00', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    // update license features
    'lf': async (message, [licenseKey, ...features]) => {
        if (!licenseKey || !features.length) return message.reply('Usage: !lf <license_key> <feature1> <feature2> ...');
        try {
            const license = await Licenses.findOne({ key: licenseKey });
            if (!license) return message.reply('License not found.');
            license.features = features;
            await license.save();
            const fields = [
                { name: 'License Key', value: license.key, inline: true },
                { name: 'Features', value: features.join(', '), inline: true },
                { name: 'Runtime', value: license.runtime, inline: true }
            ];
            sendEmbed(message, createEmbed('License Updated', '#00ff00', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'll': async (message, [page = 1]) => {
        const pageSize = 10;
        try {
            const licenses = await Licenses.find().populate('activated_by', 'username').skip((page - 1) * pageSize).limit(pageSize);
            const totalLicenses = await Licenses.countDocuments();
            if (!licenses.length) return message.reply('No licenses found.');
            const fields = licenses.map(license => ({
                name: license.key,
                value: `Features: ${license.features.join(', ')}\nRuntime: ${license.runtime}\nExpires At: ${license.expires_at ? license.expires_at.toISOString() : 'N/A'}\nActivated By: ${license.activated_by ? license.activated_by.username : 'N/A'}\nActivated At: ${license.activated_at ? license.activated_at.toISOString() : 'N/A'}`
            }));
            sendEmbed(message, createEmbed(`License List - Page ${page} of ${Math.ceil(totalLicenses / pageSize)}`, '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'ld': async (message, [licenseKey]) => {
        if (!licenseKey) return message.reply('Usage: !ld <license_key>');
        try {
            const license = await Licenses.findOne({ key: licenseKey });
            if (!license) return message.reply('License not found.');
            await Licenses.deleteOne({ key: licenseKey });
            sendEmbed(message, createEmbed(`License ${license.key} Deleted`, '#ff0000'));
        } catch (error) {
            handleError(message, error);
        }
    },
    'pl': async (message) => {
        try {
            const pointers = await MemoryPointer.find();
            if (!pointers.length) return message.reply('No memory pointers found.');
            const fields = pointers.map(pointer => ({
                name: pointer.feature,
                value: `Address: ${pointer.address}\nOffsets: ${pointer.offsets.join(', ')}`
            }));
            sendEmbed(message, createEmbed('Memory Pointer List', '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'pd': async (message, [feature]) => {
        if (!feature) return message.reply('Usage: !pd <feature>');
        try {
            const pointer = await MemoryPointer.findOne({ feature });
            if (!pointer) return message.reply('Memory pointer not found.');
            await MemoryPointer.deleteOne({ feature });
            const fields = [
                { name: 'Feature', value: pointer.feature, inline: true },
                { name: 'Address', value: pointer.address, inline: true },
                { name: 'Offsets', value: pointer.offsets.join(', '), inline: true }
            ];
            sendEmbed(message, createEmbed('Memory Pointer Deleted', '#ff0000', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'pa': async (message, [feature, address, ...offsets]) => {
        if (!feature || !address) return message.reply('Usage: !pa <feature> <address> <offset1> <offset2> ...');
        try {
            const existingPointer = await MemoryPointer.findOne({ feature });
            if (existingPointer) return message.reply('Memory pointer with this feature already exists.');
            const newPointer = new MemoryPointer({ feature, address, offsets: offsets.length ? offsets : undefined });
            await newPointer.save();
            const fields = [
                { name: 'Feature', value: feature, inline: true },
                { name: 'Address', value: address, inline: true },
                { name: 'Offsets', value: offsets.length ? offsets.join(', ') : 'None', inline: true }
            ];
            sendEmbed(message, createEmbed('Memory Pointer Added', '#00ff00', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'pe': async (message, [feature, newFeature, address, ...offsets]) => {
        if (!feature || !newFeature || !address) return message.reply('Usage: !pe <feature> <new_feature_name> <address> <offset1> <offset2> ...');
        try {
            const pointer = await MemoryPointer.findOne({ feature });
            if (!pointer) return message.reply('Memory pointer not found.');
            const existingPointer = await MemoryPointer.findOne({ feature: newFeature });
            if (existingPointer && existingPointer._id.toString() !== pointer._id.toString()) return message.reply('Memory pointer with this feature already exists.');
            Object.assign(pointer, { feature: newFeature, address, offsets });
            await pointer.save();
            const fields = [
                { name: 'Feature', value: newFeature, inline: true },
                { name: 'Address', value: address, inline: true },
                { name: 'Offsets', value: offsets.join(', '), inline: true }
            ];
            sendEmbed(message, createEmbed('Memory Pointer Edited', '#00ff00', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'e': async (message, [username, subject, ...text]) => {
        if (!username || !subject || !text) return message.reply('Usage: !e <username> <subject> <text>');
        const { valid, message: validationMessage } = validateUsername(username);
        if (!valid) return message.reply(validationMessage);

        try {
            const user = await User.findOne({ username });
            if (!user) return message.reply('User not found.');
            mail(user.email, subject, text.join(' '));
            sendEmbed(message, createEmbed('Email to user ' + user.username + ' queued', '#00ff00'));
        } catch (error) {
            handleError(message, error);
        }
    },
    'ea': async (message, [subject, ...text]) => {
        if (!subject || !text) return message.reply('Usage: !ea <subject> <text>');
        try {
            const users = await User.find();
            users.forEach(user => {
                mail(user.email, subject, text.join(' '));
            });
            sendEmbed(message, createEmbed('Email for users ' + users.map(user => user.username).join(', ') + ' queued', '#00ff00'));
        } catch (error) {
            handleError(message, error);
        }
    },
    'ud': async (message, [username, confirmation]) => {
        if (!username) return message.reply('Usage: ' + prefix + 'ud <username>');
        const { valid, message: validationMessage } = validateUsername(username);
        if (!valid) return message.reply(validationMessage);

        try {
            const user = await User.findOne({ username });
            if (!user) return message.reply('User not found.');

            if (confirmation !== 'confirm') {
                return message.reply(`Are you sure you want to delete user ${username}? This action cannot be undone. Type \` ${prefix}ud ${username} confirm\` to confirm.`);
            }

            await BannedUser.deleteMany({ user_id: user._id });
            await Licenses.deleteMany({ activated_by: user._id });
            await MemoryPointer.deleteMany({ user_id: user._id });
            await UserSettings.deleteMany({ user_id: user._id });
            await ActivityLog.deleteMany({ user_id: user._id });
            await PublicChat.deleteMany({ user_id: user._id });
            await User.deleteOne({ username });

            sendEmbed(message, createEmbed('User and related data deleted', '#ff0000', [{ name: 'Username', value: username }]));
        } catch (error) {
            handleError(message, error);
        }
    },
    'cl': async (message) => {
        try {
            const messages = await PublicChat.find()
                .sort({ timestamp: -1 })
                .limit(10)
                .populate('user_id', 'nickname');

            if (!messages.length) return message.reply('No chat messages found.');

            const fields = messages.map(chatMessage => ({
                name: `Message ID: ${chatMessage._id}`,
                value: `**User:** ${chatMessage.user_id.nickname}\n**Message:** ${chatMessage.message}\n**Timestamp:** ${chatMessage.timestamp.toISOString()}${chatMessage.deleted ? `\n**Status:** Deleted` : ''}`
            }));

            sendEmbed(message, createEmbed('Last 10 Chat Messages', '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'cd': async (message, [messageId]) => {
        if (!messageId) return message.reply('Usage: !cd <message_id>');

        try {
            const chatMessage = await PublicChat.findById(messageId);
            if (!chatMessage) return message.reply('Chat message not found.');

            chatMessage.deleted = true;
            await chatMessage.save();

            sendEmbed(message, createEmbed('Chat Message Deleted', '#ff0000', [{ name: 'Message ID', value: messageId }]));
        } catch (error) {
            handleError(message, error);
        }
    },
    'help': (message) => {
        const environment = process.env.NODE_ENV === 'development' ? 'Development' : 'Production';
        const userCommands = [
            { name: `${prefix}u <username>`, value: 'Get user info by username.' },
            { name: `${prefix}ul [page]`, value: 'List users.' },
            { name: `${prefix}ub <username> <duration> <reason>`, value: 'Ban user.' },
            { name: `${prefix}uu <username>`, value: 'Unban user.' },
            { name: `${prefix}ubl <username>`, value: 'List all previous bans for a user.' },
            { name: `${prefix}ubla [page]`, value: 'List all bans.' },
            { name: `${prefix}ud <username>`, value: 'Delete user and related data.' }
        ];
        const licenseCommands = [
            { name: `${prefix}lg <runtime> <feature1> <feature2> ... or ${prefix}lg <runtime> _all`, value: 'Generate license.' },
            { name: `${prefix}lf <license_key> <feature1> <feature2> ...`, value: 'Update license features.' },
            { name: `${prefix}ll [page]`, value: 'List licenses.' },
            { name: `${prefix}ld <license_key>`, value: 'Delete license.' }
        ];
        const memoryCommands = [
            { name: `${prefix}pl`, value: 'List memory pointers.' },
            { name: `${prefix}pd <feature>`, value: 'Delete memory pointer.' },
            { name: `${prefix}pa <feature> <address> <offset1> <offset2> ...`, value: 'Add memory pointer.' },
            { name: `${prefix}pe <feature> <new_feature_name> <address> <offset1> <offset2> ...`, value: 'Edit memory pointer.' }
        ];
        const chatCommands = [
            { name: `${prefix}cl`, value: 'List last 10 chat messages.' },
            { name: `${prefix}cd <message_id>`, value: 'Delete a chat message by ID.' }
        ];
        const systemCommands = [
            { name: `${prefix}e <username> <subject> <text>`, value: 'Send email to user.' },
            { name: `${prefix}ea <subject> <text>`, value: 'Send email to all users.' },
            { name: `${prefix}help / ${prefix}h`, value: 'Show this help message.' },
            { name: 'Environment', value: environment }
        ];

        const fields = [
            { name: 'User Commands (use quotes for multi-word arguments)', value: userCommands.map(cmd => `**${cmd.name}**: ${cmd.value}`).join('\n') },
            { name: 'License Commands', value: licenseCommands.map(cmd => `**${cmd.name}**: ${cmd.value}`).join('\n') },
            { name: 'Memory Commands', value: memoryCommands.map(cmd => `**${cmd.name}**: ${cmd.value}`).join('\n') },
            { name: 'Chat Commands', value: chatCommands.map(cmd => `**${cmd.name}**: ${cmd.value}`).join('\n') },
            { name: 'System Commands', value: systemCommands.map(cmd => `**${cmd.name}**: ${cmd.value}`).join('\n') }
        ];

        sendEmbed(message, createEmbed('Help', '#0099ff', fields));
    },
    'h': (message) => commands.help(message)
};

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
    if (!adminIds.includes(message.author.id)) return message.reply('You do not have permission to use this bot.');

    const args = message.content.slice(prefix.length).match(/(?:[^\s"]+|"[^"]*")+/g).map(arg => arg.replace(/(^"|"$)/g, ''));
    const command = args.shift().toLowerCase();

    if (commands[command]) await commands[command](message, args);
});

if (process.env.DISCORD_BOT === 'true') {
    client.login(process.env.DISCORD_BOT_TOKEN);
}

module.exports = {
    sendWarstatusToDiscord
};