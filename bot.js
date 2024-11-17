require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { User, BannedUser, Licenses, MemoryPointer } = require('./models');

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
            const licenses = await Licenses.find({ activated_by: user._id });
            const featureList = licenses.map(license => `${license.features.join(', ')} (License Key: ${license.key}, Expires at: ${license.expires_at ? license.expires_at.toISOString() : 'N/A'})`).join('\n') || 'No features';
            const banStatus = await BannedUser.findOne({ user_id: user._id, expires_at: { $gt: new Date() }, active: true });
            const fields = [
                { name: 'Username', value: user.username, inline: true },
                { name: 'Email', value: user.email, inline: true },
                { name: 'Nickname', value: user.nickname, inline: true },
                { name: 'Features', value: featureList, inline: false },
                { name: 'Ban Status', value: banStatus ? `Banned until ${banStatus.expires_at.toISOString()} for ${banStatus.reason}` : 'Not banned', inline: false }
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
                const licenses = await Licenses.find({ activated_by: user._id });
                const featureList = licenses.map(license => `${license.features.join(', ')} (License Key: ${license.key}, Expires at: ${license.expires_at ? license.expires_at.toISOString() : 'N/A'})`).join('\n') || 'No features';
                const banStatus = await BannedUser.findOne({ user_id: user._id, expires_at: { $gt: new Date() }, active: true });
                return { 
                    name: user.username + ' (' + user._id + ')', 
                    value: `Email: ${user.email}\nNickname: ${user.nickname}\nCreated At: ${user.created_at.toISOString()}\nBan Status: ${banStatus ? `Banned until ${banStatus.expires_at.toISOString()} for ${banStatus.reason}` : 'Not banned'}\nFeatures:\n${featureList}` 
                };
            }));
            sendEmbed(message, createEmbed(`User List - Page ${page} of ${Math.ceil(totalUsers / pageSize)}`, '#0099ff', fields));
        } catch (error) {
            handleError(message, error);
        }
    },
    // ... other commands remain unchanged
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