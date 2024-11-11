require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { logActivity } = require('./utils');
const { User, Licenses } = require('./models'); // Import Licenses model

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const [command, ...args] = message.content.split(' ');

    if (command === '!u') {
        const username = args[0];
        if (!username) return message.reply('Please provide a username.');

        try {
            const user = await User.findOne({ username });
            if (!user) return message.reply('User not found.');

            const userInfoEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('User Info')
                .addFields(
                    { name: 'Username', value: user.username, inline: true },
                    { name: 'Email', value: user.email, inline: true },
                    { name: 'Nickname', value: user.nickname, inline: true }
                )
                .setTimestamp();

            message.reply({ embeds: [userInfoEmbed] });
        } catch (error) {
            console.error(error);
            message.reply('Error fetching user info.');
        }
    }

    if (command === '!lgen') {
        const [runtime, ...features] = args;

        if (!runtime || features.length === 0) return message.reply('Please provide runtime and at least one feature.');

        try {
            const licenseKey = `license-${Math.random().toString(36).substr(2, 9)}`;
            const expiresAt = new Date();
            const value = parseInt(runtime.slice(0, -1), 10);
            const unit = runtime.slice(-1);

            switch (unit) {
                case 'h':
                    expiresAt.setHours(expiresAt.getHours() + value);
                    break;
                case 'd':
                    expiresAt.setDate(expiresAt.getDate() + value);
                    break;
                case 'w':
                    expiresAt.setDate(expiresAt.getDate() + (value * 7));
                    break;
                case 'm':
                    expiresAt.setMonth(expiresAt.getMonth() + value);
                    break;
                case 'y':
                    expiresAt.setFullYear(expiresAt.getFullYear() + value);
                    break;
                default:
                    return message.reply('Invalid runtime format.');
            }

            const newLicense = new Licenses({
                key: licenseKey,
                features: features,
                runtime,
                expires_at: expiresAt
            });

            await newLicense.save();

            const licenseEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('License Generated')
                .addFields(
                    { name: 'License Key', value: licenseKey, inline: true },
                    { name: 'Features', value: features.join(', '), inline: true },
                    { name: 'Runtime', value: runtime, inline: true },
                    { name: 'Expires At', value: expiresAt.toISOString(), inline: true }
                )
                .setTimestamp();

            message.reply({ embeds: [licenseEmbed] });
        } catch (error) {
            console.error(error);
            message.reply('Error generating license.');
        }
    }

    if (command === '!llist') {
        try {
            const licenses = await Licenses.find();
            if (licenses.length === 0) return message.reply('No licenses found.');

            const licenseListEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('License List');

            licenses.forEach((license, index) => {
                licenseListEmbed.addFields(
                    { name: `License ${index + 1}`, value: `Key: ${license.key}\nFeatures: ${license.features.join(', ')}\nRuntime: ${license.runtime}\nExpires At: ${license.expires_at.toISOString()}` }
                );
            });

            message.reply({ embeds: [licenseListEmbed] });
        } catch (error) {
            console.error(error);
            message.reply('Error fetching licenses.');
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);