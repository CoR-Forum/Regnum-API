require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { User, Licenses, MemoryPointer } = require('./models');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('your status message here', { type: 'WATCHING' }); // You can change the type to PLAYING, LISTENING, etc.
});

const sendEmbed = (message, embed) => message.reply({ embeds: [embed] });
const handleError = (message, error) => {
    console.error(error);
    message.reply('An error occurred.');
};

const sendHelpMessage = (message) => {
    const helpEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Help')
        .addFields(
            { name: '!u <username>', value: 'Get user info by username.' },
            { name: '!ul [page]', value: 'List users.' },
            { name: '!lg <runtime> <feature1> <feature2> ...', value: 'Generate license.' },
            { name: '!ll [page]', value: 'List licenses.' },
            { name: '!ld <license_key>', value: 'Delete license.' },
            { name: '!pl', value: 'List memory pointers.' },
            { name: '!pd <pointer_id>', value: 'Delete memory pointer.' },
            { name: '!pa <feature> <address> <offset1> <offset2> ...', value: 'Add memory pointer.' },
            { name: '!pe <pointer_id> <feature> <address> <offset1> <offset2> ...', value: 'Edit memory pointer.' }
        )
        .setTimestamp();

    sendEmbed(message, helpEmbed);
};

const commands = {
    '!u': async (message, args) => {
        const username = args[0];
        if (!username) return message.reply('Usage: !u <username>');

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

            sendEmbed(message, userInfoEmbed);
        } catch (error) {
            handleError(message, error);
        }
    },
    '!ul': async (message, args) => {
        const pageSize = 10;
        const page = parseInt(args[0], 10) || 1;

        try {
            const users = await User.find().skip((page - 1) * pageSize).limit(pageSize);
            const totalUsers = await User.countDocuments();
            const totalPages = Math.ceil(totalUsers / pageSize);

            if (users.length === 0) return message.reply('No users found.');

            const userListEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`User List - Page ${page} of ${totalPages}`);

            users.forEach((user, index) => {
                userListEmbed.addFields(
                    { name: `${user.username}`, value: `Email: ${user.email}\nNickname: ${user.nickname}\nCreated At: ${user.created_at.toISOString()}` }
                );
            });

            sendEmbed(message, userListEmbed);
        } catch (error) {
            handleError(message, error);
        }
    },
'!lg': async (message, args) => {
    const [runtime, expiry, ...features] = args;

    if (!runtime || !expiry || features.length === 0) {
        return message.reply('Usage: !lg <runtime> <expiry> <feature1> <feature2> ...\nExample: !lg 1d 2d feature1 feature2');
    }

    try {
        const licenseKey = `license-${Math.random().toString(36).substr(2, 9)}`;
        let expiresAt = new Date();

        const expiryValue = parseInt(expiry.slice(0, -1), 10);
        const expiryUnit = expiry.slice(-1);

        if (isNaN(expiryValue) || !['h', 'd', 'w', 'm', 'y'].includes(expiryUnit)) {
            return message.reply('Invalid expiry format. Use <number><unit> where unit is h, d, w, m, or y.');
        }

        switch (expiryUnit) {
            case 'h': expiresAt.setHours(expiresAt.getHours() + expiryValue); break;
            case 'd': expiresAt.setDate(expiresAt.getDate() + expiryValue); break;
            case 'w': expiresAt.setDate(expiresAt.getDate() + (expiryValue * 7)); break;
            case 'm': expiresAt.setMonth(expiresAt.getMonth() + expiryValue); break;
            case 'y': expiresAt.setFullYear(expiresAt.getFullYear() + expiryValue); break;
        }

        const newLicense = new Licenses({ key: licenseKey, features, runtime, expires_at: expiresAt });
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

        sendEmbed(message, licenseEmbed);
    } catch (error) {
        handleError(message, error);
    }
},
    '!ll': async (message, args) => {
        const pageSize = 10;
        const page = parseInt(args[0], 10) || 1;

        try {
            const licenses = await Licenses.find().populate('activated_by', 'username').skip((page - 1) * pageSize).limit(pageSize);
            const totalLicenses = await Licenses.countDocuments();
            const totalPages = Math.ceil(totalLicenses / pageSize);

            if (licenses.length === 0) return message.reply('No licenses found.');

            const licenseListEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`License List - Page ${page} of ${totalPages}`);

            licenses.forEach((license, index) => {
                licenseListEmbed.addFields(
                    { name: `${license.key}`, value: `Features: ${license.features.join(', ')}\nRuntime: ${license.runtime}\nExpires At: ${license.expires_at.toISOString()}\nActivated By: ${license.activated_by ? license.activated_by.username : 'N/A'}\nActivated At: ${license.activated_at ? license.activated_at.toISOString() : 'N/A'}` }
                );
            });

            sendEmbed(message, licenseListEmbed);
        } catch (error) {
            handleError(message, error);
        }
    },
    '!ld': async (message, args) => {
        const licenseKey = args[0];
        if (!licenseKey) return message.reply('Usage: !ld <license_key>');
        
        try {
            const license = await Licenses.findOne({ key: licenseKey });
            if (!license) return message.reply('License not found.');

            await Licenses.deleteOne
            ({ key: licenseKey });

            const licenseEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('License ' + license.key + ' Deleted')
                .setTimestamp();

            sendEmbed(message, licenseEmbed);
        } catch (error) {
            handleError(message, error);
        }
    },
    '!pl': async (message) => {
        try {
            const pointers = await MemoryPointer.find();

            if (pointers.length === 0) return message.reply('No memory pointers found.');

            const batchSize = 10;
            for (let i = 0; i < pointers.length; i += batchSize) {
                const batch = pointers.slice(i, i + batchSize);

                const pointerListEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Memory Pointer List');

                batch.forEach((pointer) => {
                    pointerListEmbed.addFields(
                        { name: `${pointer.feature}`, value: `ID: ${pointer._id}\nAddress: ${pointer.address}\nOffsets: ${pointer.offsets.join(', ')}` }
                    );
                });

                await sendEmbed(message, pointerListEmbed);
            }
        } catch (error) {
            handleError(message, error);
        }
    },
    '!pd': async (message, args) => {
        const pointerId = args[0];
        if (!pointerId) return message.reply('Usage: !pd <pointer_id>');

        try {
            const pointer = await MemoryPointer.findById(pointerId);
            if (!pointer) return message.reply('Memory pointer not found.');

            await MemoryPointer.deleteOne({ _id: pointerId });

            const fields = [];
            if (pointer.feature) fields.push({ name: 'Feature', value: pointer.feature, inline: true });
            if (pointer.address) fields.push({ name: 'Address', value: pointer.address, inline: true });
            if (pointer.offsets && pointer.offsets.length > 0) fields.push({ name: 'Offsets', value: pointer.offsets.join(', '), inline: true });

            const pointerEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Memory Pointer Deleted')
                .addFields(fields)
                .setTimestamp();

            sendEmbed(message, pointerEmbed);
        } catch (error) {
            handleError(message, error);
        }
    },
    '!pa': async (message, args) => {
        const [feature, address, ...offsets] = args;
        if (!feature || !address) return message.reply('Usage: !pa <feature> <address> <offset1> <offset2> ...');

        try {
            const newPointer = new MemoryPointer({ feature, address, offsets });
            await newPointer.save();

            const pointerEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Memory Pointer Added')
                .addFields(
                    { name: 'Feature', value: feature, inline: true },
                    { name: 'Address', value: address, inline: true },
                    { name: 'Offsets', value: offsets.join(', '), inline: true }
                )
                .setTimestamp();

            sendEmbed(message, pointerEmbed);
        } catch (error) {
            handleError(message, error);
        }
    },
    '!pe': async (message, args) => {
        const pointerId = args[0];
        const [feature, address, ...offsets] = args.slice(1);
        if (!pointerId || !feature || !address) return message.reply('Usage: !pe <pointer_id> <feature> <address> <offset1> <offset2> ...');

        try {
            const pointer = await MemoryPointer.findById(pointerId);
            if (!pointer) return message.reply('Memory pointer not found.');

            pointer.feature = feature;
            pointer.address = address;
            pointer.offsets = offsets;

            await pointer.save();

            const pointerEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Memory Pointer Edited')
                .addFields(
                    { name: 'Feature', value: feature, inline: true },
                    { name: 'Address', value: address, inline: true },
                    { name: 'Offsets', value: offsets.join(', '), inline: true }
                )
                .setTimestamp();

            sendEmbed(message, pointerEmbed);
        } catch (error) {
            handleError(message, error);
        }
    },    
    '!help': sendHelpMessage,
    '!h': sendHelpMessage
};

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const [command, ...args] = message.content.split(' ');

    if (commands[command]) {
        await commands[command](message, args);
    }
});

if (process.env.DISCORD_BOT == 'true') {
    client.login(process.env.DISCORD_BOT_TOKEN);
}