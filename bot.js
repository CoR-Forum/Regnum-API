require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { logActivity } = require('./utils');
const { User } = require('./models');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Check if the user has the "ADMINISTRATOR" permission
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('You do not have permission to use this bot.');
    }

    const args = message.content.split(' ');
    const command = args.shift().toLowerCase();

    if (command === '!u') {
        const username = args[0];
        if (!username) {
            return message.reply('Please provide a username.');
        }

        try {
            const user = await User.findOne({ username });
            if (!user) {
                return message.reply('User not found.');
            }

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

    if (command === '!l') {
        const userId = args[0];
        const activityType = args[1];
        const description = args.slice(2).join(' ');

        if (!userId || !activityType || !description) {
            return message.reply('Please provide userId, activityType, and description.');
        }

        try {
            await logActivity(userId, activityType, description, message.author.id);

            const logActivityEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Activity Logged')
                .addFields(
                    { name: 'User ID', value: userId, inline: true },
                    { name: 'Activity Type', value: activityType, inline: true },
                    { name: 'Description', value: description, inline: true }
                )
                .setTimestamp();

            message.reply({ embeds: [logActivityEmbed] });
        } catch (error) {
            console.error(error);
            message.reply('Error logging activity.');
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);