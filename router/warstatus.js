const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { WarstatusHistory, WarstatusEvents } = require('../models');
const { queueNotification } = require('../modules/notificator');
const { validateServer } = require('../validation');
const router = express.Router();    

const assetMap = {
    gems: {
        'gem_0.png': 'none',
        'gem_1.png': 'ignis',
        'gem_2.png': 'alsius',
        'gem_3.png': 'syrtis'
    },
    buildings: {
        'keep_alsius.gif': 'alsius',
        'keep_ignis.gif': 'ignis',
        'keep_syrtis.gif': 'syrtis'
    },
    relics: {
        'res_79167.png': 'alsius',
        'res_79168.png': 'alsius',
        'res_79174.png': 'alsius',
        'res_79170.png': 'ignis',
        'res_79169.png': 'ignis',
        'res_79171.png': 'ignis',
        'res_79175.png': 'syrtis',
        'res_79172.png': 'syrtis',
        'res_79173.png': 'syrtis'
    }
};

const normalizeBuildingName = (name) => {
    return name.toLowerCase()
        .replace('fort ', '')
        .replace('castle ', '')
        .replace(/great wall of \w+/, 'wall') // Replace "Great Wall of <realm>" with "wall"
        .replace(/\s+/g, '_')
        .replace('_castle', ''); // Remove trailing "_castle" if present
};

const fetchWarStatus = async (server) => {
    if (!validateServer(server)) {
        throw new Error(`Invalid server: ${server}`);
    }
    try {
        const { data } = await axios.get(`https://www.championsofregnum.com/index.php?l=1&sec=3&server=${server}`);
        const $ = cheerio.load(data);

        const warStatus = {};

        $('#connectivity-box-content .war-status-realm').each((index, element) => {
            const realmName = $(element).find('div[style="float: left;"]').text().trim().toLowerCase().replace('realm of ', '');
            const realmStatus = {
                buildings: [],
                relics: [],
                gems: []
            };

            // Get gems
            $(element).find('div[style="float: right;"] img[align="absmiddle"]').each((i, img) => {
                const gemSrc = $(img).attr('src').split('/').pop();
                realmStatus.gems.push(assetMap.gems[gemSrc] || 'unknown');
            });

            // Get relics
            $(element).next('div').find('img[align="absmiddle"]').each((i, img) => {
                const relicSrc = $(img).attr('src').split('/').pop();
                realmStatus.relics.push(assetMap.relics[relicSrc] || 'unknown');
            });

            // Get buildings
            $(element).nextAll('.war-status-realm-buildings').first().find('.war-status-building').each((i, building) => {
                let buildingName = $(building).find('.war-status-bulding-name').text().trim();
                buildingName = normalizeBuildingName(buildingName.replace(/\s\(\d+\)$/, '')); // Remove trailing numbers in parentheses and normalize
                const buildingIcon = $(building).find('img').attr('src').split('/').pop();
                realmStatus.buildings.push({ name: buildingName, owner: assetMap.buildings[buildingIcon] || 'unknown' });
            });

            warStatus[realmName] = realmStatus;
        });

        // Check if the latest entry in the database is older than 30 seconds
        const latestEntry = await WarstatusHistory.findOne({ server }).sort({ timestamp: -1 });
        if (!latestEntry || (Date.now() - new Date(latestEntry.timestamp).getTime()) > 30000) {
            console.log(`Saving war status data for server=${server} to database...`);
            await new WarstatusHistory({ server, data: warStatus }).save();

            // Check for changes and create events
            if (latestEntry) {
                for (const realm in warStatus) {
                    const newStatus = warStatus[realm];
                    const oldStatus = latestEntry.data[realm];

                    // Check for building changes
                    newStatus.buildings.forEach(async (building, index) => {
                        if (building.owner !== oldStatus.buildings[index].owner) {
                            const event = `${server !== 'ra' ? `[${server}] ` : ''}${building.owner} captured ${building.name}`;
                            await new WarstatusEvents({
                                timestamp: Date.now(),
                                server,
                                realm: building.owner,
                                event,
                                action: "captured",
                                building: building.name
                            }).save();
                            if (server === 'ra') {
                                queueNotification(process.env.DISCORD_WARSTATUS_CHANNEL_ID, event, event, "discord");
                            }
                        }
                    });

                    // Check for relic changes
                    newStatus.relics.forEach(async (relic, index) => {
                        if (relic !== oldStatus.relics[index]) {
                            const event = `${server !== 'ra' ? `[${server}] ` : ''}${realm} got relic`;
                            await new WarstatusEvents({
                                timestamp: Date.now(),
                                server,
                                realm,
                                event,
                                action: "relic",
                                relic: true
                            }).save();
                            if (server === 'ra') {
                                // sendWarstatusToDiscord(event);
                            }
                        }
                    });

                    // Check for gem changes
                    newStatus.gems.forEach(async (gem, index) => {
                        if (gem !== oldStatus.gems[index]) {
                            const event = `${server !== 'ra' ? `[${server}] ` : ''}${realm} got gem`;
                            await new WarstatusEvents({
                                timestamp: Date.now(),
                                server,
                                realm,
                                event,
                                action: "gem",
                                gem: gem
                            }).save();
                            if (server === 'ra') {
                                // sendWarstatusToDiscord(event);
                            }
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error(`Error fetching war status data for server=${server}:`, error);
    }
};

if (process.env.NODE_ENV === 'production') {
    setInterval(() => fetchWarStatus('ra'), 30000);
    setInterval(() => fetchWarStatus('amun'), 30000);

    // Initial fetch on server start
    fetchWarStatus('ra');
    fetchWarStatus('amun');
}

// router to generate statistics about the war status from warstatusEventsSchema
router.get('/warstatus/statistics', async (req, res) => {
    const server = req.query.server || 'ra';
    if (!validateServer(server)) {
        return res.status(400).json({ status: 'error', message: 'Invalid server' });
    }
    try {
        const events = await WarstatusEvents.find({ server }).sort({ timestamp: -1 });
        const statistics = {
            totalEvents: events.length,
            // count the total captures per realm
            realms: {
                ignis: { captures: 0, relics: 0, gems: 0 },
                alsius: { captures: 0, relics: 0, gems: 0 },
                syrtis: { captures: 0, relics: 0, gems: 0 }
            },
            captures: 0,
            relics: 0,
            gems: 0
        };

        events.forEach(event => {
            if (event.action === 'captured') {
                statistics.captures++;
                statistics.realms[event.realm].captures++;
            } else if (event.action === 'relic') {
                statistics.relics++;
                statistics.realms[event.realm].relics++;
            } else if (event.action === 'gem') {
                statistics.gems++;
                statistics.realms[event.realm].gems++;
            }
        });

        res.json({ status: 'success', statistics });
    } catch (error) {
        console.error(`Error fetching war status statistics for server ${server}:`, error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

router.get('/warstatus', async (req, res) => {
    const server = req.query.server || 'ra';
    if (!validateServer(server)) {
        return res.status(400).json({ status: 'error', message: 'Invalid server' });
    }
    try {
        const latestEntry = await WarstatusHistory.findOne({ server }).sort({ timestamp: -1 });
        if (latestEntry) {
            return res.json({ lastUpdate: latestEntry.timestamp, warstatus: latestEntry.data });
        } else {
            res.status(500).json({ status: 'error', message: 'No data available' });
        }
    } catch (error) {
        console.error(`Error fetching latest war status for server ${server}:`, error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

router.get('/warstatus/history', async (req, res) => {
    const server = req.query.server;
    if (server && !validateServer(server)) {
        return res.status(400).json({ status: 'error', message: 'Invalid server' });
    }
    const query = server ? { server } : {};
    const history = await WarstatusHistory.find(query).sort({ timestamp: -1 }).limit(50);
    res.json({ history });
});

// get last 50 events
router.get('/warstatus/events', async (req, res) => {
    const server = req.query.server;
    if (server && !validateServer(server)) {
        return res.status(400).json({ status: 'error', message: 'Invalid server' });
    }
    const query = server ? { server } : {};
    const events = await WarstatusEvents.find(query).sort({ timestamp: -1 }).limit(50);
    res.json({ events });
});

module.exports = router;
