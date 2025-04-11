const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { WarstatusHistory, WarstatusEvents } = require('../models');
const { queueNotification } = require('../modules/notificator');
const { validateServer } = require('../validation');
const { RateLimiter } = require('../modules/rateLimiter');
const router = express.Router();

// Constants
const FETCH_INTERVAL = 30000; // 30 seconds
const SERVERS = ['ra', 'amun']; // Define servers to monitor
const ASSET_MAP = {
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
const REALMS = ['ignis', 'alsius', 'syrtis'];

// Helper Functions
const normalizeBuildingName = (name) => {
    return name.toLowerCase()
        .replace('fort ', '')
        .replace('castle ', '')
        .replace(/great wall of \w+/, 'wall')
        .replace(/\s+/g, '_')
        .replace('_castle', '');
};

const parseWarStatusHtml = (html) => {
    const $ = cheerio.load(html);
    const warStatus = {};

    $('#connectivity-box-content .war-status-realm').each((index, element) => {
        const realmName = $(element).find('div[style="float: left;"]').text().trim().toLowerCase().replace('realm of ', '');
        if (!REALMS.includes(realmName)) return; // Skip if realm name is unexpected

        const realmStatus = {
            buildings: [],
            relics: [],
            gems: []
        };

        // Get gems
        $(element).find('div[style="float: right;"] img[align="absmiddle"]').each((i, img) => {
            const gemSrc = $(img).attr('src')?.split('/').pop();
            realmStatus.gems.push(ASSET_MAP.gems[gemSrc] || 'unknown');
        });

        // Get relics
        $(element).next('div').find('img[align="absmiddle"]').each((i, img) => {
            const relicSrc = $(img).attr('src')?.split('/').pop();
            realmStatus.relics.push(ASSET_MAP.relics[relicSrc] || 'unknown');
        });

        // Get buildings
        $(element).nextAll('.war-status-realm-buildings').first().find('.war-status-building').each((i, building) => {
            let buildingName = $(building).find('.war-status-bulding-name').text().trim();
            // Remove trailing numbers in parentheses like "(15)"
            buildingName = normalizeBuildingName(buildingName.replace(/\s\(\d+\)$/, ''));
            const buildingIcon = $(building).find('img').attr('src')?.split('/').pop();
            realmStatus.buildings.push({ name: buildingName, owner: ASSET_MAP.buildings[buildingIcon] || 'unknown' });
        });

        warStatus[realmName] = realmStatus;
    });
    return warStatus;
};

const compareAndRecordChanges = async (oldStatusData, newStatusData, server) => {
    const eventsToSave = [];
    const notificationsToSend = [];
    const timestamp = new Date();

    for (const realm in newStatusData) {
        if (!oldStatusData || !oldStatusData[realm]) continue; // Skip if old realm data doesn't exist

        const newStatus = newStatusData[realm];
        const oldStatus = oldStatusData[realm];

        // Check building changes
        newStatus.buildings.forEach((building, index) => {
            if (oldStatus.buildings?.[index]?.owner !== building.owner) {
                const eventText = `${server !== 'ra' ? `[${server}] ` : ''}${building.owner} captured ${building.name}`;
                eventsToSave.push({
                    timestamp,
                    server,
                    realm: building.owner,
                    event: eventText,
                    action: "captured",
                    building: building.name
                });
                if (server === 'ra') {
                    notificationsToSend.push({ channelId: process.env.DISCORD_WARSTATUS_CHANNEL_ID, message: eventText, type: "discord" });
                }
            }
        });

        // Check relic changes (compare sorted arrays to handle order changes)
        const oldRelicsSorted = [...(oldStatus.relics || [])].sort();
        const newRelicsSorted = [...(newStatus.relics || [])].sort();
        if (JSON.stringify(oldRelicsSorted) !== JSON.stringify(newRelicsSorted)) {
             // Basic detection: Check if counts differ or specific relics changed owner (more complex logic could be added)
             // This simplified check triggers if *any* relic change occurs for the realm.
             const eventText = `${server !== 'ra' ? `[${server}] ` : ''}${realm} relic status changed`; // Generic message
             eventsToSave.push({
                 timestamp,
                 server,
                 realm,
                 event: eventText,
                 action: "relic_change", // Changed action name for clarity
                 // relic: true // Consider storing the new relic array if needed
             });
             // Add notification if needed for relic changes
             // if (server === 'ra') { notificationsToSend.push(...) }
        }


        // Check gem changes (compare sorted arrays)
        const oldGemsSorted = [...(oldStatus.gems || [])].sort();
        const newGemsSorted = [...(newStatus.gems || [])].sort();
         if (JSON.stringify(oldGemsSorted) !== JSON.stringify(newGemsSorted)) {
             // Basic detection: Check if counts differ or specific gems changed owner
             const eventText = `${server !== 'ra' ? `[${server}] ` : ''}${realm} gem status changed`; // Generic message
             eventsToSave.push({
                 timestamp,
                 server,
                 realm,
                 event: eventText,
                 action: "gem_change", // Changed action name for clarity
                 // gem: newGemsSorted // Consider storing the new gem array
             });
             // Add notification if needed for gem changes
             // if (server === 'ra') { notificationsToSend.push(...) }
         }
    }

    // Bulk save events
    if (eventsToSave.length > 0) {
        try {
            await WarstatusEvents.insertMany(eventsToSave, { ordered: false }); // ordered: false allows valid events to be inserted even if some fail
            console.log(`[${server}] Recorded ${eventsToSave.length} war status events.`);
        } catch (error) {
            console.error(`[${server}] Error bulk saving war status events:`, error);
        }
    }

    // Send notifications
    notificationsToSend.forEach(notif => {
        queueNotification(notif.channelId, notif.message, notif.message, notif.type);
    });
};


const fetchWarStatus = async (server) => {
    if (!validateServer(server)) {
        console.error(`Invalid server specified: ${server}`);
        return;
    }
    console.log(`[${server}] Fetching war status...`);
    try {
        const { data } = await axios.get(`https://www.championsofregnum.com/index.php?l=1&sec=3&server=${server}`);
        const currentWarStatus = parseWarStatusHtml(data);

        if (Object.keys(currentWarStatus).length === 0) {
             console.warn(`[${server}] Parsed war status is empty. Check parsing logic or source website structure.`);
             return;
        }

        const latestEntry = await WarstatusHistory.findOne({ server }).sort({ timestamp: -1 });
        const now = Date.now();

        // Save new history if no previous entry or if it's older than the interval
        if (!latestEntry || (now - new Date(latestEntry.timestamp).getTime()) >= FETCH_INTERVAL) {
            console.log(`[${server}] Saving new war status history.`);
            const newHistory = new WarstatusHistory({ server, data: currentWarStatus, timestamp: new Date(now) });
            await newHistory.save();

            // Compare with the previous state and record changes
            if (latestEntry) {
                await compareAndRecordChanges(latestEntry.data, currentWarStatus, server);
            }
        } else {
             console.log(`[${server}] War status fetched but not saved (too recent).`);
        }

    } catch (error) {
        console.error(`[${server}] Error fetching or processing war status:`, error.message);
         if (error.response) {
            console.error(`[${server}] Status: ${error.response.status}, Data: ${error.response.data}`);
        }
    }
};

// --- Background Fetching ---
// Use a more robust interval handler that prevents overlapping runs
const runFetchInterval = (server) => {
    const fetchAndSchedule = async () => {
        try {
            await fetchWarStatus(server);
        } catch (error) {
            // Error is logged within fetchWarStatus
        } finally {
            // Schedule the next run regardless of success or failure
            setTimeout(() => runFetchInterval(server), FETCH_INTERVAL);
        }
    };
    fetchAndSchedule(); // Start immediately
};

if (process.env.NODE_ENV === 'production') {
    SERVERS.forEach(server => {
        console.log(`Starting initial fetch for server: ${server}`);
        fetchWarStatus(server).then(() => {
             console.log(`Initial fetch complete for ${server}. Starting interval.`);
             // Start interval *after* initial fetch completes
             setTimeout(() => runFetchInterval(server), FETCH_INTERVAL);
        }).catch(error => {
             console.error(`Initial fetch failed for ${server}:`, error);
             // Still start the interval, it might recover
             setTimeout(() => runFetchInterval(server), FETCH_INTERVAL);
        });
    });
}


// --- API Routes ---

// Statistics Endpoint (Optimized with Aggregation)
router.get('/warstatus/statistics', RateLimiter(1, 3), async (req, res) => {
    const server = req.query.server || 'ra';
    if (!validateServer(server)) {
        return res.status(400).json({ status: 'error', message: 'Invalid server' });
    }
    try {
        const statsPipeline = [
            { $match: { server } },
            {
                $group: {
                    _id: '$action', // Group by action type
                    count: { $sum: 1 },
                    // Group by realm within each action type
                    realms: {
                        $push: {
                            realm: '$realm',
                            // Add other fields if needed per realm/action
                        }
                    }
                }
            },
             {
                $group: {
                    _id: null, // Group all action results together
                    totalEvents: { $sum: '$count' },
                    actions: { $push: { action: '$_id', count: '$count', realmsData: '$realms' } }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalEvents: 1,
                    // Restructure the data for the desired output format
                    statistics: {
                        $arrayToObject: {
                            $map: {
                                input: '$actions',
                                as: 'actionData',
                                in: {
                                    k: '$$actionData.action', // e.g., 'captured', 'relic_change'
                                    v: {
                                        total: '$$actionData.count',
                                        // Calculate per-realm counts
                                        realms: {
                                            $arrayToObject: {
                                                $map: {
                                                    input: REALMS, // Iterate through known realms
                                                    as: 'realmName',
                                                    in: {
                                                        k: '$$realmName',
                                                        v: {
                                                            $size: {
                                                                $filter: {
                                                                    input: '$$actionData.realmsData',
                                                                    as: 'realmEntry',
                                                                    cond: { $eq: ['$$realmEntry.realm', '$$realmName'] }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
             { // Merge the nested 'statistics' object up and add default realm structure
                $replaceRoot: {
                    newRoot: {
                        totalEvents: '$totalEvents',
                        captures: { $ifNull: ['$statistics.captured.total', 0] },
                        relic_changes: { $ifNull: ['$statistics.relic_change.total', 0] }, // Use new action name
                        gem_changes: { $ifNull: ['$statistics.gem_change.total', 0] },     // Use new action name
                        realms: {
                            ignis: {
                                captures: { $ifNull: ['$statistics.captured.realms.ignis', 0] },
                                relic_changes: { $ifNull: ['$statistics.relic_change.realms.ignis', 0] },
                                gem_changes: { $ifNull: ['$statistics.gem_change.realms.ignis', 0] }
                            },
                            alsius: {
                                captures: { $ifNull: ['$statistics.captured.realms.alsius', 0] },
                                relic_changes: { $ifNull: ['$statistics.relic_change.realms.alsius', 0] },
                                gem_changes: { $ifNull: ['$statistics.gem_change.realms.alsius', 0] }
                            },
                            syrtis: {
                                captures: { $ifNull: ['$statistics.captured.realms.syrtis', 0] },
                                relic_changes: { $ifNull: ['$statistics.relic_change.realms.syrtis', 0] },
                                gem_changes: { $ifNull: ['$statistics.gem_change.realms.syrtis', 0] }
                            }
                        }
                    }
                }
            }
        ];


        const results = await WarstatusEvents.aggregate(statsPipeline);

        // Handle case where there are no events for the server
        const statistics = results[0] || {
            totalEvents: 0,
            captures: 0,
            relic_changes: 0,
            gem_changes: 0,
            realms: {
                ignis: { captures: 0, relic_changes: 0, gem_changes: 0 },
                alsius: { captures: 0, relic_changes: 0, gem_changes: 0 },
                syrtis: { captures: 0, relic_changes: 0, gem_changes: 0 }
            }
        };


        res.json({ status: 'success', statistics });
    } catch (error) {
        console.error(`Error fetching war status statistics for server ${server}:`, error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});


// Get Latest War Status
router.get('/warstatus', RateLimiter(1, 3), async (req, res) => {
    const server = req.query.server || 'ra';
    if (!validateServer(server)) {
        return res.status(400).json({ status: 'error', message: 'Invalid server' });
    }
    try {
        // Find the most recent entry for the specified server
        const latestEntry = await WarstatusHistory.findOne({ server })
                                                  .sort({ timestamp: -1 })
                                                  .lean(); // Use .lean() for faster, plain JS objects if not modifying

        if (latestEntry) {
            return res.json({ lastUpdate: latestEntry.timestamp, warstatus: latestEntry.data });
        } else {
            // Send 404 if no data is found for this specific server yet
            res.status(404).json({ status: 'error', message: `No data available for server ${server}` });
        }
    } catch (error) {
        console.error(`Error fetching latest war status for server ${server}:`, error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

// Get War Status History (Limited)
router.get('/warstatus/history', RateLimiter(1, 3), async (req, res) => {
    const server = req.query.server; // Optional server filter
    const limit = parseInt(req.query.limit, 10) || 50; // Allow limit override, default 50

    if (server && !validateServer(server)) {
        return res.status(400).json({ status: 'error', message: 'Invalid server' });
    }

    const query = server ? { server } : {};

    try {
        const history = await WarstatusHistory.find(query)
                                              .sort({ timestamp: -1 })
                                              .limit(limit)
                                              .lean(); // Use .lean() for performance
        res.json({ history });
    } catch (error) {
         console.error(`Error fetching war status history (server: ${server || 'all'}):`, error);
         res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

// Get War Status Events (Limited)
router.get('/warstatus/events', RateLimiter(1, 3), async (req, res) => {
    const server = req.query.server; // Optional server filter
    const limit = parseInt(req.query.limit, 10) || 50; // Allow limit override, default 50

    if (server && !validateServer(server)) {
        return res.status(400).json({ status: 'error', message: 'Invalid server' });
    }

    // Use $eq for explicit server match if provided, otherwise match all
    const query = server ? { server: { $eq: server } } : {};

    try {
        const events = await WarstatusEvents.find(query)
                                            .sort({ timestamp: -1 })
                                            .limit(limit)
                                            .lean(); // Use .lean() for performance
        res.json({ events });
     } catch (error) {
         console.error(`Error fetching war status events (server: ${server || 'all'}):`, error);
         res.status(500).json({ status: 'error', message: 'Internal server error' });
     }
});

module.exports = router;
