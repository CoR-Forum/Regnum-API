require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { logActivity } = require('./utils');
const { User, Licenses, MemoryPointer, SylentxFeature } = require('./models');

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

    if (command === '!ulist') {
        const pageSize = 10; // Number of users per page
        const page = parseInt(args[0], 10) || 1; // Current page number

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
                    { name: `User ${index + 1}`, value: `Username: ${user.username}\nEmail: ${user.email}\nNickname: ${user.nickname}` }
                );
            });

            message.reply({ embeds: [userListEmbed] });
        } catch (error) {
            console.error(error);
            message.reply('Error fetching users.');
        }
    }

    if (command === '!lgen') {
        const [runtime, ...features] = args;

        if (!runtime || features.length === 0) return message.reply('Usage: !lgen <runtime> <feature1> <feature2> ...' + '\n' + 'Example: !lgen 1d feature1 feature2');

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
        const pageSize = 10; // Number of licenses per page
        const page = parseInt(args[0], 10) || 1; // Current page number

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
                    { name: `License ${index + 1}`, value: `Key: ${license.key}\nFeatures: ${license.features.join(', ')}\nRuntime: ${license.runtime}\nExpires At: ${license.expires_at.toISOString()}\nActivated By: ${license.activated_by ? license.activated_by.username : 'N/A'}\nActivated At: ${license.activated_at ? license.activated_at.toISOString() : 'N/A'}` }
                );
            });

            message.reply({ embeds: [licenseListEmbed] });
        } catch (error) {
            console.error(error);
            message.reply('Error fetching licenses.');
        }
    }

// list pointers without pagination
if (command === '!lp') {
    try {
        const pointers = await MemoryPointer.find();

        if (pointers.length === 0) return message.reply('No memory pointers found.');

        const batchSize = 10;
        for (let i = 0; i < pointers.length; i += batchSize) {
            const batch = pointers.slice(i, i + batchSize);

            const pointerListEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Memory Pointer List');

            batch.forEach((pointer, index) => {
                pointerListEmbed.addFields(
                    { name: `Pointer ${i + index + 1}`, value: `ID: ${pointer._id}\nFeature: ${pointer.feature}\nAddress: ${pointer.address}\nOffsets: ${pointer.offsets.join(', ')}` }
                );
            });

            await message.reply({ embeds: [pointerListEmbed] });
        }
    } catch (error) {
        console.error(error);
        message.reply('Error fetching memory pointers.');
    }
}

// delete pointer
if (command === '!dp') {
    const pointerId = args[0];
    if (!pointerId) return message.reply('Please provide a pointer ID.');
    
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

        message.reply({ embeds: [pointerEmbed] });
    } catch (error) {
        console.error(error);
        message.reply('Error deleting memory pointer.');
    }
}

// add pointer
    if (command === '!ap') {
        const [feature, address, ...offsets] = args;
        if (!feature || !address) return message.reply('Usage: !ap <feature> <address> <offset1> <offset2> ...');

        try {
            const newPointer = new MemoryPointer({
                feature,
                address,
                offsets
            });

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

            message.reply({ embeds: [pointerEmbed] });
        } catch (error) {
            console.error(error);
            message.reply('Error adding memory pointer.');
        }
    }

// edit pointer
    if (command === '!ep') {
        const pointerId = args[0];
        const [feature, address, ...offsets] = args.slice(1);
        if (!pointerId || !feature || !address) return message.reply('Usage: !ep <pointer_id> <feature> <address> <offset1> <offset2> ...');

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

            message.reply({ embeds: [pointerEmbed] });
        } catch (error) {
            console.error(error);
            message.reply('Error editing memory pointer.');
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);