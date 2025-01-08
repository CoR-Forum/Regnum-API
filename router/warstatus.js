const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const router = express.Router();

let cachedData = null;
let cacheTimestamp = 0;

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

router.get('/warstatus', async (req, res) => {
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp < 30000)) {
        console.log('Returning cached data');
        return res.json({ warStatus: cachedData });
    }

    try {
        const { data } = await axios.get('https://www.championsofregnum.com/index.php?l=1&sec=3&world=ra');
        console.log('Fetched data:', data); // Log fetched data
        const $ = cheerio.load(data);

        const realms = ['Syrtis', 'Ignis', 'Alsius'];
        const warStatus = {};

        $('#connectivity-box-content .war-status-realm').each((index, element) => {
            const realmName = $(element).find('div[style="float: left;"]').text().trim();
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
                buildingName = buildingName.replace(/\s\(\d+\)$/, ''); // Remove trailing numbers in parentheses
                const buildingIcon = $(building).find('img').attr('src').split('/').pop();
                realmStatus.buildings.push({ name: buildingName, owner: assetMap.buildings[buildingIcon] || 'unknown' });
            });

            warStatus[realmName] = realmStatus;
        });

        console.log('Parsed war status:', warStatus); // Log parsed war status
        cachedData = warStatus;
        cacheTimestamp = now;
        res.json({ warStatus });
    } catch (error) {
        console.error('Error fetching war status data:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch war status data' });
    }
});

module.exports = router;
