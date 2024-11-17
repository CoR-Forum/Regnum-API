const express = require('express');
const os = require('os');
const disk = require('diskusage');
const mongoose = require('mongoose');

const router = express.Router();

const startTime = Date.now();

router.get('/', async (req, res) => {
  const load = os.loadavg();
  const uptime = os.uptime();
  const apiUptime = Date.now() - startTime;
  const freeMemory = os.freemem();
  const totalMemory = os.totalmem();
  const cpus = os.cpus().length;
  const nodeVersion = process.version;
  const envVariables = {
    NODE_ENV: process.env.NODE_ENV,
    BASE_URL: process.env.BASE_URL,
    BASE_PATH: process.env.BASE_PATH
  };

  // Fetch disk usage
  const diskUsage = await disk.check('/');

  // Fetch database stats
  const dbStats = await mongoose.connection.db.stats();

  res.json({
    status: "success",
    message: "API is running",
    api: {
      uptime: apiUptime / 1000
    },
    system: {
      load: load,
      uptime: uptime,
      freeMemory: freeMemory,
      totalMemory: totalMemory,
      cpus: cpus,
      diskUsage: {
        free: diskUsage.free,
        total: diskUsage.total,
        available: diskUsage.available
      },
      nodeVersion: nodeVersion,
      envVariables: envVariables
    },
    database: {
      collections: dbStats.collections,
      objects: dbStats.objects,
      avgObjSize: dbStats.avgObjSize,
      dataSize: dbStats.dataSize,
      storageSize: dbStats.storageSize,
      indexes: dbStats.indexes,
      indexSize: dbStats.indexSize
    }
  });
});

module.exports = router;