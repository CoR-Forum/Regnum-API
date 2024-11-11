require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { logActivity } = require('./utils');
const { User } = require('./models');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args.shift().toLowerCase();

    if (command === '!userinfo') {
        const username = args[0];
        if (!username) {
            return message.reply('Please provide a username.');
        }

        try {
            const user = await User.findOne({ username });
            if (!user) {
                return message.reply('User not found.');
            }

            message.reply(`User Info:\nUsername: ${user.username}\nEmail: ${user.email}\nNickname: ${user.nickname}`);
        } catch (error) {
            console.error(error);
            message.reply('Error fetching user info.');
        }
    }

    if (command === '!logactivity') {
        const userId = args[0];
        const activityType = args[1];
        const description = args.slice(2).join(' ');

        if (!userId || !activityType || !description) {
            return message.reply('Please provide userId, activityType, and description.');
        }

        try {
            await logActivity(userId, activityType, description, message.author.id);
            message.reply('Activity logged successfully.');
        } catch (error) {
            console.error(error);
            message.reply('Error logging activity.');
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);