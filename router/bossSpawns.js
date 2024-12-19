const express = require('express');
const router = express.Router();

const firstRespawns = {
    Thorkul: 1721681749,
    Evendim: 1721348488,
    Daen: 1721042368,
    ServerRestart: 1721210400 + 37 * 60
};

const SERVER_RESPAWN_TIME = 168 * 3600; // 1 week in seconds
const BOSS_RESPAWN_TIME = 109 * 3600; // 109 hours in seconds

const bossRespawns = {};

const getCurrentTimestamp = () => Math.floor(Date.now() / 1000);

const calculateNextRespawns = (boss) => {
    let triedRespawn = firstRespawns[boss];
    const now = getCurrentTimestamp();
    let respawnTime = 0;

    bossRespawns[boss] = { nextRespawns: [] };

    while (true) {
        respawnTime = (boss === 'ServerRestart') ? SERVER_RESPAWN_TIME : BOSS_RESPAWN_TIME;
        triedRespawn += respawnTime;
        if (triedRespawn >= now) {
            bossRespawns[boss].nextRespawns.push(triedRespawn);
        }
        if (bossRespawns[boss].nextRespawns.length === 3) break;
    }

    bossRespawns[boss].previousRespawn = bossRespawns[boss].nextRespawns[0] - respawnTime;
};

const initializeBossRespawns = () => {
    for (const boss in firstRespawns) {
        calculateNextRespawns(boss);
    }
};

initializeBossRespawns();

router.get('/bossRespawns', (req, res) => {
    const allRespawns = {};
    for (const boss in firstRespawns) {
        calculateNextRespawns(boss);
        allRespawns[boss] = {
            nextRespawns: bossRespawns[boss].nextRespawns,
            previousRespawn: bossRespawns[boss].previousRespawn
        };
    }
    res.json({
        status: "success",
        bosses: allRespawns
    });
});

module.exports = router;