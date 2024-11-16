require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { User, Licenses, MemoryPointer, SylentxFeature } = require('./models');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('your status message here', { type: 'WATCHING' });
});

const sendEmbed = (message, embed) => message.reply({ embeds: [embed] });
const handleError = (message, error) => {
    console.error(error);
    message.reply('An error occurred.');
};

const createEmbed = (title, color = '#0099ff', fields = []) => new EmbedBuilder().setColor(color).setTitle(title).addFields(fields).setTimestamp();

const commands = {
    'u': async (message, [username]) => {
        if (!username) return message.reply('Usage: !u <username>');
        try {
            const user = await User.findOne({ username });
            if (!user) return message.reply('User not found.');
            const features = await SylentxFeature.find({ user_id: user._id });
            const featureList = features.map(f => `${f.type} (expires at: ${f.expires_at.toISOString()})`).join('\n') || 'No features';
            const fields = [
                { name: 'Username', value: user.username, inline: true },
                { name: 'Email', value: user.email, inline: true },
                { name: 'Nickname', value: user.nickname, inline: true },
                { name: 'Features', value: featureList, inline: false }
            ];
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
                const features = await SylentxFeature.find({ user_id: user._id });
                const featureList = features.map(f => `${f.type} (expires at: ${f.expires_at.toISOString()})`).join('\n');
                return { name: user.username, value: `Email: ${user.email}\nNickname: ${user.nickname}\nCreated At: ${user.created_at.toISOString()}\nFeatures:\n${featureList}` };
            }));
            sendEmbed(message, createEmbed(`User List - Page ${page} of ${Math.ceil(totalUsers / pageSize)}`, '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'lg': async (message, [runtime, expiry, ...features]) => {
        if (!runtime || !expiry || !features.length) return message.reply('Usage: !lg <runtime> <expiry> <feature1> <feature2> ...');
        try {
            const licenseKey = `license-${Math.random().toString(36).substr(2, 9)}`;
            let expiresAt = new Date();
            const expiryValue = parseInt(expiry.slice(0, -1), 10);
            const expiryUnit = expiry.slice(-1);
            if (isNaN(expiryValue) || !['h', 'd', 'w', 'm', 'y'].includes(expiryUnit)) return message.reply('Invalid expiry format.');
            const expiryMap = { h: 'Hours', d: 'Date', w: 'Date', m: 'Month', y: 'FullYear' };
            expiresAt[`set${expiryMap[expiryUnit]}`](expiresAt[`get${expiryMap[expiryUnit]}`]() + (expiryUnit === 'w' ? expiryValue * 7 : expiryValue));
            const newLicense = new Licenses({ key: licenseKey, features, runtime, expires_at: expiresAt });
            await newLicense.save();
            const fields = [
                { name: 'License Key', value: licenseKey, inline: true },
                { name: 'Features', value: features.join(', '), inline: true },
                { name: 'Runtime', value: runtime, inline: true },
                { name: 'Expires At', value: expiresAt.toISOString(), inline: true }
            ];
            sendEmbed(message, createEmbed('License Generated', '#00ff00', fields));
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
                value: `Features: ${license.features.join(', ')}\nRuntime: ${license.runtime}\nExpires At: ${license.expires_at.toISOString()}\nActivated By: ${license.activated_by ? license.activated_by.username : 'N/A'}\nActivated At: ${license.activated_at ? license.activated_at.toISOString() : 'N/A'}`
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
                value: `ID: ${pointer._id}\nAddress: ${pointer.address}\nOffsets: ${pointer.offsets.join(', ')}`
            }));
            sendEmbed(message, createEmbed('Memory Pointer List', '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'pd': async (message, [pointerId]) => {
        if (!pointerId) return message.reply('Usage: !pd <pointer_id>');
        try {
            const pointer = await MemoryPointer.findById(pointerId);
            if (!pointer) return message.reply('Memory pointer not found.');
            await MemoryPointer.deleteOne({ _id: pointerId });
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
            const newPointer = new MemoryPointer({ feature, address, offsets });
            await newPointer.save();
            const fields = [
                { name: 'Feature', value: feature, inline: true },
                { name: 'Address', value: address, inline: true },
                { name: 'Offsets', value: offsets.join(', '), inline: true }
            ];
            sendEmbed(message, createEmbed('Memory Pointer Added', '#00ff00', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'pe': async (message, [pointerId, feature, address, ...offsets]) => {
        if (!pointerId || !feature || !address) return message.reply('Usage: !pe <pointer_id> <feature> <address> <offset1> <offset2> ...');
        try {
            const pointer = await MemoryPointer.findById(pointerId);
            if (!pointer) return message.reply('Memory pointer not found.');
            Object.assign(pointer, { feature, address, offsets });
            await pointer.save();
            const fields = [
                { name: 'Feature', value: feature, inline: true },
                { name: 'Address', value: address, inline: true },
                { name: 'Offsets', value: offsets.join(', '), inline: true }
            ];
            sendEmbed(message, createEmbed('Memory Pointer Edited', '#00ff00', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    'help': (message) => {
        const fields = [
            { name: '!u <username>', value: 'Get user info by username.' },
            { name: '!ul [page]', value: 'List users.' },
            { name: '!lg <runtime> <feature1> <feature2> ...', value: 'Generate license.' },
            { name: '!ll [page]', value: 'List licenses.' },
            { name: '!ld <license_key>', value: 'Delete license.' },
            { name: '!pl', value: 'List memory pointers.' },
            { name: '!pd <pointer_id>', value: 'Delete memory pointer.' },
            { name: '!pa <feature> <address> <offset1> <offset2> ...', value: 'Add memory pointer.' },
            { name: '!pe <pointer_id> <feature> <address> <offset1> <offset2> ...', value: 'Edit memory pointer.' }
        ];
        sendEmbed(message, createEmbed('Help', '#0099ff', fields));
    },
    'h': (message) => commands.help(message)
};

const prefix = process.env.NODE_ENV === 'development' ? '?' : '!';

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    if (!message.content.startsWith(prefix)) return;
    const [command, ...args] = message.content.slice(prefix.length).split(' ');
    if (commands[command]) await commands[command](message, args);
});

if (process.env.DISCORD_BOT === 'true') {
    client.login(process.env.DISCORD_BOT_TOKEN);
}