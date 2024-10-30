module.exports = {
    apps: [
      {
        name: 'sylentx-api',
        script: 'index.js', // Change this to your main application file
        instances: '1',
        // exec_mode: 'cluster',
        env: {
          NODE_ENV: 'production',
        },
      },
    ],
  };