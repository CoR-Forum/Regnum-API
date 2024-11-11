module.exports = {
  apps: [
    {
      name: 'sylentx-api',
      script: 'index.js',
      instances: '1',
      exec_mode: 'fork', // Ensure only one instance runs
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};